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

/// <summary>When students see an assignment's grade (D-054).</summary>
public static class GradeRelease
{
    /// <summary>As soon as it is saved (the behavior before D-054).</summary>
    public const string Immediate = "immediate";
    /// <summary>Once the instructor returns it (POST …/return).</summary>
    public const string Returned = "returned";
    public static readonly IReadOnlyList<string> All = [Immediate, Returned];
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
    /// <summary>Assignments: turned-in work the student took back (D-058). Kept, and never shown to instructors.</summary>
    public const string Withdrawn = "withdrawn";
}

/// <summary>What a student may hand in for an assignment (contract §5). Stored as a comma-separated column (L-074).</summary>
public static class SubmissionKind
{
    public const string Text = "text";
    public const string File = "file";
    public const string Link = "link";
    public static readonly IReadOnlyList<string> All = [Text, File, Link];
    public const string Default = "text,file";

    public static IReadOnlyList<string> Parse(string? stored) =>
        (stored ?? Default).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(All.Contains).Distinct().ToList() is { Count: > 0 } kinds
            ? All.Where(kinds.Contains).ToList() : Parse(Default);

    public static string Store(IEnumerable<string> kinds) => string.Join(',', All.Where(kinds.Contains));
}

/// <summary>How a stored file was checked for malware (D-055).</summary>
public static class ScanStatus
{
    public const string Clean = "clean";
    /// <summary>Development and Demo only: no scanner is configured there.</summary>
    public const string NotScanned = "not_scanned";
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
    /// <summary>
    /// The file's name, type and size as text. Materials made before files were uploaded have only
    /// these (a name with no bytes); an uploaded file fills them in too (D-067).
    /// </summary>
    public string? FileName { get; set; }
    public string? FileType { get; set; }
    public string? FileSize { get; set; }
    public string Status { get; set; } = ContentStatus.Active;
    /// <summary>The uploaded file (D-067). Null when the material has no file, or only a name.</summary>
    public long? FileId { get; set; }
    /// <summary>A PDF copy made from an Office file, shown as its preview.</summary>
    public long? PreviewFileId { get; set; }
    /// <summary>Office files only: see <see cref="Data.PreviewStatus"/>. Null for files that are their own preview.</summary>
    public string? PreviewStatus { get; set; }
}

/// <summary>How an Office file's preview turned out (D-067).</summary>
public static class PreviewStatus
{
    public const string Ready = "ready";
    /// <summary>LibreOffice could not turn it into a PDF in time.</summary>
    public const string Failed = "failed";
    /// <summary>The server had no converter when the file was uploaded.</summary>
    public const string Off = "off";
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
    /// <summary>Assignments: the last moment late work is accepted ("accept until"); needs <see cref="AllowLate"/> and a due date (D-054).</summary>
    public DateTime? CloseAt { get; set; }
    /// <summary>Assignments: see <see cref="Data.GradeRelease"/>.</summary>
    public string GradeRelease { get; set; } = Data.GradeRelease.Immediate;
    /// <summary>Assignments: see <see cref="SubmissionKind"/>.</summary>
    public string SubmissionKinds { get; set; } = SubmissionKind.Default;
    /// <summary>Assignments: accepted file types, comma-separated (see Files/FileTypes); null accepts every allowed type.</summary>
    public string? AllowedFileTypes { get; set; }
    /// <summary>Assignments: files per turn-in, 1 to 5.</summary>
    public int MaxFiles { get; set; } = 5;
    /// <summary>Assignments: the student confirms "This is my own work" to turn in.</summary>
    public bool HonorStatement { get; set; }
    /// <summary>Assignments: percent taken off the earned score per calendar day late; 0 is no penalty (D-062).</summary>
    public int LatePenaltyPercentPerDay { get; set; }
    /// <summary>Assignments: the most a late penalty can take off, 1 to 100.</summary>
    public int LatePenaltyMaxPercent { get; set; } = 100;
    /// <summary>Assignments: the rubric it is graded with; it is then worth the rubric's total (D-062).</summary>
    public long? RubricId { get; set; }
}

/// <summary>
/// One student's own terms for one assignment (D-062): a later due date, their own last day for
/// late work, or being excused. At most one row per student and assignment.
/// </summary>
public sealed class CourseworkException : Audited
{
    public long Id { get; set; }
    public long CourseworkId { get; set; }
    public string StudentId { get; set; } = "";
    /// <summary>The student's own due date; null when only excused.</summary>
    public DateTime? DueAt { get; set; }
    /// <summary>The student's own last day for late work; null follows the assignment (see StudentDates).</summary>
    public DateTime? CloseAt { get; set; }
    /// <summary>Not counted for this assignment: nothing to hand in, and out of the average and the close rule.</summary>
    public bool Excused { get; set; }
}

/// <summary>A grading rubric of one class: criteria, each with levels worth points (D-062).</summary>
public sealed class Rubric : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    public string Title { get; set; } = "";
}

public sealed class RubricCriterion
{
    public long Id { get; set; }
    public long RubricId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public sealed class RubricLevel
{
    public long Id { get; set; }
    public long CriterionId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public decimal Points { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>The level an instructor chose for one criterion of one grade. Its existence locks the rubric.</summary>
public sealed class GradeRubricScore
{
    public long GradeId { get; set; }
    public long CriterionId { get; set; }
    public long LevelId { get; set; }
    /// <summary>The level's points when it was chosen.</summary>
    public decimal Points { get; set; }
}

/// <summary>A feedback comment an instructor saved to reuse (D-062). Theirs alone, across classes.</summary>
public sealed class SavedComment : Audited
{
    public long Id { get; set; }
    public string OwnerInstructorId { get; set; } = "";
    public string Text { get; set; } = "";
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
    /// <summary>A file name the student typed before files were uploaded (before D-055). Never set by new work.</summary>
    public string? FileName { get; set; }
    /// <summary>Assignments: a link the student handed in.</summary>
    public string? Link { get; set; }
    /// <summary>Assignments: when the student confirmed the honor statement for this turn-in.</summary>
    public DateTime? HonorAcceptedAt { get; set; }
    /// <summary>When a regrade (a key fix or a spelling change) last changed this attempt's score.</summary>
    public DateTime? ScoreUpdatedAt { get; set; }
    /// <summary>When retention cleared this attempt's text (contract §7); such an attempt is never re-scored.</summary>
    public DateTime? AnonymizedAt { get; set; }
}

/// <summary>
/// A file someone uploaded: a student's work (D-055), or a class material and its preview copy
/// (D-067). The bytes live in the file store under <see cref="StorageKey"/>; this row is what the LMS
/// knows about them. Work belongs to submissions through <see cref="SubmissionFile"/>; a material
/// points at its files itself.
/// </summary>
public sealed class StoredFile : Audited
{
    public long Id { get; set; }
    public string ClassId { get; set; } = "";
    /// <summary>The assignment a student's file was handed in for. Null for a material's files.</summary>
    public long? CourseworkId { get; set; }
    /// <summary>Who uploaded it: the student, or the instructor for a material.</summary>
    public string OwnerId { get; set; } = "";
    /// <summary>Random; never derived from the name.</summary>
    public string StorageKey { get; set; } = "";
    /// <summary>The name it was uploaded with, cleaned. Shown and used for the download only.</summary>
    public string Name { get; set; } = "";
    /// <summary>Decided from the bytes, never from the upload's header.</summary>
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    /// <summary>The SHA-256 of the bytes, in lowercase hex.</summary>
    public string ContentHash { get; set; } = "";
    public string ScanStatus { get; set; } = Data.ScanStatus.NotScanned;
    /// <summary>When the bytes were deleted: no version uses the file any more, or retention removed it.</summary>
    public DateTime? DeletedAt { get; set; }
}

/// <summary>A file on one draft or version. A new draft reuses the files of the version it was copied from.</summary>
public sealed class SubmissionFile
{
    public long SubmissionId { get; set; }
    public long FileId { get; set; }
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
    /// <summary>Points the instructor gave an automatically scored question; a re-score keeps them.</summary>
    public decimal? ManualPoints { get; set; }
}

public sealed class Grade : Audited
{
    public long Id { get; set; }
    public long SubmissionId { get; set; }
    public decimal Points { get; set; }
    public string? Feedback { get; set; }
    public string GradedBy { get; set; } = "";
    public DateTime GradedAt { get; set; }
    /// <summary>When the instructor returned it, for assignments that hold grades until then (D-054).</summary>
    public DateTime? ReturnedAt { get; set; }
    /// <summary>The instructor waived this student's late penalty (D-062). <see cref="Points"/> is always the raw score.</summary>
    public bool PenaltyWaived { get; set; }
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
