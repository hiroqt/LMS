using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>A student's standing on one assignment (contract §2, §11).</summary>
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
    /// <summary>The instructor excused the student: nothing to hand in, and it doesn't count (D-062).</summary>
    public const string Excused = "excused";
}

/// <summary>Why a student can't turn work in now, in the order they are checked.</summary>
public static class TurnInReason
{
    public const string Closed = "closed";
    public const string Excused = "excused";
    public const string NotHandedIn = "not_handed_in";
    public const string AlreadyTurnedIn = "already_turned_in";
    public const string PastClose = "past_close";
    public const string PastDue = "past_due";
}

/// <param name="Late">Handing in now would be late.</param>
/// <param name="CanUnsubmit">The latest turned-in work can be taken back now (contract §7).</param>
/// <param name="DueAt">This student's due date: their own when they have one, otherwise the assignment's (contract §11).</param>
/// <param name="CloseAt">This student's last day for late work.</param>
/// <param name="Extended">The dates are the student's own, not the class's.</param>
public sealed record TurnInStatus(string State, bool CanTurnIn, string? Reason, bool Late, bool CanUnsubmit = false,
    DateTime? DueAt = null, DateTime? CloseAt = null, bool Extended = false);

/// <summary>
/// The dates that apply to one student for one assignment (D-062): the class's, or their own from
/// a <see cref="CourseworkException"/>. <b>An exception gives a student more time, never less:</b>
/// their due date applies only while it is after the class's (the class's may have been moved
/// past it since), and their last day is never before the class's last day or their own due date.
/// When the class accepts late work with no last day, neither has the student one.
/// </summary>
public readonly record struct StudentDates(DateTime? DueAt, DateTime? CloseAt, bool Extended, bool Excused)
{
    public static StudentDates For(CourseworkRow cw, CourseworkException? exception)
    {
        var excused = exception?.Excused == true;
        if (cw.DueAt is not { } classDue || exception?.DueAt is not { } own || own <= classDue) return new(cw.DueAt, cw.CloseAt, false, excused);
        DateTime? close = cw.CloseAt is { } classClose ? Later(Later(exception.CloseAt ?? own, classClose), own) : null;
        return new(own, close, true, excused);
    }

    private static DateTime Later(DateTime a, DateTime b) => a > b ? a : b;

    /// <summary>When this student stops handing in for good: their last day for late work, otherwise their due date.</summary>
    public DateTime? LastDay => CloseAt ?? DueAt;
}

/// <summary>
/// The one place that decides whether a student can turn in an assignment (D-054). The turn-in
/// endpoint enforces it, and students receive it as <c>turnIn</c>, so the browser never works the
/// rules out itself.
/// </summary>
public static class AssignmentRules
{
    /// <param name="mine">Every submission row of this student for this assignment, drafts included.</param>
    /// <param name="exception">This student's own dates or excuse for the assignment, when they have one.</param>
    public static TurnInStatus Evaluate(CourseworkRow cw, IReadOnlyCollection<Submission> mine, DateTime now, CourseworkException? exception = null)
    {
        var dates = StudentDates.For(cw, exception);
        var handedIn = mine.Where(GradingRules.IsHandedIn).ToList();
        var notHandedIn = handedIn.Any(GradingRules.IsNotHandedIn);
        var latest = handedIn.Where(s => !GradingRules.IsNotHandedIn(s)).MaxBy(s => s.AttemptNumber);
        var pastDue = dates.DueAt is { } due && now > due;

        var state = dates.Excused ? TurnInState.Excused
            : notHandedIn ? TurnInState.NotHandedIn
            : latest is not null ? StateOf(cw, latest)
            : mine.Any(s => s.Status == SubmissionStatus.InProgress) ? TurnInState.Draft
            : pastDue ? TurnInState.Missing
            : TurnInState.Assigned;

        string? reason =
            cw.Status == CourseworkStatus.Closed ? TurnInReason.Closed
            : dates.Excused ? TurnInReason.Excused
            : notHandedIn ? TurnInReason.NotHandedIn
            : latest is not null && !cw.AllowResubmission ? TurnInReason.AlreadyTurnedIn
            : dates.CloseAt is { } close && now > close ? TurnInReason.PastClose
            : pastDue && !cw.AllowLate ? TurnInReason.PastDue
            : null;

        // Taking work back: before the due date, while resubmission is on, and only until it has a grade (D-058).
        var canUnsubmit = cw.Status == CourseworkStatus.Published && cw.AllowResubmission && !pastDue && !notHandedIn && !dates.Excused
            && latest is { Status: SubmissionStatus.Submitted };

        return new TurnInStatus(state, reason is null, reason, pastDue, canUnsubmit, dates.DueAt, dates.CloseAt, dates.Extended);
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
        TurnInReason.Excused => "Your instructor excused you from this assignment.",
        TurnInReason.NotHandedIn => "Your instructor has already recorded a grade for this assignment without a submission.",
        TurnInReason.AlreadyTurnedIn => "You have already handed this in, and resubmission is not allowed.",
        TurnInReason.PastClose => "This assignment no longer accepts late work.",
        TurnInReason.PastDue => "This assignment is past its due date and does not accept late work.",
        _ => throw new ArgumentOutOfRangeException(nameof(reason), reason, $"No message for {cw.Title}."),
    };

    /// <summary>When the class stops handing in for good: the last day for late work, otherwise the due date. A student with their own dates has their own (<see cref="StudentDates.LastDay"/>).</summary>
    public static DateTime? LastDay(CourseworkRow cw) => cw.CloseAt ?? cw.DueAt;

    /// <summary>One student's own dates or excuse for one assignment, when they have one.</summary>
    public static Task<CourseworkException?> ExceptionAsync(LmsDbContext db, long courseworkId, string studentId, CancellationToken ct) =>
        db.CourseworkExceptions.AsNoTracking().SingleOrDefaultAsync(e => e.CourseworkId == courseworkId && e.StudentId == studentId, ct);

    /// <summary>The verdict on each assignment for a student; null for instructors, and no entry for exams.</summary>
    public static async Task<Dictionary<long, TurnInStatus>?> ForStudentAsync(LmsDbContext db, CurrentUser user, IReadOnlyCollection<CourseworkRow> rows, DateTime now, CancellationToken ct)
    {
        if (user.IsInstructor) return null;
        var ids = rows.Where(r => r.Type == CourseworkType.Assignment).Select(r => r.Id).ToList();
        if (ids.Count == 0) return [];
        var mine = (await db.Submissions.AsNoTracking().Where(s => ids.Contains(s.CourseworkId) && s.StudentId == user.Id).ToListAsync(ct))
            .ToLookup(s => s.CourseworkId);
        var exceptions = await db.CourseworkExceptions.AsNoTracking().Where(e => ids.Contains(e.CourseworkId) && e.StudentId == user.Id).ToDictionaryAsync(e => e.CourseworkId, ct);
        return rows.Where(r => r.Type == CourseworkType.Assignment).ToDictionary(r => r.Id, r => Evaluate(r, mine[r.Id].ToList(), now, exceptions.GetValueOrDefault(r.Id)));
    }
}

/// <summary>
/// Late penalties (D-062, contract §10). Worked out whenever a grade is read, from the
/// assignment's settings, the student's due date and when the work was turned in; the grade row
/// keeps the instructor's raw points and whether the penalty is waived.
/// </summary>
public static class LatePenalty
{
    /// <summary>Calendar days are counted in the school's time zone (<c>Lms:TimeZone</c>), set once at startup.</summary>
    public static TimeZoneInfo Zone { get; set; } = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

    /// <summary>The date turned in minus the date due, and at least 1 for any late work; 0 when on time or never turned in.</summary>
    public static int DaysLate(DateTime? dueUtc, DateTime? submittedUtc)
    {
        if (dueUtc is not { } due || submittedUtc is not { } submitted || submitted <= due) return 0;
        var days = LocalDate(submitted).DayNumber - LocalDate(due).DayNumber;
        return Math.Max(1, days);
    }

    private static DateOnly LocalDate(DateTime utc) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone));

    /// <summary>The percent taken off: per day late, up to the cap; 0 when waived, on time, or the assignment has no penalty.</summary>
    public static decimal Percent(CourseworkRow cw, int daysLate, bool waived) =>
        waived || daysLate <= 0 || cw.Type != CourseworkType.Assignment || cw.LatePenaltyPercentPerDay <= 0
            ? 0
            : Math.Min((decimal)cw.LatePenaltyPercentPerDay * daysLate, Math.Clamp(cw.LatePenaltyMaxPercent, 1, 100));

    public static decimal Apply(decimal points, decimal percent) => Math.Round(points * (100 - percent) / 100, 2, MidpointRounding.AwayFromZero);
}
