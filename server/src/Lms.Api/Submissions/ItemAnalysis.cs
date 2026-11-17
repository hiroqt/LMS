using Lms.Api.Data;

namespace Lms.Api.Submissions;

public sealed record TopAnswer(string Answer, int Count, bool IsKey);

/// <param name="CorrectRate">0–1: the share of handed-in attempts with full points.</param>
/// <param name="Flag">"check_key" when at least 3 attempts answered and one wrong answer was given by at least half of them.</param>
public sealed record ItemAnalysisRow(long QuestionId, int Number, string Type, string Prompt, decimal Points, int Answered,
    decimal CorrectRate, decimal AveragePoints, IReadOnlyList<TopAnswer> TopAnswers, string? Flag);

/// <summary>Per-question statistics over handed-in attempts (contract §6). Pure: no database.</summary>
public static class ItemAnalysis
{
    public const string CheckKey = "check_key";

    /// <param name="answers">The answers of the handed-in attempts.</param>
    /// <param name="attempts">How many attempts were handed in.</param>
    /// <param name="anonymized">Attempts whose answer text retention cleared: they keep their points but list no typed answers.</param>
    public static List<ItemAnalysisRow> Compute(IReadOnlyList<ScoringKey> keys, IReadOnlyList<SubmissionAnswer> answers, int attempts, IReadOnlySet<long>? anonymized = null) =>
        keys.OrderBy(k => k.Question.SortOrder).Select(k =>
        {
            var q = k.Question;
            var mine = answers.Where(a => a.QuestionId == q.Id).ToList();
            var given = mine.Where(a => HasAnswer(q.Type, a)).ToList();
            var scored = mine.Where(a => a.PointsAwarded is not null).Select(a => a.PointsAwarded!.Value).ToList();
            var correct = q.Points > 0 ? mine.Count(a => a.PointsAwarded >= q.Points) : 0;
            var listed = q.Type is QuestionType.MultipleChoice or QuestionType.TrueFalse || anonymized is null
                ? given : given.Where(a => !anonymized.Contains(a.SubmissionId)).ToList();
            var top = Top(k, listed);
            var flag = listed.Count >= 3 && top.Any(t => !t.IsKey && t.Count * 2 >= listed.Count) ? CheckKey : null;
            return new ItemAnalysisRow(q.Id, q.SortOrder, q.Type, q.Prompt, q.Points, given.Count,
                attempts == 0 ? 0 : Math.Round((decimal)correct / attempts, 4),
                scored.Count == 0 ? 0 : Math.Round(scored.Sum() / scored.Count, 2),
                top.Take(3).ToList(), flag);
        }).ToList();

    private static bool HasAnswer(string type, SubmissionAnswer a) => type switch
    {
        QuestionType.Enumeration => Scoring.ReadItems(a.AnswerText).Count > 0,
        QuestionType.Matching => Scoring.ReadMatches(a.AnswerText).Count > 0,
        _ => a.SelectedOptionId is not null || !string.IsNullOrWhiteSpace(a.AnswerText),
    };

    /// <summary>Every distinct answer with its count, most common first. Choices by their text, typed answers normalized.</summary>
    private static List<TopAnswer> Top(ScoringKey k, List<SubmissionAnswer> given)
    {
        var q = k.Question;
        var accepted = k.Expected.Select(e => Spelling.Normalize(e.AnswerText, q.CaseSensitive)).ToHashSet();
        IEnumerable<(string Answer, bool IsKey)> labels = q.Type switch
        {
            QuestionType.MultipleChoice or QuestionType.TrueFalse => given.Select(a => k.Options.FirstOrDefault(o => o.Id == a.SelectedOptionId))
                .Where(o => o is not null).Select(o => (o!.Text, o.IsCorrect)),
            QuestionType.ModifiedTrueFalse => given.Select(a => (Label(k, a), Scoring.Evaluate(k, a, SpellingMode.Strict).Points >= q.Points)),
            QuestionType.Identification => given.Select(a => Spelling.Normalize(a.AnswerText, q.CaseSensitive)).Select(t => (t, accepted.Contains(t))),
            // Each attempt counts an item once.
            QuestionType.Enumeration => given.SelectMany(a => Scoring.ReadItems(a.AnswerText).Select(i => Spelling.Normalize(i, q.CaseSensitive)).Distinct())
                .Select(t => (t, accepted.Contains(t))),
            _ => [],
        };
        return labels.GroupBy(l => l.Answer).Select(g => new TopAnswer(g.Key, g.Count(), g.First().IsKey))
            .OrderByDescending(t => t.Count).ThenBy(t => t.Answer, StringComparer.Ordinal).ToList();
    }

    /// <summary>"True", "False", or "False: correction".</summary>
    private static string Label(ScoringKey k, SubmissionAnswer a)
    {
        var choice = k.Options.FirstOrDefault(o => o.Id == a.SelectedOptionId)?.Text ?? "";
        var correction = Spelling.Normalize(a.AnswerText, k.Question.CaseSensitive);
        return choice == "False" && correction.Length > 0 ? $"False: {correction}" : choice;
    }
}
