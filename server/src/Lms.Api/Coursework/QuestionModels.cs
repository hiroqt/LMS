using Lms.Api.Content;
using Lms.Api.Data;

namespace Lms.Api.Coursework;

/// <summary>An exam that uses a questionnaire, and the class it was given to.</summary>
public sealed record QuestionnaireUse(long ExamId, string ExamTitle, string ClassId, string SubjectName, string? SectionName);

/// <param name="IncompleteCount">Questions saved with allowIncomplete that still need attention.</param>
public sealed record QuestionnaireSummary(long Id, string Title, int? SubjectId, int QuestionCount, decimal TotalPoints, bool Locked, IReadOnlyList<QuestionnaireUse> UsedBy, int IncompleteCount);

/// <summary>The owner's full view, including correct answers. Never sent to students.</summary>
public sealed record QuestionnaireDto(long Id, string Title, int? SubjectId, bool Locked, IReadOnlyList<SectionDto> Sections, IReadOnlyList<QuestionDto> Questions, IReadOnlyList<QuestionnaireUse> UsedBy);

public sealed record SectionDto(long Id, string Title, string? Directions, decimal? DefaultPoints, int SortOrder);
public sealed record OptionDto(long Id, string Text, bool IsCorrect);
public sealed record PairDto(string Left, string Right);

/// <param name="Problems">Plain sentences saying what to fix; empty unless <paramref name="Incomplete"/>.</param>
public sealed record QuestionDto(long Id, string Type, string Prompt, decimal Points, int SortOrder, int? TimeLimitSeconds,
    long? SectionId, string? Underlined, bool AlwaysStrict, bool CaseSensitive, bool Incomplete, IReadOnlyList<string> Problems,
    IReadOnlyList<OptionDto> Options, IReadOnlyList<string> ExpectedAnswers, IReadOnlyList<PairDto> Pairs);

public sealed record QuestionnaireCreate(string? Title, int? SubjectId);
public sealed record QuestionnaireUpdate(string? Title);

public sealed record OptionInput(string? Text, bool IsCorrect);
public sealed record PairInput(string? Left, string? Right);
public sealed record SectionInput(string? Title, string? Directions, decimal? DefaultPoints);

/// <summary>
/// One question. Which fields apply depends on <see cref="Type"/>:
/// multiple_choice: 2–10 <see cref="Options"/>, exactly one correct.
/// true_false: <see cref="CorrectAnswer"/> (the options True and False are created for you).
/// identification: 1–10 <see cref="ExpectedAnswers"/>; any one is correct.
/// essay: prompt only; graded by the instructor.
/// enumeration: 1–20 <see cref="ExpectedAnswers"/>, each counted once in any order.
/// modified_true_false: <see cref="Underlined"/> (a phrase of the prompt), <see cref="CorrectAnswer"/>,
/// and when false 1–10 accepted corrections in <see cref="ExpectedAnswers"/>.
/// matching: 2–20 <see cref="Pairs"/>; students match each left item to a right item.
/// <see cref="Section"/> is an index into the request's sections (default 0).
/// </summary>
public sealed record QuestionInput(string? Type, string? Prompt, decimal? Points, int? TimeLimitSeconds,
    IReadOnlyList<OptionInput>? Options, bool? CorrectAnswer, IReadOnlyList<string?>? ExpectedAnswers, IReadOnlyList<PairInput>? Pairs,
    int? Section = null, string? Underlined = null, bool? AlwaysStrict = null, bool? CaseSensitive = null);

/// <param name="Sections">Omitted or empty: one unnamed section.</param>
/// <param name="AllowIncomplete">Save questions that fail only their content rules, marked incomplete.</param>
public sealed record QuestionsReplace(IReadOnlyList<QuestionInput>? Questions, IReadOnlyList<SectionInput>? Sections = null, bool? AllowIncomplete = null);

/// <summary>A content problem with one question: the field and a plain sentence.</summary>
public sealed record QuestionProblem(string Field, string Message);

public static class QuestionRules
{
    public static readonly IReadOnlyList<string> Types =
    [
        QuestionType.MultipleChoice, QuestionType.TrueFalse, QuestionType.Essay, QuestionType.Enumeration, QuestionType.Matching,
        QuestionType.Identification, QuestionType.ModifiedTrueFalse,
    ];

    public const int MaxQuestions = 200;
    public const int MaxSections = 50;
    public const int PromptMax = 4_000;
    public const int OptionMax = 1_000;
    public const int SectionTitleMax = 200;
    public const int DirectionsMax = 2_000;

    private const string ChoicesMessage = "Give 2 to 10 answer choices.";
    private const string PairsMessage = "Give 2 to 20 pairs, each with both sides filled in.";

    /// <summary>Most accepted answers per type.</summary>
    public static int MaxAnswers(string type) => type == QuestionType.Enumeration ? 20 : 10;

    /// <summary>Checks one question fully (structure and content) and adds field errors under <c>questions[i].…</c>.</summary>
    public static void Validate(Errors errors, int i, QuestionInput q, int sectionCount = 1)
    {
        if (!Structural(errors, i, q, sectionCount)) return;
        foreach (var p in Problems(q)) errors.Add($"questions[{i}].{p.Field}", p.Message);
    }

    /// <summary>
    /// Problems that refuse the request even with allowIncomplete: an unknown type, a section out of
    /// range, and anything too long or too many to store. Returns false when the type is unknown.
    /// </summary>
    public static bool Structural(Errors errors, int i, QuestionInput q, int sectionCount)
    {
        var at = $"questions[{i}]";
        if (q.Type is null || !Types.Contains(q.Type)) { errors.Add($"{at}.type", $"Choose one of: {string.Join(", ", Types)}."); return false; }
        if (q.Section is { } s && (s < 0 || s >= sectionCount)) errors.Add($"{at}.section", "Choose one of the sections.");
        if (q.Prompt?.Trim().Length > PromptMax) errors.Add($"{at}.prompt", $"Use at most {PromptMax} characters.");
        if (q.TimeLimitSeconds is < 0 or > 3600) errors.Add($"{at}.timeLimitSeconds", "Use 0 to 3600 seconds (0 means no limit).");
        if (q.Underlined?.Trim().Length > OptionMax) errors.Add($"{at}.underlined", $"Use at most {OptionMax} characters.");
        if (q.Options is { Count: > 10 }) errors.Add($"{at}.options", ChoicesMessage);
        else if (q.Options?.Any(o => o.Text?.Trim().Length > OptionMax) == true) errors.Add($"{at}.options", $"Every choice needs text of at most {OptionMax} characters.");
        var answers = q.ExpectedAnswers ?? [];
        if (answers.Count > MaxAnswers(q.Type) || answers.Any(a => a?.Trim().Length > OptionMax))
            errors.Add($"{at}.expectedAnswers", $"Give at most {MaxAnswers(q.Type)} accepted answers of at most {OptionMax} characters.");
        if (q.Pairs is { Count: > 20 } || q.Pairs?.Any(p => p.Left?.Trim().Length > OptionMax || p.Right?.Trim().Length > OptionMax) == true)
            errors.Add($"{at}.pairs", PairsMessage);
        return true;
    }

    /// <summary>Content problems: what makes a question incomplete. Empty when it is ready to use.</summary>
    public static List<QuestionProblem> Problems(QuestionInput q)
    {
        var list = new List<QuestionProblem>();
        if (string.IsNullOrWhiteSpace(q.Prompt)) list.Add(new("prompt", "Enter the question."));
        if (q.Points is not { } points || points <= 0 || points > 1000) list.Add(new("points", "Points must be more than 0 and at most 1000."));

        var answers = q.ExpectedAnswers ?? [];
        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
                var options = q.Options ?? [];
                if (options.Count is < 2 or > 10) list.Add(new("options", ChoicesMessage));
                else if (options.Any(o => string.IsNullOrWhiteSpace(o.Text))) list.Add(new("options", $"Every choice needs text of at most {OptionMax} characters."));
                else if (options.Count(o => o.IsCorrect) != 1) list.Add(new("options", "Mark exactly one choice as correct."));
                break;
            case QuestionType.TrueFalse:
                if (q.CorrectAnswer is null) list.Add(new("correctAnswer", "Say whether the statement is true or false."));
                break;
            case QuestionType.Enumeration:
                if (answers.Count is < 1 or > 20 || answers.Any(string.IsNullOrWhiteSpace))
                    list.Add(new("expectedAnswers", "Give 1 to 20 accepted answers, none blank."));
                break;
            case QuestionType.Identification:
                if (answers.Count is < 1 or > 10 || answers.Any(string.IsNullOrWhiteSpace))
                    list.Add(new("expectedAnswers", "Give 1 to 10 accepted answers, none blank."));
                break;
            case QuestionType.ModifiedTrueFalse:
                if (string.IsNullOrWhiteSpace(q.Underlined)) list.Add(new("underlined", "Choose the underlined phrase."));
                else if (q.Prompt?.Contains(q.Underlined.Trim(), StringComparison.OrdinalIgnoreCase) != true)
                    list.Add(new("underlined", "The underlined phrase must appear in the question."));
                if (q.CorrectAnswer is null) list.Add(new("correctAnswer", "Say whether the statement is true or false."));
                else if (q.CorrectAnswer == false && (answers.Count is < 1 or > 10 || answers.Any(string.IsNullOrWhiteSpace)))
                    list.Add(new("expectedAnswers", "Give 1 to 10 accepted corrections, none blank."));
                break;
            case QuestionType.Matching:
                var pairs = q.Pairs ?? [];
                if (pairs.Count is < 2 or > 20 || pairs.Any(p => string.IsNullOrWhiteSpace(p.Left) || string.IsNullOrWhiteSpace(p.Right)))
                    list.Add(new("pairs", PairsMessage));
                break;
        }
        return list;
    }

    /// <summary>Checks the sections of a questions PUT; these are refused even with allowIncomplete.</summary>
    public static void ValidateSections(Errors errors, IReadOnlyList<SectionInput> sections)
    {
        if (sections.Count > MaxSections) { errors.Add("sections", $"Use at most {MaxSections} sections."); return; }
        for (var i = 0; i < sections.Count; i++)
        {
            var s = sections[i];
            if (s.Title?.Trim().Length > SectionTitleMax) errors.Add($"sections[{i}].title", $"Use at most {SectionTitleMax} characters.");
            if (s.Directions?.Trim().Length > DirectionsMax) errors.Add($"sections[{i}].directions", $"Use at most {DirectionsMax} characters.");
            if (s.DefaultPoints is < 0 or > 1000) errors.Add($"sections[{i}].defaultPoints", "Use 0 to 1000 points, or leave it empty.");
        }
    }

    /// <summary>The stored question as an input again, so its problems can be checked after a key fix.</summary>
    public static QuestionInput ToInput(Question q, IReadOnlyList<QuestionOption> options, IReadOnlyList<QuestionExpectedAnswer> expected)
    {
        bool? correct = q.Type is QuestionType.TrueFalse or QuestionType.ModifiedTrueFalse && options.Any(o => o.IsCorrect)
            ? options.First(o => o.IsCorrect).Text == "True" : null;
        return q.Type switch
        {
            QuestionType.MultipleChoice => new(q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, options.Select(o => new OptionInput(o.Text, o.IsCorrect)).ToList(), null, null, null),
            QuestionType.Matching => new(q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, null, null, null,
                options.Join(expected, o => o.SortOrder, e => e.SortOrder, (o, e) => new PairInput(o.Text, e.AnswerText)).ToList()),
            _ => new(q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, null, correct, expected.Select(e => (string?)e.AnswerText).ToList(), null, Underlined: q.Underlined),
        };
    }
}
