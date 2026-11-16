namespace Isms.Api.Isms;

// Read-only shapes of the ISMS tables this API exposes. Only the columns the API
// actually needs are mapped; table and column names match the ISMS schema exactly
// (see IsmsDbContext). Personal fields that are never exposed (birthdates, addresses,
// contact details, passwords, ...) are deliberately not mapped at all.

public sealed class Subject
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? ShortCode { get; set; }
    public int Units { get; set; }
    public string Status { get; set; } = "";
}

public sealed class Employee
{
    public int Id { get; set; }
    public string RefId { get; set; } = "";
    public string? EmpNo { get; set; }
    public string? Fname { get; set; }
    public string? Mname { get; set; }
    public string? Lname { get; set; }
    public string? Suffix { get; set; }
    public string? Honorific { get; set; }
    public string? DepartmentId { get; set; }
    public string Status { get; set; } = "";
}

public sealed class SchoolYear
{
    public int Id { get; set; }
    public int Syfrom { get; set; }
    public int Syto { get; set; }
    public string Standing { get; set; } = "";
    public string Status { get; set; } = "";
}

public sealed class Semester
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string StandingId { get; set; } = "";
    public string Status { get; set; } = "";
}

public sealed class Section
{
    public int Id { get; set; }
    public string? Name { get; set; }
}

public sealed class Schedule
{
    public int Id { get; set; }
    public string RefId { get; set; } = "";
    public int SyId { get; set; }
    public int SemesterId { get; set; }
    public int SectionId { get; set; }
    public string Status { get; set; } = "";
}

public sealed class ScheduleItem
{
    public int Id { get; set; }
    public string RefId { get; set; } = "";
    public int SubjectId { get; set; }
    public string InstructorId { get; set; } = "";
    public int RoomId { get; set; }
    public int Modality { get; set; }
    public string DayId { get; set; } = "";
    public TimeSpan TimeFrom { get; set; }
    public TimeSpan TimeTo { get; set; }
}

public sealed class ScheduleStudent
{
    public int Id { get; set; }
    public string RefId { get; set; } = "";
    public string EnrollmentId { get; set; } = "";
}

public sealed class Enrollment
{
    public int Id { get; set; }
    public string RefId { get; set; } = "";
    public string StudentId { get; set; } = "";
}

public sealed class Student
{
    public int Id { get; set; }
    public string RefId { get; set; } = "";
    public string? Fname { get; set; }
    public string? Mname { get; set; }
    public string? Lname { get; set; }
}
