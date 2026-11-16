namespace Lms.Api.Isms;

// Shapes returned by the ISMS API (camelCase JSON). Unknown extra fields are ignored on read.

public sealed record IsmsPage<T>(IReadOnlyList<T>? Items, int Page, int PageSize, int Total);

public sealed record IsmsLookup(int Id, string Name, string? Status);

public sealed record IsmsSubject(int Id, string? Code, string Name, int Units, string? Status);

public sealed record IsmsInstructor(
    string Id,
    string? EmployeeNo,
    string? FirstName,
    string? MiddleName,
    string? LastName,
    string? Suffix,
    string? Honorific,
    string? DepartmentId,
    string? Status);

public sealed record IsmsMeeting(string Day, string TimeFrom, string TimeTo, int RoomId, int Modality);

public sealed record IsmsSchedule(
    string ScheduleId,
    int SchoolYearId,
    int SemesterId,
    int SectionId,
    string? SectionName,
    int SubjectId,
    string? SubjectCode,
    string SubjectName,
    string InstructorId,
    string InstructorName,
    IReadOnlyList<IsmsMeeting>? Meetings);

public sealed record IsmsStudent(
    string StudentId,
    string EnrollmentId,
    string? FirstName,
    string? MiddleName,
    string? LastName);

/// <summary>Optional filters for GET /v1/schedules.</summary>
public sealed record IsmsScheduleQuery(int? SchoolYearId = null, int? SemesterId = null, string? InstructorId = null, int? SubjectId = null);

/// <summary>Result of a lightweight authenticated call used by the status diagnostic.</summary>
/// <param name="StatusCode">HTTP status ISMS answered with, or null when it could not be reached.</param>
public sealed record IsmsProbeResult(int? StatusCode);
