using Lms.Api.Content;
using Lms.Api.Data;

namespace Lms.Api.Coursework;

/// <summary>An exam that uses a questionnaire, and the class it was given to.</summary>
public sealed record QuestionnaireUse(long ExamId, string ExamTitle, string ClassId, string SubjectName, string? SectionName);

public sealed record QuestionnaireSummary(long Id, string Title, int? SubjectId, int QuestionCount, decimal TotalPoints, bool Locked, IReadOnlyList<QuestionnaireUse> UsedBy);

/// <summary>The owner's full view, including correct answers. Never sent to students.</summary>
public sealed record QuestionnaireDto(long Id, string Title, int? SubjectId, bool Locked, IReadOnlyList<QuestionDto> Questions, IReadOnlyList<QuestionnaireUse> UsedBy);

public sealed record OptionDto(long Id, string Text, bool IsCorrect);
public sealed record PairDto(string Left, string Right);

public sealed record QuestionDto(long Id, string Type, string Prompt, decimal Points, int SortOrder, int? TimeLimitSeconds,
    IReadOnlyList<OptionDto> Options, IReadOnlyList<string> ExpectedAnswers, IReadOnlyList<PairDto> Pairs);

public sealed record QuestionnaireCreate(string? Title, int? SubjectId);
public sealed record QuestionnaireUpdate(string? Title);

public sealed record OptionInput(string? Text, bool IsCorrect);
public sealed record PairInput(string? Left, string? Right);

/// <summary>
/// One question. Which fields apply depends on <see cref="Type"/>:
/// multiple_choice: 2–10 <see cref="Options"/>, exactly one correct.
/// true_false: <see cref="CorrectAnswer"/> (the options True and False are created for you).
/// essay: prompt only; graded by the instructor.
/// enumeration: 1–20 <see cref="ExpectedAnswers"/>, matched case-insensitively in any order.
/// matching: 2–20 <see cref="Pairs"/>; students match each left item to a right item.
/// </summary>
public sealed record QuestionInput(string? Type, string? Prompt, decimal? Points, int? TimeLimitSeconds,
    IReadOnlyList<OptionInput>? Options, bool? CorrectAnswer, IReadOnlyList<string?>? ExpectedAnswers, IReadOnlyList<PairInput>? Pairs);

public sealed record QuestionsReplace(IReadOnlyList<QuestionInput>? Questions);

public static class QuestionRules
{
    public static readonly IReadOnlyList<string> Types =
        [QuestionType.MultipleChoice, QuestionType.TrueFalse, QuestionType.Essay, QuestionType.Enumeration, QuestionType.Matching];

    public const int MaxQuestions = 200;
    public const int PromptMax = 4_000;
    public const int OptionMax = 1_000;

    /// <summary>Checks one question and adds field errors under <c>questions[i].…</c>.</summary>
    public static void Validate(Errors errors, int i, QuestionInput q)
    {
        var at = $"questions[{i}]";
        if (q.Type is null || !Types.Contains(q.Type)) { errors.Add($"{at}.type", $"Choose one of: {string.Join(", ", Types)}."); return; }
        errors.Required($"{at}.prompt", q.Prompt, PromptMax, "the question");
        if (q.Points is not { } points || points <= 0 || points > 1000) errors.Add($"{at}.points", "Points must be more than 0 and at most 1000.");
        if (q.TimeLimitSeconds is < 0 or > 3600) errors.Add($"{at}.timeLimitSeconds", "Use 0 to 3600 seconds (0 means no limit).");

        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
                var options = q.Options ?? [];
                if (options.Count is < 2 or > 10) errors.Add($"{at}.options", "Give 2 to 10 answer choices.");
                else if (options.Any(o => string.IsNullOrWhiteSpace(o.Text) || o.Text.Trim().Length > OptionMax)) errors.Add($"{at}.options", $"Every choice needs text of at most {OptionMax} characters.");
                else if (options.Count(o => o.IsCorrect) != 1) errors.Add($"{at}.options", "Mark exactly one choice as correct.");
                break;
            case QuestionType.TrueFalse:
                if (q.CorrectAnswer is null) errors.Add($"{at}.correctAnswer", "Say whether the statement is true or false.");
                break;
            case QuestionType.Enumeration:
                var answers = q.ExpectedAnswers ?? [];
                if (answers.Count is < 1 or > 20 || answers.Any(a => string.IsNullOrWhiteSpace(a) || a.Trim().Length > OptionMax))
                    errors.Add($"{at}.expectedAnswers", "Give 1 to 20 accepted answers, none blank.");
                break;
            case QuestionType.Matching:
                var pairs = q.Pairs ?? [];
                if (pairs.Count is < 2 or > 20 || pairs.Any(p => string.IsNullOrWhiteSpace(p.Left) || string.IsNullOrWhiteSpace(p.Right) || p.Left.Trim().Length > OptionMax || p.Right.Trim().Length > OptionMax))
                    errors.Add($"{at}.pairs", "Give 2 to 20 pairs, each with both sides filled in.");
                break;
        }
    }
}
