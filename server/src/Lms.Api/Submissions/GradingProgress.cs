using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>How many students on the class list have a grade for one piece of coursework, and who does not.</summary>
public sealed record GradingProgress(int Graded, int Roster, IReadOnlyList<StudentRef> Ungraded);

/// <summary>
/// The rule for "graded", shared by the close action and the graded-progress figures. A student
/// counts once they are active on the class list and: assignment, their latest submission is
/// graded; exam, at least one attempt is graded (an attempt whose essays still wait for the
/// instructor is not). A "not handed in" grade (<see cref="IsNotHandedIn"/>) counts as graded.
/// </summary>
public static class GradingRules
{
    /// <summary>A grade the instructor recorded for a student who handed in nothing (D-036).</summary>
    public static bool IsNotHandedIn(Submission s) => s.SubmittedAt is null && s.Status != SubmissionStatus.InProgress;

    /// <summary>Graded, whether or not it has been returned to the student yet (D-054).</summary>
    public static bool IsGraded(string status) => status is SubmissionStatus.Graded or SubmissionStatus.Returned;

    public static async Task<Dictionary<long, GradingProgress>> ProgressAsync(LmsDbContext db, IReadOnlyCollection<CourseworkRow> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return [];
        var classIds = rows.Select(r => r.ClassId).Distinct().ToList();
        var ids = rows.Select(r => r.Id).ToList();
        var roster = await db.IsmsClassStudents.AsNoTracking().Where(s => classIds.Contains(s.ClassId) && s.IsActive)
            .OrderBy(s => s.LastName).ThenBy(s => s.FirstName).ToListAsync(ct);
        var work = await (
            from s in db.Submissions
            where ids.Contains(s.CourseworkId)
            select new { s.CourseworkId, s.StudentId, s.AttemptNumber, s.Status, HasGrade = db.Grades.Any(g => g.SubmissionId == s.Id) }).ToListAsync(ct);

        return rows.ToDictionary(r => r.Id, r =>
        {
            var mine = work.Where(w => w.CourseworkId == r.Id).ToLookup(w => w.StudentId);
            var students = roster.Where(s => s.ClassId == r.ClassId).ToList();
            var ungraded = students.Where(student =>
            {
                var attempts = mine[student.StudentId].ToList();
                // An assignment draft is not handed in, so it neither counts nor hides earlier work (D-054).
                if (r.Type == CourseworkType.Assignment) attempts = attempts.Where(a => a.Status != SubmissionStatus.InProgress).ToList();
                if (attempts.Count == 0) return true;
                if (r.Type == CourseworkType.Assignment)
                {
                    var latest = attempts.MaxBy(a => a.AttemptNumber)!;
                    return !(IsGraded(latest.Status) && latest.HasGrade);
                }
                return !attempts.Any(a => IsGraded(a.Status) && a.HasGrade);
            }).Select(s => new StudentRef(s.StudentId, $"{s.FirstName} {s.LastName}".Trim())).ToList();
            return new GradingProgress(students.Count - ungraded.Count, students.Count, ungraded);
        });
    }
}
