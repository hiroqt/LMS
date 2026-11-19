using System.Text.Json;
using Lms.Api.Attendance;
using Lms.Api.Classes;
using Lms.Api.Content;
using Lms.Api.Coursework;
using Lms.Api.Data;
using Lms.Api.Identity;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Me;

public sealed record Person(string Id, string FirstName, string LastName, string Role);
public sealed record ClassSummary(string Id, int SubjectId, string? SubjectCode, string SubjectName, string? SectionName, string InstructorId,
    string InstructorName, string? TermName, int StudentCount, IReadOnlyList<ClassMeeting> Meetings);
public sealed record ModuleItem(long Id, string ClassId, long? ParentModuleId, string Title, int SortOrder);
public sealed record MaterialItem(long Id, string ClassId, long ModuleId, string Title, string Kind, string? Description,
    string? FileName, string? FileType, string? FileSize, string Status, DateTime CreatedAt);
public sealed record AnnouncementItem(long Id, string ClassId, string Title, string Message, string Status, DateTime PublishedAt, string? PostedBy, string? PostedByName);
public sealed record CourseworkItem(string ClassId, CourseworkDto Coursework);
public sealed record SubmissionItem(long CourseworkId, string ClassId, SubmissionDto Submission);
public sealed record ClassStudent(string ClassId, string StudentId, string FirstName, string LastName);
public sealed record GradebookItem(string ClassId, int ActivityWeight, int ExamWeight, int PassingScore);
public sealed record AttendanceItem(string ClassId, AttendanceMonthDto Month);

/// <summary>Everything a workspace shows, in one call. Students get only what they may see.</summary>
public sealed record Overview(Person Me, IReadOnlyList<ClassSummary> Classes, IReadOnlyList<ModuleItem> Modules,
    IReadOnlyList<MaterialItem> Materials, IReadOnlyList<AnnouncementItem> Announcements, IReadOnlyList<CourseworkItem> Coursework,
    IReadOnlyList<SubmissionItem> Submissions, IReadOnlyList<ClassStudent> Students, IReadOnlyList<GradebookItem> Gradebooks,
    IReadOnlyList<AttendanceItem> Attendance);

public sealed record PersonRef(string Id, string Name);
public sealed record People(IReadOnlyList<PersonRef> Instructors, IReadOnlyList<PersonRef> Students);

public static class OverviewEndpoints
{
    public static IEndpointRouteBuilder MapOverviewEndpoints(this IEndpointRouteBuilder app)
    {
        // Who the client can be "viewing as". Demo identity only: answers 404 when it is off.
        app.MapGet("/api/people", async Task<IResult> (IConfiguration config, LmsDbContext db, CancellationToken ct) =>
        {
            if (!config.GetValue<bool>(DemoIdentity.EnabledSetting)) return TypedResults.NotFound();
            var instructors = (await db.IsmsClasses.AsNoTracking().Where(c => c.IsActive).Select(c => new { c.InstructorId, c.InstructorName }).Distinct().ToListAsync(ct))
                .GroupBy(i => i.InstructorId).Select(g => new PersonRef(g.Key, g.First().InstructorName)).OrderBy(p => p.Id, StringComparer.Ordinal).ToList();
            var students = (await db.IsmsClassStudents.AsNoTracking().Where(s => s.IsActive).Select(s => new { s.StudentId, s.FirstName, s.LastName }).Distinct().ToListAsync(ct))
                .GroupBy(s => s.StudentId).Select(g => new PersonRef(g.Key, $"{g.First().FirstName} {g.First().LastName}".Trim()))
                .OrderBy(p => p.Id.Length).ThenBy(p => p.Id, StringComparer.Ordinal).ToList();
            return TypedResults.Ok(new People(instructors, students));
        }).WithName("ListPeople");

        app.MapGroup("/api/me").RequireDemoUser().MapGet("/overview", async (HttpContext http, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var classes = await (user.IsInstructor
                ? db.IsmsClasses.AsNoTracking().Where(c => c.IsActive && c.InstructorId == user.Id)
                : db.IsmsClasses.AsNoTracking().Where(c => c.IsActive && db.IsmsClassStudents.Any(s => s.ClassId == c.Id && s.StudentId == user.Id && s.IsActive)))
                .OrderBy(c => c.SubjectCode).ThenBy(c => c.SectionName).ToListAsync(ct);
            var ids = classes.Select(c => c.Id).ToList();

            var roster = await db.IsmsClassStudents.AsNoTracking().Where(s => ids.Contains(s.ClassId) && s.IsActive)
                .OrderBy(s => s.LastName).ThenBy(s => s.FirstName).ToListAsync(ct);
            var modules = await db.Modules.AsNoTracking().Where(m => ids.Contains(m.ClassId)).OrderBy(m => m.SortOrder).ThenBy(m => m.Id).ToListAsync(ct);

            var materialQuery = db.Materials.AsNoTracking().Where(m => ids.Contains(m.ClassId));
            var announcementQuery = db.Announcements.AsNoTracking().Where(a => ids.Contains(a.ClassId));
            var courseworkQuery = db.Coursework.AsNoTracking().Where(c => ids.Contains(c.ClassId));
            if (user.IsStudent)
            {
                var now = time.GetUtcNow().UtcDateTime;
                materialQuery = materialQuery.Where(m => m.Status == ContentStatus.Active);
                announcementQuery = announcementQuery.Where(a => a.Status == ContentStatus.Active);
                courseworkQuery = courseworkQuery.Where(c => (c.Status == CourseworkStatus.Published || c.Status == CourseworkStatus.Closed) && (c.AvailableFrom == null || c.AvailableFrom <= now));
            }
            var materials = await materialQuery.OrderBy(m => m.Id).ToListAsync(ct);
            var announcements = await announcementQuery.OrderByDescending(a => a.PublishedAt).ThenByDescending(a => a.Id).ToListAsync(ct);
            var coursework = await courseworkQuery.OrderBy(c => c.DueAt == null).ThenBy(c => c.DueAt).ThenBy(c => c.Id).ToListAsync(ct);
            var counts = await CourseworkEndpoints.QuestionCountsAsync(db, coursework, ct);
            var progress = await CourseworkEndpoints.ProgressForAsync(db, user, coursework, ct);
            var turnIn = await AssignmentRules.ForStudentAsync(db, user, coursework, time.GetUtcNow().UtcDateTime, ct);

            // Instructors: every handed-in attempt in their classes. Students: their own attempts, including an open one
            // and any version they took back.
            var courseworkIds = coursework.Select(c => c.Id).ToList();
            var submissionRows = await db.Submissions.AsNoTracking().Where(s => courseworkIds.Contains(s.CourseworkId))
                .Where(s => user.IsInstructor ? s.Status != SubmissionStatus.InProgress && s.Status != SubmissionStatus.Withdrawn : s.StudentId == user.Id)
                .OrderBy(s => s.Id).ToListAsync(ct);
            var submissions = new List<SubmissionItem>();
            foreach (var cw in coursework)
            {
                var rows = submissionRows.Where(s => s.CourseworkId == cw.Id).ToList();
                if (rows.Count == 0) continue;
                submissions.AddRange((await SubmissionEndpoints.ToDtoAsync(db, cw, rows, ct, forStudent: !user.IsInstructor)).Select(d => new SubmissionItem(cw.Id, cw.ClassId, d)));
            }

            // Instructors: every entry of their classes. Students: their own days only.
            var attendance = await AttendanceEndpoints.LoadAsync(db, ids, ct);
            var gradebooks = await db.GradebookSettings.AsNoTracking().Where(g => ids.Contains(g.ClassId)).ToListAsync(ct);
            // One instructor often teaches several classes, so keep the first name per id.
            var names = classes.DistinctBy(c => c.InstructorId).ToDictionary(c => c.InstructorId, c => c.InstructorName);
            var me = user.IsInstructor
                ? Split(user.Id, names.GetValueOrDefault(user.Id), user.Role)
                : roster.FirstOrDefault(s => s.StudentId == user.Id) is { } self ? new Person(user.Id, self.FirstName, self.LastName, user.Role) : new Person(user.Id, "", "", user.Role);

            return TypedResults.Ok(new Overview(
                me,
                classes.Select(c => new ClassSummary(c.Id, c.SubjectId, c.SubjectCode, c.SubjectName, c.SectionName, c.InstructorId, c.InstructorName, c.TermName,
                    roster.Count(s => s.ClassId == c.Id), JsonSerializer.Deserialize<List<ClassMeeting>>(c.MeetingsJson, JsonSerializerOptions.Web) ?? [])).ToList(),
                modules.Select(m => new ModuleItem(m.Id, m.ClassId, m.ParentModuleId, m.Title, m.SortOrder)).ToList(),
                materials.Select(m => new MaterialItem(m.Id, m.ClassId, m.ModuleId, m.Title, m.Kind, m.Description, m.FileName, m.FileType, m.FileSize, m.Status, m.CreatedAt)).ToList(),
                announcements.Select(a => new AnnouncementItem(a.Id, a.ClassId, a.Title, a.Message, a.Status, a.PublishedAt, a.CreatedBy, a.CreatedBy is { } by ? names.GetValueOrDefault(by) : null)).ToList(),
                coursework.Select(c => new CourseworkItem(c.ClassId, CourseworkEndpoints.ToDto(c, user, counts, progress, turnIn))).ToList(),
                submissions,
                roster.Select(s => new ClassStudent(s.ClassId, s.StudentId, s.FirstName, s.LastName)).ToList(),
                classes.Select(c => gradebooks.FirstOrDefault(g => g.ClassId == c.Id) is { } g
                    ? new GradebookItem(c.Id, g.ActivityWeight, g.ExamWeight, g.PassingScore)
                    : new GradebookItem(c.Id, 40, 60, 60)).ToList(),
                attendance.Select(m => new AttendanceItem(m.ClassId, AttendanceEndpoints.ToDto(m, user))).ToList()));
        }).WithName("GetOverview");

        return app;
    }

    private static Person Split(string id, string? fullName, string role)
    {
        var parts = (fullName ?? "").Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return new Person(id, parts.ElementAtOrDefault(0) ?? "", parts.ElementAtOrDefault(1) ?? "", role);
    }
}
