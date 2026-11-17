namespace Lms.Api.Import;

// ------------------------------------------------------------------ response (D-041, contract §2)

/// <summary>Draft questions read from a document. Nothing here is saved; a person reviews and saves them.</summary>
public sealed record ImportResult(string Format, string? Title, IReadOnlyList<ImportedSection> Sections,
    IReadOnlyList<ImportedQuestion> Questions, IReadOnlyList<string> Warnings);

public sealed record ImportedSection(string Title, string? Directions, decimal? DefaultPoints);

public sealed record ImportedOption(string Text, bool IsCorrect);
public sealed record ImportedPair(string Left, string Right);

/// <summary>
/// The fields of a question input, plus where it came from: <see cref="Number"/> (as printed, or
/// null), <see cref="Source"/> (the original text) and <see cref="Warnings"/> (plain sentences).
/// <see cref="Type"/> is null when the document does not say and it cannot be guessed.
/// </summary>
public sealed record ImportedQuestion(
    string? Type, string Prompt, decimal? Points, int? TimeLimitSeconds, int Section,
    string? Underlined, bool? CorrectAnswer, IReadOnlyList<string> ExpectedAnswers,
    bool AlwaysStrict, bool CaseSensitive,
    IReadOnlyList<ImportedOption> Options, IReadOnlyList<ImportedPair> Pairs,
    int? Number, string Source, IReadOnlyList<string> Warnings);

public sealed record ImportTextInput(string? Text);

// ------------------------------------------------------------------ limits and names

public static class ImportLimits
{
    public const long MaxFileBytes = 5 * 1024 * 1024;
    public const int MaxTextChars = 200_000;
    /// <summary>The most a .docx or .xlsx may hold once unpacked (zip bomb guard).</summary>
    public const long MaxUnpackedBytes = 20 * 1024 * 1024;
    public const int MaxZipEntries = 500;
    public const int MaxRows = 2_000;
    public const int MaxLines = 20_000;
    public const int MaxQuestions = 200;
    public static readonly TimeSpan ParseTime = TimeSpan.FromSeconds(10);
}

/// <summary>The question types the import can produce (contract §1).</summary>
public static class ImportTypes
{
    public const string MultipleChoice = "multiple_choice";
    public const string TrueFalse = "true_false";
    public const string ModifiedTrueFalse = "modified_true_false";
    public const string Identification = "identification";
    public const string Enumeration = "enumeration";
    public const string Matching = "matching";
    public const string Essay = "essay";

    public static readonly IReadOnlyList<string> All =
        [MultipleChoice, TrueFalse, ModifiedTrueFalse, Identification, Enumeration, Matching, Essay];

    /// <summary>
    /// The type named in a heading or a Type cell, ignoring case: "Test III. Modified true or false"
    /// or "modified_true_false". The longer names are tried first, so "modified true or false" is
    /// not read as "true or false".
    /// </summary>
    public static string? FromWords(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var words = " " + string.Join(' ', text.ToLowerInvariant()
            .Replace('_', ' ').Replace('-', ' ').Replace('/', ' ')
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)) + " ";
        if (words.Contains(" modified true or false ") || words.Contains(" modified true false ")) return ModifiedTrueFalse;
        if (words.Contains(" true or false ") || words.Contains(" true false ")) return TrueFalse;
        if (words.Contains(" multiple choice ")) return MultipleChoice;
        if (words.Contains(" identification ")) return Identification;
        if (words.Contains(" enumeration ")) return Enumeration;
        if (words.Contains(" matching ")) return Matching;
        if (words.Contains(" essay ")) return Essay;
        return null;
    }
}

/// <summary>A file that is refused with 422 <c>file</c> and this message.</summary>
public sealed class ImportRefusedException(string message) : Exception(message)
{
    public const string WrongFile = "Upload a .docx, .xlsx, .csv, or .txt file of at most 5 MB.";
    public const string Unreadable = "This file could not be read.";
}

// ------------------------------------------------------------------ drafts (parser output, before checks)

/// <summary>A section as written: its heading, and the type and points read from it.</summary>
internal sealed class SectionDraft
{
    public string Title { get; set; } = "";
    public string? Directions { get; set; }
    public string? Type { get; set; }
    /// <summary>"(1 point each)".</summary>
    public decimal? PointsEach { get; set; }
    /// <summary>"(20 points)": the section's total.</summary>
    public decimal? PointsTotal { get; set; }
}

/// <summary>A question as written, before its type and answer are worked out.</summary>
internal sealed class QuestionDraft
{
    public int? Number { get; set; }
    public int Section { get; set; }
    /// <summary>A type stated for this question alone (the Type column).</summary>
    public string? Type { get; set; }
    public List<string> PromptLines { get; } = [];
    /// <summary>Choices in order; a blank text means the choice was left empty.</summary>
    public List<(string Letter, string Text)> Choices { get; } = [];
    public List<(string Left, string Right)> Pairs { get; } = [];
    public string? Answer { get; set; }
    public string? Underlined { get; set; }
    public decimal? Points { get; set; }
    public List<string> SourceLines { get; } = [];
    public List<string> Warnings { get; } = [];

    public string Prompt => string.Join('\n', PromptLines).Trim();
}

internal sealed class ExamDraft
{
    public string? Title { get; set; }
    public List<SectionDraft> Sections { get; } = [];
    public List<QuestionDraft> Questions { get; } = [];
    public List<string> Warnings { get; } = [];

    /// <summary>The current section's index, adding an unnamed one when the document has none yet.</summary>
    public int CurrentSection()
    {
        if (Sections.Count == 0) Sections.Add(new SectionDraft());
        return Sections.Count - 1;
    }

    public void AddQuestion(QuestionDraft question)
    {
        if (Questions.Count >= ImportLimits.MaxQuestions)
            throw new ImportRefusedException($"Import at most {ImportLimits.MaxQuestions} questions at a time. Split this file and import each part.");
        Questions.Add(question);
    }
}
