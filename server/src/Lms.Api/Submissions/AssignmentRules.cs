using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>A student's standing on one assignment (contract §2).</summary>
public static class TurnInState
{
    public const string Assigned = "assigned";
    /// <summary>Nothing handed in, and the due date has passed.</summary>
    public const string Missing = "missing";
    public const string Draft = "draft";
    public const string TurnedIn = "turned_in";
    public const string Graded = "graded";
    public const string Returned = "returned";
    public const string NotHandedIn = "not_handed_in";
}

/// <summary>Why a student can't turn work in now, in the order they are checked.</summary>
public static class TurnInReason
{
    public const string Closed = "closed";
    public const string NotHandedIn = "not_handed_in";
    public const string AlreadyTurnedIn = "already_turned_in";
    public const string PastClose = "past_close";
    public const string PastDue = "past_due";
}

/// <param name="Late">Handing in now would be late.</param>
/// <param name="CanUnsubmit">The latest turned-in work can be taken back now (contract §7).</param>
public sealed record TurnInStatus(string State, bool CanTurnIn, string? Reason, bool Late, bool CanUnsubmit = false);

/// <summary>
/// The one place that decides whether a student can turn in an assignment (D-054). The turn-in
/// endpoint enforces it, and students receive it as <c>turnIn</c>, so the browser never works the
/// rules out itself.
/// </summary>
public static class AssignmentRules
{
    /// <param name="mine">Every submission row of this student for this assignment, drafts included.</param>
    public static TurnInStatus Evaluate(CourseworkRow cw, IReadOnlyCollection<Submission> mine, DateTime now)
    {
        var handedIn = mine.Where(GradingRules.IsHandedIn).ToList();
        var notHandedIn = handedIn.Any(GradingRules.IsNotHandedIn);
        var latest = handedIn.Where(s => !GradingRules.IsNotHandedIn(s)).MaxBy(s => s.AttemptNumber);
        var pastDue = cw.DueAt is { } due && now > due;

        var state = notHandedIn ? TurnInState.NotHandedIn
            : latest is not null ? StateOf(cw, latest)
            : mine.Any(s => s.Status == SubmissionStatus.InProgress) ? TurnInState.Draft
            : pastDue ? TurnInState.Missing
            : TurnInState.Assigned;

        string? reason =
            cw.Status == CourseworkStatus.Closed ? TurnInReason.Closed
            : notHandedIn ? TurnInReason.NotHandedIn
            : latest is not null && !cw.AllowResubmission ? TurnInReason.AlreadyTurnedIn
            : cw.CloseAt is { } close && now > close ? TurnInReason.PastClose
            : pastDue && !cw.AllowLate ? TurnInReason.PastDue
            : null;

        // Taking work back: before the due date, while resubmission is on, and only until it has a grade (D-058).
        var canUnsubmit = cw.Status == CourseworkStatus.Published && cw.AllowResubmission && !pastDue && !notHandedIn
            && latest is { Status: SubmissionStatus.Submitted };

        return new TurnInStatus(state, reason is null, reason, pastDue, canUnsubmit);
    }

    public const string CannotUnsubmit = "This work can no longer be taken back.";

    /// <summary>The state a student sees for handed-in work: a held grade looks like work waiting for one.</summary>
    private static string StateOf(CourseworkRow cw, Submission row) => row.Status switch
    {
        SubmissionStatus.Returned => TurnInState.Returned,
        SubmissionStatus.Graded => GradeVisibleToStudent(cw, row) ? TurnInState.Graded : TurnInState.TurnedIn,
        _ => TurnInState.TurnedIn,
    };

    /// <summary>Whether the student may see this row's grade: always, unless the assignment holds grades until they are returned.</summary>
    public static bool GradeVisibleToStudent(CourseworkRow cw, Submission row) =>
        cw.Type != CourseworkType.Assignment || cw.GradeRelease != GradeRelease.Returned || row.Status == SubmissionStatus.Returned;

    /// <summary>The refusal the turn-in endpoint gives for a reason.</summary>
    public static string Message(string reason, CourseworkRow cw) => reason switch
    {
        TurnInReason.Closed => "This assignment is closed and no longer accepts work.",
        TurnInReason.NotHandedIn => "Your instructor has already recorded a grade for this assignment without a submission.",
        TurnInReason.AlreadyTurnedIn => "You have already handed this in, and resubmission is not allowed.",
        TurnInReason.PastClose => "This assignment no longer accepts late work.",
        TurnInReason.PastDue => "This assignment is past its due date and does not accept late work.",
        _ => throw new ArgumentOutOfRangeException(nameof(reason), reason, $"No message for {cw.Title}."),
    };

    /// <summary>When students stop handing in for good: the last day for late work, otherwise the due date.</summary>
    public static DateTime? LastDay(CourseworkRow cw) => cw.CloseAt ?? cw.DueAt;

    /// <summary>The verdict on each assignment for a student; null for instructors, and no entry for exams.</summary>
    public static async Task<Dictionary<long, TurnInStatus>?> ForStudentAsync(LmsDbContext db, CurrentUser user, IReadOnlyCollection<CourseworkRow> rows, DateTime now, CancellationToken ct)
    {
        if (user.IsInstructor) return null;
        var ids = rows.Where(r => r.Type == CourseworkType.Assignment).Select(r => r.Id).ToList();
        if (ids.Count == 0) return [];
        var mine = (await db.Submissions.AsNoTracking().Where(s => ids.Contains(s.CourseworkId) && s.StudentId == user.Id).ToListAsync(ct))
            .ToLookup(s => s.CourseworkId);
        return rows.Where(r => r.Type == CourseworkType.Assignment).ToDictionary(r => r.Id, r => Evaluate(r, mine[r.Id].ToList(), now));
    }
}
