using System.Text.Json.Serialization;
using Lms.Api.Coursework;

namespace Lms.Api.Submissions;

// ---------------------------------------------------------------- student side

public sealed record StudentOption(long Id, string Text);
public sealed record StudentSection(long Id, string Title, string? Directions);
public sealed record KeyPair(long LeftId, string Right);

/// <summary>The correct answer of one question, with only the fields its type uses.</summary>
public sealed record AnswerKeyDto(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<long>? OptionIds,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<string>? Answers,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<KeyPair>? Pairs,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? CorrectAnswer);

/// <summary>A question as a student sees it. Matching gives the right-hand items in alphabetical
/// order; enumeration says how many items are expected. <paramref name="Key"/> is null until the
/// exam's answer review allows it.</summary>
public sealed record StudentQuestion(long Id, string Type, string Prompt, decimal Points, int? TimeLimitSeconds,
    IReadOnlyList<StudentOption> Options, int? ItemCount, IReadOnlyList<StudentOption> Lefts, IReadOnlyList<string> Rights,
    long? SectionId = null, string? Underlined = null, AnswerKeyDto? Key = null);

/// <param name="PointsAwarded">Shown to the student once the attempt is submitted, when the answer review allows.</param>
/// <param name="MatchNote">How a typed answer matched: exact, typo, review, or null.</param>
/// <param name="Decision">Instructors only: the spelling decision on a near miss.</param>
/// <param name="ManualPoints">Instructors only: points the instructor gave an automatically scored question, kept by a re-score.</param>
public sealed record AnswerDto(long QuestionId, long? OptionId, string? Text, IReadOnlyList<string> Items,
    IReadOnlyDictionary<long, string> Matches, decimal? PointsAwarded, string? MatchNote = null, string? Decision = null, decimal? ManualPoints = null);

/// <param name="Deadline">When saving stops: the time limit, or the due date when late work is not allowed.</param>
/// <param name="ScoreUpdatedAt">When a regrade last changed the score ("Your score was updated").</param>
public sealed record AttemptDto(long Id, int AttemptNumber, string Status, DateTime? StartedAt, DateTime? SubmittedAt,
    DateTime? Deadline, decimal? Score, decimal MaxPoints, string? Feedback,
    IReadOnlyList<StudentQuestion> Questions, IReadOnlyList<AnswerDto> Answers,
    string AnswerReview, string SpellingMode, DateTime? ScoreUpdatedAt, IReadOnlyList<StudentSection> Sections,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title = null);

/// <summary>One answer. Use the field for the question's type: optionId (multiple choice, true/false),
/// text (essay, identification), optionId and text (modified true or false: the correction when False),
/// items (enumeration), matches (matching: left option id to right text).</summary>
public sealed record AnswerInput(long QuestionId, long? OptionId, string? Text, IReadOnlyList<string?>? Items, IReadOnlyDictionary<long, string?>? Matches);

public sealed record AnswersInput(IReadOnlyList<AnswerInput>? Answers);

/// <param name="HonorStatement">True when the student confirmed "This is my own work"; needed when the assignment asks for it.</param>
public sealed record AssignmentSubmit(string? Text, string? FileName, bool? HonorStatement = null);

/// <summary>What autosave sends: both fields replace what the draft has; null clears one (contract §7).</summary>
public sealed record DraftInput(string? Text, string? Link);

public sealed record TurnInInput(bool? HonorStatement);

/// <summary>An uploaded file on a draft or a version (contract §6).</summary>
/// <param name="Code">The first 8 characters of the file's SHA-256, as on the receipt.</param>
/// <param name="SameAsAnotherStudent">Instructors only: another student handed in the same bytes for this assignment.</param>
public sealed record FileDto(long Id, string Name, string ContentType, long Size, string Code, bool? SameAsAnotherStudent = null);

public sealed record ReceiptFile(long Id, string Name, long Size, string Code);

/// <summary>Proof of a turn-in: when, and exactly which files (contract §7).</summary>
public sealed record Receipt(long SubmissionId, int AttemptNumber, DateTime SubmittedAt, bool Late, IReadOnlyList<ReceiptFile> Files);

public sealed record TurnInReceipt(SubmissionDto Submission, Receipt Receipt);

// ------------------------------------------------------------- instructor side

/// <param name="Late">Submitted after the due date.</param>
/// <param name="NotHandedIn">A grade the instructor gave a student who handed in nothing (D-036): no work, no submitted time.</param>
/// <param name="FileName">A file name typed before files were uploaded (D-055); null for newer work.</param>
/// <param name="Link">Assignments: a link the student handed in.</param>
/// <param name="Files">Assignments: the uploaded files of this draft or version; empty for exams.</param>
public sealed record SubmissionDto(long Id, string StudentId, string? StudentName, int AttemptNumber, string Status,
    DateTime? StartedAt, DateTime? SubmittedAt, bool Late, string? Text, string? FileName,
    decimal? Score, decimal MaxPoints, string? Feedback, DateTime? GradedAt, bool NotHandedIn = false,
    string? Link = null, IReadOnlyList<FileDto>? Files = null);

public sealed record StudentRef(string StudentId, string Name);

/// <param name="StudentIds">Students to return to; null returns every student whose latest handed-in work is graded.</param>
public sealed record ReturnInput(IReadOnlyList<string>? StudentIds);

/// <param name="Returned">How many submissions were returned.</param>
public sealed record ReturnResult(int Returned);

/// <summary>A grade for a student who handed in nothing.</summary>
public sealed record MissingGradeInput(decimal? Points, string? Feedback);

/// <param name="Graded">How many students received the grade.</param>
public sealed record MissingGradeResult(int Graded);

/// <param name="Missing">Students on the class list with no handed-in work and no "not handed in" grade yet.</param>
public sealed record SubmissionList(IReadOnlyList<SubmissionDto> Items, IReadOnlyList<StudentRef> Missing);

/// <summary>An attempt with the correct answers beside the student's, for grading.</summary>
public sealed record SubmissionDetail(SubmissionDto Submission, IReadOnlyList<QuestionDto> Questions, IReadOnlyList<AnswerDto> Answers);

/// <param name="Points">Assignments: the score. Exams: ignored; the total is the sum of answer points.</param>
/// <param name="AnswerPoints">Exams: points per question id, required for every essay, optional to override others.</param>
public sealed record GradeInput(decimal? Points, string? Feedback, IReadOnlyDictionary<long, decimal>? AnswerPoints);

// ------------------------------------------------------------------- gradebook

public sealed record CategoryAverage(int Graded, decimal? Average);

/// <param name="Overall">Null until every category with weight above zero has a grade (graded work only).</param>
public sealed record GradebookRow(string StudentId, string Name, CategoryAverage Activities, CategoryAverage Exams, decimal? Overall, bool? Passed);

public sealed record GradebookDto(int ActivityWeight, int ExamWeight, int PassingScore, IReadOnlyList<GradebookRow> Students);

public sealed record GradebookSettingsInput(int? ActivityWeight, int? ExamWeight, int? PassingScore);
