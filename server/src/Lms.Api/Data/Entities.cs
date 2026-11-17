namespace Lms.Api.Data;

/*
 * The LMS database (lmsdb). Two groups:
 *  - ISMS reference: a read-only copy of what the ISMS API returns, written only by the sync.
 *  - LMS-owned: everything instructors and students create.
 * ISMS people are referenced by their ISMS reference ids (strings), never copied as accounts.
 * All times are UTC.
 */

/// <summary>Who changed a row and when. Set by <see cref="LmsDbContext"/> on save.</summary>
public abstract class Audited
{
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}

// ---------------------------------------------------------------- ISMS reference

/// <summary>One section + subject + instructor offering, copied from ISMS schedules.</summary>
public sealed class IsmsClass
{
    /// <summary>The LMS class id (see Classes/ClassId): stable and URL-safe.</summary>
    public string Id { get; set; } = "";
    public string ScheduleId { get; set; } = "";
    public int SubjectId { get; set; }
    public string? SubjectCode { get; set; }
    public string SubjectName { get; set; } = "";
    public int SectionId { get; set; }
    public string? SectionName { get; set; }
    public string InstructorId { get; set; } = "";
    public string InstructorName { get; set; } = "";
    public int SchoolYearId { get; set; }
    public int SemesterId { get; set; }
    public string? TermName { get; set; }
    /// <summary>Meeting rows as JSON, exactly as ISMS returned them.</summary>
    public string MeetingsJson { get; set; } = "[]";
    /// <summary>False once ISMS stops offering the class; its LMS content is kept.</summary>
    public bool IsActive { get; set; }
    public DateTime SyncedAt { get; set; }
}

/// <summary>A student on an ISMS class list.</summary>
public sealed class IsmsClassStudent
{
    public string ClassId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string EnrollmentId { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string MiddleName { get; set; } = "";
    public string LastName { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime SyncedAt { get; set; }
}

// ---------------------------------------------------------------- LMS-owned

public static class ContentStatus
{
    public const string Active = "active";
    public const string Archived = "archived";
}

public static class CourseworkStatus
{
    public const string Draft = "draft";
    public const string Published = "published";
    public const string Closed = "closed";
    public const string Archived = "archived";
}

public static class CourseworkType
{
    public const string Assignment = "assignment";
    public const string Exam = "exam";
}

public static class QuestionType
{
    public const string MultipleChoice = "multiple_choice";
    public const string TrueFalse = "true_false";
    public const string Essay = "essay";
    public const string Enumeration = "enumeration";
    public const string Matching = "matching";
    /// <summary>A typed answer; any one of the accepted answers is correct.</summary>
    public const string Identification = "identification";
    /// <summary>True or false about an underlined phrase; False needs an accepted correction. All or nothing.</summary>
    public const string ModifiedTrueFalse = "modified_true_false";
}

/// <summary>What a student sees after submitting an exam (D-040).</summary>
public static class AnswerReview
{
    public const string ScoreOnly = "score_only";
    public const string Results = "results";
    public const string AnswersAfterDue = "answers_after_due";
    public const string AnswersAfterSubmit = "answers_after_submit";
    public static readonly IReadOnlyList<string> All = [ScoreOnly, Results, AnswersAfterDue, AnswersAfterSubmit];
}

/// <summary>How near misses in typed answers are scored (D-040).</summary>
public static class SpellingMode
{
    public const string Strict = "strict";
    /// <summary>Near misses get full points and are flagged.</summary>
    public const string Typos = "typos";
    /// <summary>Near misses wait for the instructor's decision.</summary>
    public const string Review = "review";
    public static readonly IReadOnlyList<string> All = [Strict, Typos, Review];
}

/// <summary>How a typed answer matched its key.</summary>
public static class MatchNote
{
    public const string Exact = "exact";
    public const string Typo = "typo";
    public const string Review = "review";
}

/// <summary>The instructor's decision on a near miss.</summary>
public static class SpellingDecision
{
    public const string Accepted = "accepted";
    public const string Rejected = "rejected";
}

public static class SubmissionStatus
{
    public const string InProgress = "in_progress";
    public const string Submitted = "submitted";
    public const string Graded = "graded";
    public const string Returned = "returned";
}

/// <summary>A unit of a class. A parent module makes this a submodule (used from Phase 3).</summary>
public sealed class Module : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    public long? ParentModuleId { get; set; }
    public string Title { get; set; } = "";
    public int SortOrder { get; set; }
}

public sealed class Material : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    public long ModuleId { get; set; }
    public string Title { get; set; } = "";
    public string Kind { get; set; } = "";
    public string? Description { get; set; }
    /// <summary>Filename only: files are not uploaded yet.</summary>
    public string? FileName { get; set; }
    public string? FileType { get; set; }
    public string? FileSize { get; set; }
    public string Status { get; set; } = ContentStatus.Active;
}

public sealed class Announcement : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Status { get; set; } = ContentStatus.Active;
    public DateTime PublishedAt { get; set; }
}

/// <summary>A reusable set of questions. One questionnaire can back exams in many sections.</summary>
public sealed class Questionnaire : Audited
{
    public long Id { get; set; }
    public string OwnerInstructorId { get; set; } = "";
    public int? SubjectId { get; set; }
    public string Title { get; set; } = "";
}

/// <summary>A part of a questionnaire ("Test I. Multiple choice") with directions. Every saved set has at least one.</summary>
public sealed class QuestionSection : Audited
{
    public long Id { get; set; }
    public long QuestionnaireId { get; set; }
    /// <summary>Empty for the unnamed section.</summary>
    public string Title { get; set; } = "";
    public string? Directions { get; set; }
    public decimal? DefaultPoints { get; set; }
    public int SortOrder { get; set; }
}

public sealed class Question : Audited
{
    public long Id { get; set; }
    public long QuestionnaireId { get; set; }
    public long? SectionId { get; set; }
    public string Type { get; set; } = QuestionType.MultipleChoice;
    public string Prompt { get; set; } = "";
    public decimal Points { get; set; } = 1;
    public int SortOrder { get; set; }
    public int? TimeLimitSeconds { get; set; }
    /// <summary>Modified true or false: the phrase the client underlines. Plain text, never HTML.</summary>
    public string? Underlined { get; set; }
    /// <summary>Typed answers: ignore the exam's spelling mode and accept exact matches only.</summary>
    public bool AlwaysStrict { get; set; }
    /// <summary>Typed answers: capitals matter.</summary>
    public bool CaseSensitive { get; set; }
    /// <summary>Saved with allowIncomplete while failing its content rules; blocks publishing.</summary>
    public bool Incomplete { get; set; }
    /// <summary>Why it is incomplete: plain sentences, one per line.</summary>
    public string? Problems { get; set; }
}

/// <summary>A choice. <see cref="IsCorrect"/> is never sent to students.</summary>
public sealed class QuestionOption : Audited
{
    public long Id { get; set; }
    public long QuestionId { get; set; }
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>An accepted answer for enumeration, or the ordered pairs for matching.</summary>
public sealed class QuestionExpectedAnswer : Audited
{
    public long Id { get; set; }
    public long QuestionId { get; set; }
    public string AnswerText { get; set; } = "";
    public int SortOrder { get; set; }
}

/// <summary>An assignment or an exam given to one class.</summary>
public sealed class Coursework : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    public long ModuleId { get; set; }
    public string Type { get; set; } = CourseworkType.Assignment;
    public string Title { get; set; } = "";
    /// <summary>One or two sentences shown on cards and lists.</summary>
    public string? Description { get; set; }
    /// <summary>The instructor's own label, e.g. "Quiz", "Long Quiz", "Exam", "Activity".</summary>
    public string? Category { get; set; }
    public string? Instructions { get; set; }
    public decimal MaxPoints { get; set; } = 100;
    public DateTime? DueAt { get; set; }
    public DateTime? AvailableFrom { get; set; }
    public bool AllowLate { get; set; }
    public bool AllowResubmission { get; set; }
    public int? MaxAttempts { get; set; }
    public int? TimeLimitMinutes { get; set; }
    /// <summary>Exams only.</summary>
    public long? QuestionnaireId { get; set; }
    public string Status { get; set; } = CourseworkStatus.Draft;
    /// <summary>See <see cref="Data.AnswerReview"/>.</summary>
    public string AnswerReview { get; set; } = Data.AnswerReview.Results;
    /// <summary>See <see cref="Data.SpellingMode"/>.</summary>
    public string SpellingMode { get; set; } = Data.SpellingMode.Strict;
    /// <summary>Shuffle questions within each section, seeded by the attempt.</summary>
    public bool ShuffleQuestions { get; set; }
    /// <summary>Shuffle multiple-choice options, seeded by the attempt.</summary>
    public bool ShuffleChoices { get; set; }
}

/// <summary>One attempt by one student.</summary>
public sealed class Submission : Audited
{
    public long Id { get; set; }
    public long CourseworkId { get; set; }
    public string StudentId { get; set; } = "";
    public int AttemptNumber { get; set; } = 1;
    public string Status { get; set; } = SubmissionStatus.InProgress;
    public DateTime? StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public string? Text { get; set; }
    /// <summary>Filename only: files are not uploaded yet.</summary>
    public string? FileName { get; set; }
    /// <summary>When a regrade (a key fix or a spelling change) last changed this attempt's score.</summary>
    public DateTime? ScoreUpdatedAt { get; set; }
}

public sealed class SubmissionAnswer : Audited
{
    public long Id { get; set; }
    public long SubmissionId { get; set; }
    public long QuestionId { get; set; }
    public long? SelectedOptionId { get; set; }
    public string? AnswerText { get; set; }
    public decimal? PointsAwarded { get; set; }
    /// <summary>Typed answers: see <see cref="Data.MatchNote"/>; null when nothing matched.</summary>
    public string? MatchNote { get; set; }
    /// <summary>The instructor's decision on a near miss: see <see cref="Data.SpellingDecision"/>.</summary>
    public string? SpellingDecision { get; set; }
}

public sealed class Grade : Audited
{
    public long Id { get; set; }
    public long SubmissionId { get; set; }
    public decimal Points { get; set; }
    public string? Feedback { get; set; }
    public string GradedBy { get; set; } = "";
    public DateTime GradedAt { get; set; }
}

/// <summary>Today's two category weights. Phase 3 replaces this with flexible grade components.</summary>
public sealed class GradebookSetting : Audited
{
    public string ClassId { get; set; } = "";
    public int ActivityWeight { get; set; } = 40;
    public int ExamWeight { get; set; } = 60;
    public int PassingScore { get; set; } = 60;
}

/// <summary>
/// One month of attendance for a class: how many school days it had. Recorded only; not counted
/// in grades yet. Attendance % = days present / school days x 100.
/// </summary>
public sealed class AttendanceMonth : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    public int Year { get; set; }
    public int Month { get; set; }
    public int SchoolDays { get; set; }
    public List<AttendanceEntry> Entries { get; set; } = [];
}

/// <summary>Days present for one student in one <see cref="AttendanceMonth"/>.</summary>
public sealed class AttendanceEntry : Audited
{
    public long Id { get; set; }
    public long AttendanceMonthId { get; set; }
    public string StudentId { get; set; } = "";
    public int DaysPresent { get; set; }
}

/// <summary>Metadata only: never answers, submission text, comments, or feedback.</summary>
public sealed class AuditLogEntry
{
    public long Id { get; set; }
    public string ActorId { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Category { get; set; } = "";
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public string? TargetId { get; set; }
    public string Summary { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
