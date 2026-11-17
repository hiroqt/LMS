using Lms.Api.Coursework;

namespace Lms.Api.Submissions;

// ---------------------------------------------------------------- student side

public sealed record StudentOption(long Id, string Text);

/// <summary>A question as a student sees it: no correct answers. Matching gives the right-hand
/// items in alphabetical order; enumeration says how many items are expected.</summary>
public sealed record StudentQuestion(long Id, string Type, string Prompt, decimal Points, int? TimeLimitSeconds,
    IReadOnlyList<StudentOption> Options, int? ItemCount, IReadOnlyList<StudentOption> Lefts, IReadOnlyList<string> Rights);

/// <param name="PointsAwarded">Shown to the student once the attempt is submitted.</param>
public sealed record AnswerDto(long QuestionId, long? OptionId, string? Text, IReadOnlyList<string> Items,
    IReadOnlyDictionary<long, string> Matches, decimal? PointsAwarded);

/// <param name="Deadline">When saving stops: the time limit, or the due date when late work is not allowed.</param>
public sealed record AttemptDto(long Id, int AttemptNumber, string Status, DateTime? StartedAt, DateTime? SubmittedAt,
    DateTime? Deadline, decimal? Score, decimal MaxPoints, string? Feedback,
    IReadOnlyList<StudentQuestion> Questions, IReadOnlyList<AnswerDto> Answers);

/// <summary>One answer. Use the field for the question's type: optionId (multiple choice, true/false),
/// text (essay), items (enumeration), matches (matching: left option id to right text).</summary>
public sealed record AnswerInput(long QuestionId, long? OptionId, string? Text, IReadOnlyList<string?>? Items, IReadOnlyDictionary<long, string?>? Matches);

public sealed record AnswersInput(IReadOnlyList<AnswerInput>? Answers);

public sealed record AssignmentSubmit(string? Text, string? FileName);

// ------------------------------------------------------------- instructor side

/// <param name="Late">Submitted after the due date.</param>
/// <param name="NotHandedIn">A grade the instructor gave a student who handed in nothing (D-036): no work, no submitted time.</param>
public sealed record SubmissionDto(long Id, string StudentId, string? StudentName, int AttemptNumber, string Status,
    DateTime? StartedAt, DateTime? SubmittedAt, bool Late, string? Text, string? FileName,
    decimal? Score, decimal MaxPoints, string? Feedback, DateTime? GradedAt, bool NotHandedIn = false);

public sealed record StudentRef(string StudentId, string Name);

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
