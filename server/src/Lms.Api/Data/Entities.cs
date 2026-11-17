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

public sealed class Question : Audited
{
    public long Id { get; set; }
    public long QuestionnaireId { get; set; }
    public string Type { get; set; } = QuestionType.MultipleChoice;
    public string Prompt { get; set; } = "";
    public decimal Points { get; set; } = 1;
    public int SortOrder { get; set; }
    public int? TimeLimitSeconds { get; set; }
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
}

public sealed class SubmissionAnswer : Audited
{
    public long Id { get; set; }
    public long SubmissionId { get; set; }
    public long QuestionId { get; set; }
    public long? SelectedOptionId { get; set; }
    public string? AnswerText { get; set; }
    public decimal? PointsAwarded { get; set; }
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
