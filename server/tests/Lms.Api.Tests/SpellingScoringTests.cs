using Lms.Api.Data;
using Lms.Api.Submissions;

namespace Lms.Api.Tests;

/// <summary>Contract §5: normalization, near misses, spelling modes and decisions, per question type.</summary>
public sealed class SpellingScoringTests
{
    private static ScoringKey Key(string type, decimal points, string[] expected, QuestionOption[]? options = null, bool alwaysStrict = false, bool caseSensitive = false) =>
        new(new Question { Id = 1, Type = type, Points = points, Prompt = "?", AlwaysStrict = alwaysStrict, CaseSensitive = caseSensitive }, options ?? [],
            expected.Select((e, i) => new QuestionExpectedAnswer { QuestionId = 1, AnswerText = e, SortOrder = i + 1 }).ToList());

    private static SubmissionAnswer Text(string text, string? decision = null) => new() { AnswerText = text, SpellingDecision = decision };
    private static SubmissionAnswer Items(params string[] items) => new() { AnswerText = Scoring.WriteItems(items) };

    // ------------------------------------------------------------------ normalize

    [Theory]
    [InlineData("  Charles   Babbage. ", "charles babbage")]
    [InlineData("Manila?!", "manila")]
    [InlineData("e.g. a, b", "e.g. a, b")]
    [InlineData("tab\tand\nnewline", "tab and newline")]
    [InlineData("", "")]
    public void Normalize_trims_collapses_drops_trailing_punctuation_and_lowercases(string input, string expected) =>
        Assert.Equal(expected, Spelling.Normalize(input));

    [Fact]
    public void Normalize_uses_NFC_and_keeps_case_when_asked()
    {
        var decomposed = "Piña";            // n + combining tilde
        Assert.Equal("piña", Spelling.Normalize(decomposed));
        Assert.Equal("CO", Spelling.Normalize(" CO. ", caseSensitive: true));
    }

    // ------------------------------------------------------------------ near misses

    [Theory]
    [InlineData("babage", "babbage", true)]      // one deletion, length 7
    [InlineData("babbgae", "babbage", true)]     // one swap of neighbours
    [InlineData("bobbaje", "babbage", false)]    // two edits at length 7
    [InlineData("photosynthesys", "photosynthesis", true)]
    [InlineData("fotosynthesis", "photosynthesis", true)]    // two edits at length 14
    [InlineData("fotosynthesys", "photosynthesis", false)]   // three edits
    [InlineData("pina", "piña", true)]           // accents only
    [InlineData("cat", "car", false)]            // three characters or fewer
    [InlineData("cpuu", "cpu", false)]           // accepted answer is three characters
    [InlineData("1945x", "1945", false)]         // digits
    [InlineData("route66", "route67", false)]
    [InlineData("manila", "manila", false)]      // equal is exact, not near
    public void Near_misses_follow_the_length_rules(string given, string accepted, bool near) =>
        Assert.Equal(near, Spelling.IsNearMiss(given, accepted));

    [Fact]
    public void Distance_counts_a_neighbour_swap_as_one_edit()
    {
        Assert.Equal(1, Spelling.Distance("abcd", "abdc"));
        Assert.Equal(3, Spelling.Distance("kitten", "sitting"));
        Assert.Equal(0, Spelling.Distance("", ""));
    }

    // ------------------------------------------------------------------ identification

    [Fact]
    public void Identification_accepts_any_answer_exactly_in_every_mode()
    {
        var key = Key(QuestionType.Identification, 2, ["Charles Babbage", "Babbage"]);
        foreach (var mode in SpellingMode.All)
        {
            Assert.Equal(new ScoreResult(2, MatchNote.Exact), Scoring.Evaluate(key, Text("babbage."), mode));
            Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, Text("Pascal"), mode));
            Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, null, mode));
        }
    }

    [Fact]
    public void Identification_near_miss_depends_on_the_spelling_mode()
    {
        var key = Key(QuestionType.Identification, 2, ["Babbage"]);
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, Text("Babage"), SpellingMode.Strict));
        Assert.Equal(new ScoreResult(2, MatchNote.Typo), Scoring.Evaluate(key, Text("Babage"), SpellingMode.Typos));
        Assert.Equal(new ScoreResult(null, MatchNote.Review), Scoring.Evaluate(key, Text("Babage"), SpellingMode.Review));
    }

    [Fact]
    public void A_spelling_decision_makes_a_near_miss_right_or_wrong()
    {
        var key = Key(QuestionType.Identification, 2, ["Babbage"]);
        Assert.Equal(new ScoreResult(2, MatchNote.Review), Scoring.Evaluate(key, Text("Babage", SpellingDecision.Accepted), SpellingMode.Review));
        Assert.Equal(new ScoreResult(0, MatchNote.Review), Scoring.Evaluate(key, Text("Babage", SpellingDecision.Rejected), SpellingMode.Review));
        Assert.Equal(new ScoreResult(0, MatchNote.Typo), Scoring.Evaluate(key, Text("Babage", SpellingDecision.Rejected), SpellingMode.Typos));
        // A decision never changes an exact match.
        Assert.Equal(new ScoreResult(2, MatchNote.Exact), Scoring.Evaluate(key, Text("Babbage", SpellingDecision.Rejected), SpellingMode.Review));
    }

    [Fact]
    public void Always_strict_and_case_sensitive_questions_ignore_the_typo_setting()
    {
        var strict = Key(QuestionType.Identification, 1, ["Babbage"], alwaysStrict: true);
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(strict, Text("Babage"), SpellingMode.Typos));

        var cased = Key(QuestionType.Identification, 1, ["CO"], caseSensitive: true);
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(cased, Text("Co"), SpellingMode.Typos));
        Assert.Equal(new ScoreResult(1, MatchNote.Exact), Scoring.Evaluate(cased, Text("CO"), SpellingMode.Typos));
        Assert.Equal(new ScoreResult(1, MatchNote.Exact), Scoring.Evaluate(Key(QuestionType.Identification, 1, ["CO"]), Text("co"), SpellingMode.Strict));
    }

    [Fact]
    public void Accents_count_as_a_near_miss()
    {
        var key = Key(QuestionType.Identification, 1, ["Piña"]);
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, Text("Pina"), SpellingMode.Strict));
        Assert.Equal(new ScoreResult(1, MatchNote.Typo), Scoring.Evaluate(key, Text("Pina"), SpellingMode.Typos));
    }

    // ------------------------------------------------------------------ enumeration

    [Fact]
    public void Enumeration_counts_each_accepted_item_once_and_notes_the_worst_match()
    {
        var key = Key(QuestionType.Enumeration, 3, ["Red", "Green", "Blue"]);
        Assert.Equal(new ScoreResult(3, MatchNote.Exact), Scoring.Evaluate(key, Items("blue", "RED", "green."), SpellingMode.Strict));
        Assert.Equal(new ScoreResult(1, MatchNote.Exact), Scoring.Evaluate(key, Items("red", "red", "yellow"), SpellingMode.Typos));
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, Items("yellow"), SpellingMode.Typos));

        Assert.Equal(new ScoreResult(2, MatchNote.Exact), Scoring.Evaluate(key, Items("red", "gren", "blue"), SpellingMode.Strict));
        Assert.Equal(new ScoreResult(3, MatchNote.Typo), Scoring.Evaluate(key, Items("red", "gren", "blue"), SpellingMode.Typos));
        Assert.Equal(new ScoreResult(null, MatchNote.Review), Scoring.Evaluate(key, Items("red", "gren", "blue"), SpellingMode.Review));
        Assert.Equal(new ScoreResult(2, MatchNote.Review), Scoring.Evaluate(key, new SubmissionAnswer { AnswerText = Scoring.WriteItems(["red", "gren", "blue"]), SpellingDecision = SpellingDecision.Rejected }, SpellingMode.Review));
    }

    [Fact]
    public void Enumeration_prefers_exact_matches_before_near_misses()
    {
        // "green" takes "Green" exactly, so the near miss "grees" counts for "Greed";
        // "grean" is near "Green" only, which is already taken, so it counts for nothing.
        var key = Key(QuestionType.Enumeration, 2, ["Green", "Greed"]);
        Assert.Equal(new ScoreResult(2, MatchNote.Typo), Scoring.Evaluate(key, Items("green", "grees"), SpellingMode.Typos));
        Assert.Equal(new ScoreResult(1, MatchNote.Exact), Scoring.Evaluate(Key(QuestionType.Enumeration, 2, ["Green", "Purple"]), Items("green", "grean"), SpellingMode.Typos));
    }

    // ------------------------------------------------------------------ modified true or false

    private static readonly QuestionOption[] FalseIsRight = [new() { Id = 1, Text = "True", SortOrder = 1 }, new() { Id = 2, Text = "False", IsCorrect = true, SortOrder = 2 }];
    private static readonly QuestionOption[] TrueIsRight = [new() { Id = 1, Text = "True", IsCorrect = true, SortOrder = 1 }, new() { Id = 2, Text = "False", SortOrder = 2 }];

    [Fact]
    public void Modified_true_or_false_needs_a_matching_correction_when_false()
    {
        var key = Key(QuestionType.ModifiedTrueFalse, 2, ["storage", "hard disk"], FalseIsRight);
        Assert.Equal(new ScoreResult(2, MatchNote.Exact), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 2, AnswerText = "Hard disk" }, SpellingMode.Strict));
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 2, AnswerText = "RAM" }, SpellingMode.Strict));
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 2 }, SpellingMode.Strict));
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 1 }, SpellingMode.Strict));
        Assert.Equal(new ScoreResult(2, MatchNote.Typo), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 2, AnswerText = "storgae" }, SpellingMode.Typos));
        Assert.Equal(new ScoreResult(null, MatchNote.Review), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 2, AnswerText = "storgae" }, SpellingMode.Review));
    }

    [Fact]
    public void Modified_true_or_false_gives_full_points_for_true_on_a_true_statement()
    {
        var key = Key(QuestionType.ModifiedTrueFalse, 2, [], TrueIsRight);
        Assert.Equal(new ScoreResult(2, null), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 1, AnswerText = "ignored" }, SpellingMode.Strict));
        Assert.Equal(new ScoreResult(0, null), Scoring.Evaluate(key, new SubmissionAnswer { SelectedOptionId = 2, AnswerText = "anything" }, SpellingMode.Typos));
    }

    // ------------------------------------------------------------------ other types unchanged

    [Fact]
    public void Choice_matching_and_essay_ignore_the_spelling_mode()
    {
        QuestionOption[] choices = [new() { Id = 10 }, new() { Id = 11, IsCorrect = true }];
        Assert.Equal(new ScoreResult(1, null), Scoring.Evaluate(Key(QuestionType.MultipleChoice, 1, [], choices), new SubmissionAnswer { SelectedOptionId = 11 }, SpellingMode.Review));
        Assert.Equal(new ScoreResult(null, null), Scoring.Evaluate(Key(QuestionType.Essay, 5, []), Text("…"), SpellingMode.Typos));
        QuestionOption[] lefts = [new() { Id = 21, SortOrder = 1 }, new() { Id = 22, SortOrder = 2 }];
        var matching = Key(QuestionType.Matching, 2, ["read", "remove"], lefts);
        Assert.Equal(new ScoreResult(1, null), Scoring.Evaluate(matching, new SubmissionAnswer { AnswerText = Scoring.WriteMatches(new Dictionary<long, string> { [21] = "Read", [22] = "reed" }) }, SpellingMode.Typos));
    }

    [Fact]
    public void Points_are_rounded_to_two_decimals()
    {
        var key = Key(QuestionType.Enumeration, 1, ["a1", "b2", "c3"]);
        Assert.Equal(0.33m, Scoring.Evaluate(key, Items("a1"), SpellingMode.Typos).Points);
    }
}
