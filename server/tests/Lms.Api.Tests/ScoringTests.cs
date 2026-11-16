using Lms.Api.Data;
using Lms.Api.Submissions;

namespace Lms.Api.Tests;

public sealed class ScoringTests
{
    private static ScoringKey Key(string type, decimal points, QuestionOption[]? options = null, string[]? expected = null) =>
        new(new Question { Id = 1, Type = type, Points = points, Prompt = "?" }, options ?? [],
            (expected ?? []).Select((e, i) => new QuestionExpectedAnswer { QuestionId = 1, AnswerText = e, SortOrder = i + 1 }).ToList());

    private static readonly QuestionOption[] Choices = [new() { Id = 10, IsCorrect = false }, new() { Id = 11, IsCorrect = true }];

    [Fact]
    public void Multiple_choice_is_all_or_nothing()
    {
        Assert.Equal(2m, Scoring.Score(Key(QuestionType.MultipleChoice, 2, Choices), new SubmissionAnswer { SelectedOptionId = 11 }));
        Assert.Equal(0m, Scoring.Score(Key(QuestionType.MultipleChoice, 2, Choices), new SubmissionAnswer { SelectedOptionId = 10 }));
        Assert.Equal(0m, Scoring.Score(Key(QuestionType.TrueFalse, 1, Choices), null));
    }

    [Fact]
    public void Enumeration_ignores_case_order_spacing_and_duplicates()
    {
        var key = Key(QuestionType.Enumeration, 3, expected: ["Inner join", "Left join", "Right join"]);
        Assert.Equal(3m, Scoring.Score(key, new SubmissionAnswer { AnswerText = Scoring.WriteItems(["right JOIN", " inner   join ", "Left join"]) }));
        Assert.Equal(1m, Scoring.Score(key, new SubmissionAnswer { AnswerText = Scoring.WriteItems(["inner join", "INNER JOIN", "cross join"]) }));
        Assert.Equal(0.67m, Scoring.Score(Key(QuestionType.Enumeration, 1, expected: ["a", "b", "c"]), new SubmissionAnswer { AnswerText = Scoring.WriteItems(["a", "b"]) }));
    }

    [Fact]
    public void Matching_counts_correct_pairs()
    {
        QuestionOption[] lefts = [new() { Id = 21, SortOrder = 1 }, new() { Id = 22, SortOrder = 2 }];
        var key = Key(QuestionType.Matching, 2, lefts, ["read", "remove"]);
        var half = Scoring.WriteMatches(new Dictionary<long, string> { [21] = "Read", [22] = "read" });
        Assert.Equal(1m, Scoring.Score(key, new SubmissionAnswer { AnswerText = half }));
        Assert.Equal(2m, Scoring.Score(key, new SubmissionAnswer { AnswerText = Scoring.WriteMatches(new Dictionary<long, string> { [21] = "read", [22] = "remove" }) }));
    }

    [Fact]
    public void Essays_wait_for_the_instructor_and_garbage_scores_zero()
    {
        Assert.Null(Scoring.Score(Key(QuestionType.Essay, 5), new SubmissionAnswer { AnswerText = "Normal forms…" }));
        Assert.Equal(0m, Scoring.Score(Key(QuestionType.Enumeration, 2, expected: ["a"]), new SubmissionAnswer { AnswerText = "{not json" }));
    }
}
