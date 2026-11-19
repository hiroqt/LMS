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

    private static Submission Row(int number, string status, bool handedIn = true) =>
        new() { Id = number, AttemptNumber = number, Status = status, SubmittedAt = handedIn && status != SubmissionStatus.InProgress ? Before : null };

    [Fact]
    public void Nothing_handed_in_before_the_due_date_can_be_turned_in()
    {
        var verdict = AssignmentRules.Evaluate(Assignment(), [], Before);
        Assert.Equal(new TurnInStatus(TurnInState.Assigned, true, null, false), verdict);
    }

    [Fact]
    public void After_the_due_date_without_late_work_it_is_missing_and_refused()
    {
        Assert.Equal(new TurnInStatus(TurnInState.Missing, false, TurnInReason.PastDue, true), AssignmentRules.Evaluate(Assignment(), [], After));
    }

    [Fact]
    public void Late_work_is_accepted_and_marked_late_until_the_last_day()
    {
        var cw = Assignment(late: true, closeAt: Due.AddDays(2));
        Assert.Equal(new TurnInStatus(TurnInState.Missing, true, null, true), AssignmentRules.Evaluate(cw, [], After));
        Assert.Equal(new TurnInStatus(TurnInState.Missing, false, TurnInReason.PastClose, true), AssignmentRules.Evaluate(cw, [], Due.AddDays(2).AddSeconds(1)));
    }

    [Fact]
    public void A_draft_is_not_handed_in_work()
    {
        var verdict = AssignmentRules.Evaluate(Assignment(), [Row(1, SubmissionStatus.InProgress)], Before);
        Assert.Equal(new TurnInStatus(TurnInState.Draft, true, null, false), verdict);
    }

    [Fact]
    public void Handed_in_work_blocks_another_unless_resubmission_is_on()
    {
        Submission[] mine = [Row(1, SubmissionStatus.Submitted)];
        Assert.Equal(new TurnInStatus(TurnInState.TurnedIn, false, TurnInReason.AlreadyTurnedIn, false), AssignmentRules.Evaluate(Assignment(), mine, Before));
        Assert.Equal(new TurnInStatus(TurnInState.TurnedIn, true, null, false, CanUnsubmit: true), AssignmentRules.Evaluate(Assignment(again: true), mine, Before));
    }

    [Fact]
    public void Work_can_be_taken_back_only_before_the_due_date_while_resubmission_is_on_and_until_it_is_graded()
    {
        Submission[] waiting = [Row(1, SubmissionStatus.Submitted)];
        Assert.True(AssignmentRules.Evaluate(Assignment(again: true), waiting, Before).CanUnsubmit);
        Assert.False(AssignmentRules.Evaluate(Assignment(), waiting, Before).CanUnsubmit);
        Assert.False(AssignmentRules.Evaluate(Assignment(again: true, late: true), waiting, After).CanUnsubmit);
        Assert.False(AssignmentRules.Evaluate(Assignment(again: true, status: CourseworkStatus.Closed), waiting, Before).CanUnsubmit);
        Assert.False(AssignmentRules.Evaluate(Assignment(again: true), [], Before).CanUnsubmit);
        // A held grade looks like work waiting for one, but it still can't be taken back.
        Submission[] graded = [Row(1, SubmissionStatus.Graded)];
        var held = AssignmentRules.Evaluate(Assignment(again: true, release: GradeRelease.Returned), graded, Before);
        Assert.Equal((TurnInState.TurnedIn, false), (held.State, held.CanUnsubmit));
    }

    [Fact]
    public void A_version_taken_back_no_longer_counts_as_handed_in()
    {
        Submission[] takenBack = [Row(1, SubmissionStatus.Withdrawn), Row(2, SubmissionStatus.InProgress)];
        Assert.Equal(new TurnInStatus(TurnInState.Draft, true, null, false), AssignmentRules.Evaluate(Assignment(), takenBack, Before));
        // With the draft gone too (never happens through the API), it is as if nothing was handed in.
        Assert.Equal(TurnInState.Missing, AssignmentRules.Evaluate(Assignment(), [Row(1, SubmissionStatus.Withdrawn)], After).State);
    }

    [Fact]
    public void A_draft_after_earlier_work_keeps_the_earlier_state()
    {
        Submission[] mine = [Row(1, SubmissionStatus.Graded), Row(2, SubmissionStatus.InProgress)];
        Assert.Equal(TurnInState.Graded, AssignmentRules.Evaluate(Assignment(again: true), mine, Before).State);
    }

    [Fact]
    public void A_held_grade_looks_turned_in_until_it_is_returned()
    {
        var cw = Assignment(release: GradeRelease.Returned);
        Assert.Equal(TurnInState.TurnedIn, AssignmentRules.Evaluate(cw, [Row(1, SubmissionStatus.Graded)], Before).State);
        Assert.Equal(TurnInState.Returned, AssignmentRules.Evaluate(cw, [Row(1, SubmissionStatus.Returned)], Before).State);
        Assert.False(AssignmentRules.GradeVisibleToStudent(cw, Row(1, SubmissionStatus.Graded)));
        Assert.True(AssignmentRules.GradeVisibleToStudent(cw, Row(1, SubmissionStatus.Returned)));
        Assert.True(AssignmentRules.GradeVisibleToStudent(Assignment(), Row(1, SubmissionStatus.Graded)));
    }

    [Fact]
    public void Reasons_follow_the_contract_order()
    {
        // Closed wins over everything; then a "not handed in" grade; then work already handed in.
        Submission notHandedIn = new() { Id = 9, AttemptNumber = 1, Status = SubmissionStatus.Graded };
        Assert.Equal(TurnInReason.Closed, AssignmentRules.Evaluate(Assignment(status: CourseworkStatus.Closed), [notHandedIn], After).Reason);
        var graded = AssignmentRules.Evaluate(Assignment(), [notHandedIn], After);
        Assert.Equal((TurnInState.NotHandedIn, TurnInReason.NotHandedIn), (graded.State, graded.Reason));
        Assert.Equal(TurnInReason.AlreadyTurnedIn, AssignmentRules.Evaluate(Assignment(), [Row(1, SubmissionStatus.Submitted)], After).Reason);
    }

    [Fact]
    public void Every_reason_has_a_message()
    {
        foreach (var reason in new[] { TurnInReason.Closed, TurnInReason.NotHandedIn, TurnInReason.AlreadyTurnedIn, TurnInReason.PastClose, TurnInReason.PastDue })
            Assert.False(string.IsNullOrWhiteSpace(AssignmentRules.Message(reason, Assignment())));
    }
}
