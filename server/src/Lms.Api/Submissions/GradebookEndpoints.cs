using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Submissions;

/// <summary>
/// A class's grade weights and each student's standing, with the prototype's rules: averages use
/// graded work only (latest graded assignment submission, highest graded exam attempt), and the
/// overall appears only once every category with weight above zero has a grade. Phase 3 replaces
/// the two fixed categories with teacher-defined grade components.
/// </summary>
public static class GradebookEndpoints
{
    public static IEndpointRouteBuilder MapGradebookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/classes/{classId}/gradebook").RequireDemoUser();

        group.MapGet("", async Task<IResult> (string classId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = user.IsInstructor ? await access.ForGradingAsync(classId, user, ct) : await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var settings = await SettingsAsync(db, classId, ct);
            var students = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == classId && s.IsActive)
                .Where(s => user.IsInstructor || s.StudentId == user.Id)
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName).ToListAsync(ct);
            var rows = await RowsAsync(db, classId, settings, students, ct);
            return TypedResults.Ok(new GradebookDto(settings.ActivityWeight, settings.ExamWeight, settings.PassingScore, rows));
        }).WithName("GetGradebook");

        group.MapPut("", async Task<IResult> (string classId, GradebookSettingsInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var errors = new Errors();
            if (input.ActivityWeight is not (>= 0 and <= 100)) errors.Add("activityWeight", "Use 0 to 100.");
            if (input.ExamWeight is not (>= 0 and <= 100)) errors.Add("examWeight", "Use 0 to 100.");
            if (input.PassingScore is not (>= 0 and <= 100)) errors.Add("passingScore", "Use 0 to 100.");
            if (!errors.Any && input.ActivityWeight + input.ExamWeight != 100)
                errors.Add("examWeight", $"Activity and exam weights add up to {input.ActivityWeight + input.ExamWeight}%; they must add up to 100%.");
            if (errors.Any) return errors.Result();

            var row = await db.GradebookSettings.SingleOrDefaultAsync(g => g.ClassId == classId, ct);
            if (row is null) { row = new GradebookSetting { ClassId = classId }; db.GradebookSettings.Add(row); }
            row.ActivityWeight = input.ActivityWeight!.Value;
            row.ExamWeight = input.ExamWeight!.Value;
            row.PassingScore = input.PassingScore!.Value;
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "updated", "Gradebook", () => 0, ct, "grading");
            return TypedResults.Ok(new GradebookDto(row.ActivityWeight, row.ExamWeight, row.PassingScore, []));
        }).WithName("UpdateGradebookSettings");

        return app;
    }

    private static async Task<GradebookSetting> SettingsAsync(LmsDbContext db, string classId, CancellationToken ct) =>
        await db.GradebookSettings.AsNoTracking().SingleOrDefaultAsync(g => g.ClassId == classId, ct) ?? new GradebookSetting { ClassId = classId };

    private static async Task<List<GradebookRow>> RowsAsync(LmsDbContext db, string classId, GradebookSetting settings, List<IsmsClassStudent> students, CancellationToken ct)
    {
        var graded = await (
            from s in db.Submissions
            join c in db.Coursework on s.CourseworkId equals c.Id
            join g in db.Grades on s.Id equals g.SubmissionId
            where c.ClassId == classId && c.Status != CourseworkStatus.Archived && (s.Status == SubmissionStatus.Graded || s.Status == SubmissionStatus.Returned)
            select new { s.StudentId, s.CourseworkId, c.Type, c.MaxPoints, s.AttemptNumber, g.Points }).ToListAsync(ct);

        return students.Select(student =>
        {
            var mine = graded.Where(g => g.StudentId == student.StudentId).ToList();
            // Assignments: the latest graded submission. Exams: the highest graded attempt.
            var activities = mine.Where(g => g.Type == CourseworkType.Assignment).GroupBy(g => g.CourseworkId)
                .Select(x => x.OrderByDescending(g => g.AttemptNumber).First()).Select(g => Percent(g.Points, g.MaxPoints)).ToList();
            var exams = mine.Where(g => g.Type == CourseworkType.Exam).GroupBy(g => g.CourseworkId)
                .Select(x => x.Max(g => Percent(g.Points, g.MaxPoints))).ToList();
            var a = Average(activities);
            var e = Average(exams);
            decimal? overall = (settings.ActivityWeight > 0 && a.Average is null) || (settings.ExamWeight > 0 && e.Average is null) || settings.ActivityWeight + settings.ExamWeight == 0
                ? null
                : Math.Round(((a.Average ?? 0) * settings.ActivityWeight + (e.Average ?? 0) * settings.ExamWeight) / (settings.ActivityWeight + settings.ExamWeight), 2);
            return new GradebookRow(student.StudentId, $"{student.FirstName} {student.LastName}".Trim(), a, e, overall, overall is null ? null : overall >= settings.PassingScore);
        }).ToList();
    }

    private static decimal Percent(decimal points, decimal max) => max <= 0 ? 0 : points / max * 100;

    private static CategoryAverage Average(List<decimal> values) =>
        new(values.Count, values.Count == 0 ? null : Math.Round(values.Average(), 2));
}
