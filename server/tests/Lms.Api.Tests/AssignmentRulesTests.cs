using Lms.Api.Data;
using Lms.Api.Submissions;

namespace Lms.Api.Tests;

/// <summary>The turn-in rules of D-054 (contract §2), without the database.</summary>
public sealed class AssignmentRulesTests
{
    private static readonly DateTime Due = new(2026, 11, 20, 15, 59, 0, DateTimeKind.Utc);
    private static readonly DateTime Before = Due.AddHours(-1);
    private static readonly DateTime After = Due.AddHours(1);

    private static Data.Coursework Assignment(bool late = false, bool again = false, DateTime? closeAt = null, string status = CourseworkStatus.Published, string release = GradeRelease.Immediate) =>
        new() { Id = 1, Type = CourseworkType.Assignment, Title = "ER diagram", DueAt = Due, AllowLate = late, AllowResubmission = again, CloseAt = closeAt, Status = status, GradeRelease = release };

    /// <summary>The verdict without the student's dates, which have their own tests below.</summary>
    private static TurnInStatus Evaluate(Data.Coursework cw, IReadOnlyCollection<Submission> mine, DateTime now) =>
        AssignmentRules.Evaluate(cw, mine, now) with { DueAt = null, CloseAt = null };

    private static Submission Row(int number, string status, bool handedIn = true) =>
        new() { Id = number, AttemptNumber = number, Status = status, SubmittedAt = handedIn && status != SubmissionStatus.InProgress ? Before : null };

    [Fact]
    public void Nothing_handed_in_before_the_due_date_can_be_turned_in()
    {
        var verdict = Evaluate(Assignment(), [], Before);
        Assert.Equal(new TurnInStatus(TurnInState.Assigned, true, null, false), verdict);
    }

    [Fact]
    public void After_the_due_date_without_late_work_it_is_missing_and_refused()
    {
        Assert.Equal(new TurnInStatus(TurnInState.Missing, false, TurnInReason.PastDue, true), Evaluate(Assignment(), [], After));
    }

    [Fact]
    public void Late_work_is_accepted_and_marked_late_until_the_last_day()
    {
        var cw = Assignment(late: true, closeAt: Due.AddDays(2));
        Assert.Equal(new TurnInStatus(TurnInState.Missing, true, null, true), Evaluate(cw, [], After));
        Assert.Equal(new TurnInStatus(TurnInState.Missing, false, TurnInReason.PastClose, true), Evaluate(cw, [], Due.AddDays(2).AddSeconds(1)));
    }

    [Fact]
    public void A_draft_is_not_handed_in_work()
    {
        var verdict = Evaluate(Assignment(), [Row(1, SubmissionStatus.InProgress)], Before);
        Assert.Equal(new TurnInStatus(TurnInState.Draft, true, null, false), verdict);
    }

    [Fact]
    public void Handed_in_work_blocks_another_unless_resubmission_is_on()
    {
        Submission[] mine = [Row(1, SubmissionStatus.Submitted)];
        Assert.Equal(new TurnInStatus(TurnInState.TurnedIn, false, TurnInReason.AlreadyTurnedIn, false), Evaluate(Assignment(), mine, Before));
        Assert.Equal(new TurnInStatus(TurnInState.TurnedIn, true, null, false, CanUnsubmit: true), Evaluate(Assignment(again: true), mine, Before));
    }

    [Fact]
    public void Work_can_be_taken_back_only_before_the_due_date_while_resubmission_is_on_and_until_it_is_graded()
    {
        Submission[] waiting = [Row(1, SubmissionStatus.Submitted)];
        Assert.True(Evaluate(Assignment(again: true), waiting, Before).CanUnsubmit);
        Assert.False(Evaluate(Assignment(), waiting, Before).CanUnsubmit);
        Assert.False(Evaluate(Assignment(again: true, late: true), waiting, After).CanUnsubmit);
        Assert.False(Evaluate(Assignment(again: true, status: CourseworkStatus.Closed), waiting, Before).CanUnsubmit);
        Assert.False(Evaluate(Assignment(again: true), [], Before).CanUnsubmit);
        // A held grade looks like work waiting for one, but it still can't be taken back.
        Submission[] graded = [Row(1, SubmissionStatus.Graded)];
        var held = Evaluate(Assignment(again: true, release: GradeRelease.Returned), graded, Before);
        Assert.Equal((TurnInState.TurnedIn, false), (held.State, held.CanUnsubmit));
    }

    [Fact]
    public void A_version_taken_back_no_longer_counts_as_handed_in()
    {
        Submission[] takenBack = [Row(1, SubmissionStatus.Withdrawn), Row(2, SubmissionStatus.InProgress)];
        Assert.Equal(new TurnInStatus(TurnInState.Draft, true, null, false), Evaluate(Assignment(), takenBack, Before));
        // With the draft gone too (never happens through the API), it is as if nothing was handed in.
        Assert.Equal(TurnInState.Missing, Evaluate(Assignment(), [Row(1, SubmissionStatus.Withdrawn)], After).State);
    }

    [Fact]
    public void A_draft_after_earlier_work_keeps_the_earlier_state()
    {
        Submission[] mine = [Row(1, SubmissionStatus.Graded), Row(2, SubmissionStatus.InProgress)];
        Assert.Equal(TurnInState.Graded, Evaluate(Assignment(again: true), mine, Before).State);
    }

    [Fact]
    public void A_held_grade_looks_turned_in_until_it_is_returned()
    {
        var cw = Assignment(release: GradeRelease.Returned);
        Assert.Equal(TurnInState.TurnedIn, Evaluate(cw, [Row(1, SubmissionStatus.Graded)], Before).State);
        Assert.Equal(TurnInState.Returned, Evaluate(cw, [Row(1, SubmissionStatus.Returned)], Before).State);
        Assert.False(AssignmentRules.GradeVisibleToStudent(cw, Row(1, SubmissionStatus.Graded)));
        Assert.True(AssignmentRules.GradeVisibleToStudent(cw, Row(1, SubmissionStatus.Returned)));
        Assert.True(AssignmentRules.GradeVisibleToStudent(Assignment(), Row(1, SubmissionStatus.Graded)));
    }

    [Fact]
    public void Reasons_follow_the_contract_order()
    {
        // Closed wins over everything; then a "not handed in" grade; then work already handed in.
        Submission notHandedIn = new() { Id = 9, AttemptNumber = 1, Status = SubmissionStatus.Graded };
        Assert.Equal(TurnInReason.Closed, Evaluate(Assignment(status: CourseworkStatus.Closed), [notHandedIn], After).Reason);
        var graded = Evaluate(Assignment(), [notHandedIn], After);
        Assert.Equal((TurnInState.NotHandedIn, TurnInReason.NotHandedIn), (graded.State, graded.Reason));
        Assert.Equal(TurnInReason.AlreadyTurnedIn, Evaluate(Assignment(), [Row(1, SubmissionStatus.Submitted)], After).Reason);
    }

    [Fact]
    public void Every_reason_has_a_message()
    {
        foreach (var reason in new[] { TurnInReason.Closed, TurnInReason.NotHandedIn, TurnInReason.AlreadyTurnedIn, TurnInReason.PastClose, TurnInReason.PastDue })
            Assert.False(string.IsNullOrWhiteSpace(AssignmentRules.Message(reason, Assignment())));
    }

    // ------------------------------------------------------------------------- a student's own dates and excused work (D-062)

    [Fact]
    public void The_verdict_carries_the_dates_that_apply_to_the_student()
    {
        var plain = AssignmentRules.Evaluate(Assignment(late: true, closeAt: Due.AddDays(2)), [], Before);
        Assert.Equal((Due, Due.AddDays(2), false), (plain.DueAt, plain.CloseAt, plain.Extended));
    }

    [Fact]
    public void An_extension_moves_the_students_due_date_and_last_day()
    {
        var cw = Assignment();
        var extension = new CourseworkException { DueAt = Due.AddDays(3) };
        // Past the class's due date but before the student's own: on time, and work can still be taken back.
        var verdict = AssignmentRules.Evaluate(cw, [], After, extension);
        Assert.Equal((TurnInState.Assigned, true, false, true, Due.AddDays(3)), (verdict.State, verdict.CanTurnIn, verdict.Late, verdict.Extended, verdict.DueAt));
        Assert.True(AssignmentRules.Evaluate(Assignment(again: true), [Row(1, SubmissionStatus.Submitted)], After, extension).CanUnsubmit);
        // After their own due date, with no late work, it is past due for them too.
        Assert.Equal(TurnInReason.PastDue, AssignmentRules.Evaluate(cw, [], Due.AddDays(3).AddMinutes(1), extension).Reason);
    }

    [Fact]
    public void A_students_last_day_is_their_own_or_never_before_their_due_date()
    {
        var cw = Assignment(late: true, closeAt: Due.AddDays(1));
        // Their due date is after the class's last day, and they have no last day of their own: it ends with their due date.
        var later = StudentDates.For(cw, new CourseworkException { DueAt = Due.AddDays(3) });
        Assert.Equal((Due.AddDays(3), Due.AddDays(3)), (later.DueAt, later.CloseAt));
        // Their due date is before the class's last day: the class's last day still applies.
        Assert.Equal(Due.AddDays(1), StudentDates.For(cw, new CourseworkException { DueAt = Due.AddHours(2) }).CloseAt);
        // Their own last day wins.
        Assert.Equal(Due.AddDays(5), StudentDates.For(cw, new CourseworkException { DueAt = Due.AddDays(3), CloseAt = Due.AddDays(5) }).CloseAt);
        // Late work with no last day stays open-ended.
        Assert.Null(StudentDates.For(Assignment(late: true), new CourseworkException { DueAt = Due.AddDays(3) }).CloseAt);
        Assert.Equal(TurnInReason.PastClose, AssignmentRules.Evaluate(cw, [], Due.AddDays(3).AddMinutes(1), new CourseworkException { DueAt = Due.AddDays(3) }).Reason);
    }

    [Fact]
    public void An_excused_student_has_nothing_to_hand_in()
    {
        var excused = new CourseworkException { Excused = true };
        var verdict = AssignmentRules.Evaluate(Assignment(again: true), [Row(1, SubmissionStatus.Submitted)], Before, excused);
        Assert.Equal((TurnInState.Excused, false, TurnInReason.Excused, false), (verdict.State, verdict.CanTurnIn, verdict.Reason, verdict.CanUnsubmit));
        Assert.Contains("excused", AssignmentRules.Message(TurnInReason.Excused, Assignment()));
        // A closed assignment says closed first.
        Assert.Equal(TurnInReason.Closed, AssignmentRules.Evaluate(Assignment(status: CourseworkStatus.Closed), [], Before, excused).Reason);
    }

    // ------------------------------------------------------------------------- late penalties (D-062)

    // Due 2026-11-20 15:59 UTC, which is 23:59 on Nov 20 in Manila.
    [Theory]
    [InlineData(-1, 0)]            // on time
    [InlineData(0, 0)]             // exactly at the due moment
    [InlineData(1, 1)]             // a minute late is already Nov 21 in Manila: 1 day
    [InlineData(60 * 24, 1)]       // 23:59 on Nov 21: still 1 day
    [InlineData(60 * 24 + 1, 2)]   // 00:00 on Nov 22: 2 days
    [InlineData(60 * 24 * 9 + 5, 10)]
    public void Days_late_are_calendar_days_in_Manila(int minutesAfterDue, int expected) =>
        Assert.Equal(expected, LatePenalty.DaysLate(Due, Due.AddMinutes(minutesAfterDue)));

    [Fact]
    public void Late_on_the_due_date_itself_is_one_day()
    {
        // Due at 16:00 Manila (08:00 UTC); turned in at 18:00 the same day.
        var due = new DateTime(2026, 11, 20, 8, 0, 0, DateTimeKind.Utc);
        Assert.Equal(1, LatePenalty.DaysLate(due, due.AddHours(2)));
        Assert.Equal(1, LatePenalty.DaysLate(due, due.AddHours(20)));  // 12:00 the next day
        Assert.Equal(2, LatePenalty.DaysLate(due, due.AddHours(40)));
        Assert.Equal(0, LatePenalty.DaysLate(null, due));
        Assert.Equal(0, LatePenalty.DaysLate(due, null));
    }

    [Fact]
    public void The_penalty_is_per_day_up_to_the_cap_and_can_be_waived()
    {
        var cw = Assignment(late: true);
        cw.LatePenaltyPercentPerDay = 10;
        cw.LatePenaltyMaxPercent = 25;
        Assert.Equal(0, LatePenalty.Percent(cw, 0, waived: false));
        Assert.Equal(10, LatePenalty.Percent(cw, 1, waived: false));
        Assert.Equal(25, LatePenalty.Percent(cw, 3, waived: false));
        Assert.Equal(0, LatePenalty.Percent(cw, 3, waived: true));
        Assert.Equal(0, LatePenalty.Percent(Assignment(late: true), 3, waived: false));
        Assert.Equal(13.5m, LatePenalty.Apply(18, 25));
        Assert.Equal(16.67m, LatePenalty.Apply(18.52m, 10));
        Assert.Equal(20, LatePenalty.Apply(20, 0));
    }
}
