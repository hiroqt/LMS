namespace Lms.Api.Import;

/// <summary>
/// Checks across questions: numbering gaps, a section's stated points against its questions,
/// and repeated questions. The per-question checks (answer key, choices, type) are in
/// <see cref="ExamBuilder"/>; the answer key at the end is read by <see cref="ExamTextParser"/>.
/// </summary>
internal static class ImportChecks
{
    private const int MaxListed = 20;

    /// <summary>
    /// Points from the section heading: "(1 point each)" for every question without its own; for
    /// "(20 points)", the questions without their own share what is left, rounded to cents.
    /// </summary>
    public static void SharePoints(ExamDraft exam)
    {
        for (var s = 0; s < exam.Sections.Count; s++)
        {
            var section = exam.Sections[s];
            var questions = exam.Questions.Where(q => q.Section == s).ToList();
            if (section.PointsEach is { } each)
            {
                foreach (var q in questions) q.Points ??= each;
            }
            else if (section.PointsTotal is { } total)
            {
                var open = questions.Where(q => q.Points is null).ToList();
                var left = total - questions.Sum(q => q.Points ?? 0);
                if (open.Count == 0 || left <= 0) continue;
                var share = Math.Round(left / open.Count, 2, MidpointRounding.AwayFromZero);
                foreach (var q in open) q.Points = share;
            }
        }
    }

    /// <summary>"Your document numbers questions 1–45, but 43 were found. Missing: 12, 30."</summary>
    public static IEnumerable<string> Numbering(ExamDraft exam)
    {
        var runs = NumberingRuns(exam.Questions.Where(q => q.Number is not null).ToList());
        foreach (var run in runs)
        {
            var who = runs.Count == 1 ? "Your document" : ExamText.SectionName(exam.Sections[run[0].Section].Title);
            var numbers = run.Select(q => q.Number!.Value).ToList();
            var (min, max) = (numbers.Min(), numbers.Max());
            var missing = Enumerable.Range(min, max - min + 1).Except(numbers).ToList();
            if (missing.Count > 0)
                yield return $"{who} numbers questions {min}–{max}, but {numbers.Count} were found. Missing: {List(missing)}.";
            var repeated = numbers.GroupBy(n => n).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
            if (repeated.Count > 0)
                yield return $"{who} uses {(repeated.Count == 1 ? "this number" : "these numbers")} more than once: {List(repeated)}.";
        }
    }

    /// <summary>
    /// Numbering usually runs through the whole document, but some exams start again at 1 in
    /// each test. A new run starts where a section's numbers go back.
    /// </summary>
    private static List<List<QuestionDraft>> NumberingRuns(List<QuestionDraft> numbered)
    {
        var runs = new List<List<QuestionDraft>>();
        for (var i = 0; i < numbered.Count; i++)
        {
            var restarts = i > 0 && numbered[i].Section != numbered[i - 1].Section && numbered[i].Number <= numbered[i - 1].Number;
            if (i == 0 || restarts) runs.Add([]);
            runs[^1].Add(numbered[i]);
        }
        return runs;
    }

    /// <summary>"Test I says 20 points, but its questions add up to 18."</summary>
    public static IEnumerable<string> SectionPoints(ExamDraft exam)
    {
        for (var s = 0; s < exam.Sections.Count; s++)
        {
            if (exam.Sections[s].PointsTotal is not { } stated) continue;
            var sum = exam.Questions.Where(q => q.Section == s).Sum(q => q.Points ?? 0);
            if (sum != stated)
                yield return $"{ExamText.SectionName(exam.Sections[s].Title)} says {Points(stated)}, but its questions add up to {ExamText.Number(sum)}.";
        }
    }

    /// <summary>A question whose text repeats an earlier one (ignoring case, spacing, and brackets).</summary>
    public static void Duplicates(ExamDraft exam)
    {
        var seen = new Dictionary<string, string>();
        for (var i = 0; i < exam.Questions.Count; i++)
        {
            var q = exam.Questions[i];
            var text = Normalize(q.Prompt);
            if (text.Length == 0) continue;
            var label = q.Number?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? (i + 1).ToString(System.Globalization.CultureInfo.InvariantCulture);
            if (seen.TryGetValue(text, out var first)) q.Warnings.Add($"This question repeats question {first}.");
            else seen[text] = label;
        }
    }

    private static string Normalize(string prompt) =>
        string.Join(' ', prompt.Replace("[", "").Replace("]", "").ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).TrimEnd('.', '?', '!');

    private static string Points(decimal value) => value == 1 ? "1 point" : $"{ExamText.Number(value)} points";

    private static string List(List<int> numbers) =>
        string.Join(", ", numbers.Take(MaxListed)) + (numbers.Count > MaxListed ? ", …" : "");
}
