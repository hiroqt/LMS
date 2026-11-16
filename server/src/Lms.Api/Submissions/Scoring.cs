using System.Text.Json;
using Lms.Api.Data;

namespace Lms.Api.Submissions;

/// <summary>The parts of a question the scorer needs, loaded once per attempt.</summary>
public sealed record ScoringKey(Question Question, IReadOnlyList<QuestionOption> Options, IReadOnlyList<QuestionExpectedAnswer> Expected);

/// <summary>
/// Automatic scoring. Same rules as the prototype client:
/// multiple choice and true/false: full points for the correct choice;
/// enumeration: case-insensitive, order-independent; points in proportion to how many of the
/// expected answers were given (duplicates count once);
/// matching: points in proportion to correctly matched pairs;
/// essay: not scored automatically (null) until the instructor grades it.
/// Points are rounded to two decimals.
/// </summary>
public static class Scoring
{
    public static decimal? Score(ScoringKey key, SubmissionAnswer? answer)
    {
        var q = key.Question;
        if (q.Type == QuestionType.Essay) return null;
        if (answer is null) return 0;

        decimal fraction;
        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
            case QuestionType.TrueFalse:
                fraction = key.Options.Any(o => o.IsCorrect && o.Id == answer.SelectedOptionId) ? 1 : 0;
                break;
            case QuestionType.Enumeration:
                var expected = key.Expected.Select(e => Normalize(e.AnswerText)).Distinct().ToList();
                var given = ReadItems(answer.AnswerText).Select(Normalize).Where(s => s.Length > 0).ToHashSet();
                fraction = expected.Count == 0 ? 0 : (decimal)expected.Count(given.Contains) / expected.Count;
                break;
            case QuestionType.Matching:
                var matches = ReadMatches(answer.AnswerText);
                var pairs = key.Options.Join(key.Expected, o => o.SortOrder, e => e.SortOrder, (o, e) => (o.Id, Right: Normalize(e.AnswerText))).ToList();
                fraction = pairs.Count == 0 ? 0 : (decimal)pairs.Count(p => matches.TryGetValue(p.Id, out var r) && Normalize(r) == p.Right) / pairs.Count;
                break;
            default:
                return 0;
        }
        return Math.Round(q.Points * fraction, 2, MidpointRounding.AwayFromZero);
    }

    public static string Normalize(string? text) => string.Join(' ', (text ?? "").Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static string WriteItems(IEnumerable<string> items) => JsonSerializer.Serialize(items.Select(i => i.Trim()).Where(i => i.Length > 0).ToList());

    public static IReadOnlyList<string> ReadItems(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? []; }
        catch (JsonException) { return []; }
    }

    public static string WriteMatches(IReadOnlyDictionary<long, string> matches) => JsonSerializer.Serialize(matches.ToDictionary(m => m.Key, m => m.Value.Trim()));

    public static IReadOnlyDictionary<long, string> ReadMatches(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<long, string>();
        try { return JsonSerializer.Deserialize<Dictionary<long, string>>(json) ?? []; }
        catch (JsonException) { return new Dictionary<long, string>(); }
    }
}
