namespace Lms.Api.Import;

/// <summary>
/// Turns parsed drafts into the import response: each question's type, answer key, and points
/// are worked out, and anything a person must fix becomes a warning. Same for every format.
/// </summary>
internal static class ExamBuilder
{
    public const string NoAnswer = "No answer found.";
    public const string ChooseType = "Choose the type.";

    public static ImportResult Build(ExamDraft exam, string format, string? fileTitle, CancellationToken ct)
    {
        ImportChecks.SharePoints(exam);
        ImportChecks.Duplicates(exam);
        var warnings = exam.Warnings.Concat(ImportChecks.Numbering(exam)).Concat(ImportChecks.SectionPoints(exam)).ToList();

        var questions = new List<ImportedQuestion>(exam.Questions.Count);
        foreach (var draft in exam.Questions)
        {
            ct.ThrowIfCancellationRequested();
            questions.Add(Resolve(draft, exam.Sections[draft.Section]));
        }

        var sections = exam.Sections.Select(s => new ImportedSection(s.Title, s.Directions, s.PointsEach)).ToList();
        return new ImportResult(format, exam.Title ?? fileTitle, sections, questions, warnings);
    }

    private static ImportedQuestion Resolve(QuestionDraft draft, SectionDraft section)
    {
        var warnings = new List<string>();
        var prompt = draft.Prompt;
        var type = draft.Type ?? section.Type ?? Guess(draft);

        string? underlined = null;
        if (type == ImportTypes.ModifiedTrueFalse) (prompt, underlined) = Underline(prompt, draft.Underlined, warnings);

        var options = new List<ImportedOption>();
        var pairs = new List<ImportedPair>();
        var expected = new List<string>();
        bool? correct = null;
        var answer = draft.Answer;

        switch (type)
        {
            case ImportTypes.MultipleChoice:
                options = MultipleChoice(draft, answer, warnings);
                break;
            case ImportTypes.TrueFalse:
                if (answer is null) warnings.Add(NoAnswer);
                else if (TrueOrFalse(FirstWord(answer)) is { } tf) correct = tf;
                else warnings.Add($"The answer “{answer}” is not True or False.");
                break;
            case ImportTypes.ModifiedTrueFalse:
                if (answer is null) { warnings.Add(NoAnswer); break; }
                correct = TrueOrFalse(FirstWord(answer));
                if (correct is null) { warnings.Add($"The answer “{answer}” is not True or False."); break; }
                if (correct == false)
                {
                    expected = Split(answer[FirstWord(answer).Length..].TrimStart(' ', '-', '–', '—', ':', ',', ';'), '/');
                    if (expected.Count == 0) warnings.Add("Give the correct word or phrase after False, as in “False – storage”.");
                }
                break;
            case ImportTypes.Identification:
                expected = Split(answer, '/');
                if (expected.Count == 0) warnings.Add(NoAnswer);
                else if (expected.Count > 10) warnings.Add("Give at most 10 accepted answers.");
                break;
            case ImportTypes.Enumeration:
                expected = Split(answer, ';', '\n');
                if (expected.Count == 0) warnings.Add(NoAnswer);
                else if (expected.Count > 20) warnings.Add("Give at most 20 items.");
                break;
            case ImportTypes.Matching:
                pairs = Matching(draft, warnings);
                break;
            case ImportTypes.Essay:
                break;
            default:
                // Keep what was found so the person only has to pick the type.
                warnings.Add(ChooseType);
                options = draft.Choices.Select(c => new ImportedOption(c.Text, false)).ToList();
                pairs = draft.Pairs.Select(p => new ImportedPair(p.Left, p.Right)).ToList();
                expected = draft.Choices.Count == 0 && draft.Pairs.Count == 0 ? Split(answer, '/') : [];
                break;
        }

        if (prompt.Length == 0) warnings.Add("The question has no text.");
        if (draft.Points is null) warnings.Add("Enter the points.");
        else if (draft.Points is <= 0 or > 1000) warnings.Add("Points must be more than 0 and at most 1000.");
        warnings.AddRange(draft.Warnings);

        return new ImportedQuestion(type, prompt, draft.Points, null, draft.Section, underlined, correct, expected,
            false, false, options, pairs, draft.Number, string.Join('\n', draft.SourceLines), warnings);
    }

    /// <summary>
    /// Outside a typed section: choices mean multiple choice, "=" lines mean matching, and an
    /// answer of True/False means true or false (modified when a phrase is in [brackets]).
    /// </summary>
    private static string? Guess(QuestionDraft draft)
    {
        if (draft.Choices.Count > 0) return ImportTypes.MultipleChoice;
        if (draft.Pairs.Count > 0) return ImportTypes.Matching;
        if (draft.Answer is { } answer && TrueOrFalse(FirstWord(answer)) is not null)
            return draft.Underlined is not null || Bracketed(draft.Prompt) is not null ? ImportTypes.ModifiedTrueFalse : ImportTypes.TrueFalse;
        return null;
    }

    private static List<ImportedOption> MultipleChoice(QuestionDraft draft, string? answer, List<string> warnings)
    {
        foreach (var (letter, text) in draft.Choices)
            if (text.Length == 0) warnings.Add($"Choice {letter} is blank.");
        if (draft.Choices.Count < 2) warnings.Add("Give at least 2 choices.");
        else if (draft.Choices.Count > 10) warnings.Add("Give at most 10 choices.");

        var correct = -1;
        if (answer is null) warnings.Add(NoAnswer);
        else
        {
            correct = ChoiceFor(draft.Choices, answer);
            if (correct < 0) warnings.Add($"The answer “{answer}” matches no choice.");
        }
        return draft.Choices.Select((c, i) => new ImportedOption(c.Text, i == correct)).ToList();
    }

    /// <summary>The choice an answer names: a letter ("b", "B.", "(b)", "b. const") or the choice's text.</summary>
    private static int ChoiceFor(List<(string Letter, string Text)> choices, string answer)
    {
        var letter = answer.Length == 1 ? answer
            : ExamText.TryChoice(answer, out var l, out _) ? l.ToString()
            : null;
        if (letter is not null)
            return choices.FindIndex(c => string.Equals(c.Letter, letter, StringComparison.OrdinalIgnoreCase));
        return choices.FindIndex(c => string.Equals(c.Text, answer, StringComparison.OrdinalIgnoreCase));
    }

    private static List<ImportedPair> Matching(QuestionDraft draft, List<string> warnings)
    {
        for (var k = 0; k < draft.Pairs.Count; k++)
            if (draft.Pairs[k].Left.Length == 0 || draft.Pairs[k].Right.Length == 0) warnings.Add($"Pair {k + 1} is missing a side.");
        if (draft.Pairs.Count < 2) warnings.Add("Give at least 2 pairs, each as “left = right”.");
        else if (draft.Pairs.Count > 20) warnings.Add("Give at most 20 pairs.");
        return draft.Pairs.Select(p => new ImportedPair(p.Left, p.Right)).ToList();
    }

    /// <summary>
    /// The underlined phrase: the Underlined cell, or the first [bracketed] phrase (which is how
    /// Word underline arrives). The brackets are taken out of the prompt.
    /// </summary>
    private static (string Prompt, string? Underlined) Underline(string prompt, string? stated, List<string> warnings)
    {
        var bracketed = Bracketed(prompt);
        var clean = prompt.Replace("[", "").Replace("]", "");
        var underlined = stated ?? bracketed;
        if (underlined is null) warnings.Add("Mark the underlined word or phrase with [brackets].");
        else if (!clean.Contains(underlined, StringComparison.OrdinalIgnoreCase)) warnings.Add($"“{underlined}” is not in the question.");
        return (clean, underlined);
    }

    private static string? Bracketed(string prompt)
    {
        var open = prompt.IndexOf('[');
        var close = open < 0 ? -1 : prompt.IndexOf(']', open + 1);
        if (close < 0) return null;
        var phrase = prompt[(open + 1)..close].Trim();
        return phrase.Length > 0 ? phrase : null;
    }

    private static string FirstWord(string answer)
    {
        var end = 0;
        while (end < answer.Length && char.IsLetter(answer[end])) end++;
        return answer[..end];
    }

    private static bool? TrueOrFalse(string word) => word.ToLowerInvariant() switch
    {
        "true" or "t" => true,
        "false" or "f" => false,
        _ => null,
    };

    private static List<string> Split(string? text, params char[] separators) =>
        text is null ? [] : text.Split(separators, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).ToList();
}
