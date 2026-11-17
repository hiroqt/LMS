using System.Text.Json;
using Lms.Api.Data;

namespace Lms.Api.Submissions;

/// <summary>The parts of a question the scorer needs, loaded once per attempt.</summary>
public sealed record ScoringKey(Question Question, IReadOnlyList<QuestionOption> Options, IReadOnlyList<QuestionExpectedAnswer> Expected);

/// <summary>Points for one answer (null: waiting for the instructor) and how its typed text matched (see <see cref="MatchNote"/>).</summary>
public sealed record ScoreResult(decimal? Points, string? MatchNote);

/// <summary>
/// Automatic scoring (contract §5). Pure: no database.
/// multiple choice and true/false: full points for the correct choice;
/// identification: full points when the text matches any accepted answer;
/// enumeration: each accepted answer counts once, in any order; points in proportion;
/// modified true or false: True on a true statement, or False plus a matching correction on a
/// false one; otherwise 0;
/// matching: points in proportion to correctly matched pairs;
/// essay: not scored automatically (null) until the instructor grades it.
/// Typed answers use <see cref="Spelling"/>. A near miss counts only when the exam's spelling mode
/// is not strict and the question is not always strict: in typos mode it is right (note "typo"),
/// in review mode it waits (null points, note "review"). A stored spelling decision makes a near
/// miss right (accepted) or wrong (rejected). Points are rounded to two decimals.
/// </summary>
public static class Scoring
{
    /// <summary>Strict spelling, the behavior before spelling modes existed.</summary>
    public static decimal? Score(ScoringKey key, SubmissionAnswer? answer) => Evaluate(key, answer, SpellingMode.Strict).Points;

    public static ScoreResult Evaluate(ScoringKey key, SubmissionAnswer? answer, string spellingMode)
    {
        var q = key.Question;
        if (q.Type == QuestionType.Essay) return new(null, null);
        if (answer is null) return new(0, null);
        var nearMisses = spellingMode != SpellingMode.Strict && !q.AlwaysStrict;
        var accepted = key.Expected.Select(e => e.AnswerText).ToList();

        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
            case QuestionType.TrueFalse:
                return Full(q, key.Options.Any(o => o.IsCorrect && o.Id == answer.SelectedOptionId) ? 1 : 0, null);
            case QuestionType.Identification:
            {
                var kind = Spelling.Match(answer.AnswerText, accepted, q.CaseSensitive, nearMisses);
                return Resolve(q, kind, spellingMode, answer.SpellingDecision);
            }
            case QuestionType.ModifiedTrueFalse:
            {
                var chosen = key.Options.FirstOrDefault(o => o.Id == answer.SelectedOptionId);
                if (chosen is null || !chosen.IsCorrect) return new(0, null);
                if (chosen.Text == "True") return Full(q, 1, null);
                var kind = Spelling.Match(answer.AnswerText, accepted, q.CaseSensitive, nearMisses);
                return Resolve(q, kind, spellingMode, answer.SpellingDecision);
            }
            case QuestionType.Enumeration:
                return Enumeration(q, accepted, ReadItems(answer.AnswerText), nearMisses, spellingMode, answer.SpellingDecision);
            case QuestionType.Matching:
                var matches = ReadMatches(answer.AnswerText);
                var pairs = key.Options.Join(key.Expected, o => o.SortOrder, e => e.SortOrder, (o, e) => (o.Id, Right: Normalize(e.AnswerText))).ToList();
                return Full(q, pairs.Count == 0 ? 0 : (decimal)pairs.Count(p => matches.TryGetValue(p.Id, out var r) && Normalize(r) == p.Right) / pairs.Count, null);
            default:
                return new(0, null);
        }
    }

    /// <summary>Each accepted answer counts once: exact matches first, then near misses on what is left.</summary>
    private static ScoreResult Enumeration(Question q, List<string> accepted, IReadOnlyList<string> items, bool nearMisses, string mode, string? decision)
    {
        var expected = accepted.Select(a => Spelling.Normalize(a, q.CaseSensitive)).Where(a => a.Length > 0).Distinct().ToList();
        if (expected.Count == 0) return new(0, null);
        var given = items.Select(i => Spelling.Normalize(i, q.CaseSensitive)).Where(i => i.Length > 0).Distinct().ToList();
        var left = new List<string>(expected);
        var exact = 0;
        foreach (var item in given.ToList())
        {
            if (!left.Remove(item)) continue;
            exact++;
            given.Remove(item);
        }
        var near = 0;
        if (nearMisses)
        {
            foreach (var item in given)
            {
                var match = left.FirstOrDefault(e => Spelling.IsNearMiss(item, e));
                if (match is null) continue;
                left.Remove(match);
                near++;
            }
        }
        if (near == 0) return Full(q, (decimal)exact / expected.Count, exact > 0 ? MatchNote.Exact : null);
        var note = NearNote(mode);
        if (decision == SpellingDecision.Accepted) return Full(q, (decimal)(exact + near) / expected.Count, note);
        if (decision == SpellingDecision.Rejected) return Full(q, (decimal)exact / expected.Count, note);
        return mode == SpellingMode.Review ? new(null, note) : Full(q, (decimal)(exact + near) / expected.Count, note);
    }

    private static ScoreResult Resolve(Question q, MatchKind kind, string mode, string? decision) => kind switch
    {
        MatchKind.Exact => Full(q, 1, MatchNote.Exact),
        MatchKind.Near when decision == SpellingDecision.Accepted => Full(q, 1, NearNote(mode)),
        MatchKind.Near when decision == SpellingDecision.Rejected => Full(q, 0, NearNote(mode)),
        MatchKind.Near when mode == SpellingMode.Review => new(null, MatchNote.Review),
        MatchKind.Near => Full(q, 1, MatchNote.Typo),
        _ => new(0, null),
    };

    private static string NearNote(string mode) => mode == SpellingMode.Review ? MatchNote.Review : MatchNote.Typo;

    private static ScoreResult Full(Question q, decimal fraction, string? note) =>
        new(Math.Round(q.Points * fraction, 2, MidpointRounding.AwayFromZero), note);

    /// <summary>Case-insensitive normalization (see <see cref="Spelling.Normalize"/>).</summary>
    public static string Normalize(string? text) => Spelling.Normalize(text);

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
