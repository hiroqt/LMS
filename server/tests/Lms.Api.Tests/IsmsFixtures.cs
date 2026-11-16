namespace Lms.Api.Tests;

/// <summary>Sample ISMS payloads, with an unknown extra field to prove tolerance.</summary>
public static class IsmsFixtures
{
    public static object Schedule(string scheduleId, int subjectId, string instructorId, params object[] meetings) => new
    {
        scheduleId,
        schoolYearId = 2026,
        semesterId = 1,
        sectionId = 31,
        sectionName = "BSIT 2-A",
        subjectId,
        subjectCode = subjectId == 101 ? "IT 201" : "IT 305",
        subjectName = subjectId == 101 ? "Data Structures" : "Web Systems",
        instructorId,
        instructorName = instructorId == "EMP-7" ? "Santos, Maria" : "Reyes, Jose",
        meetings,
        someFutureIsmsField = new { nested = true },
    };

    public static object Meeting(string day, string from, string to, int roomId = 12, int modality = 1) =>
        new { day, timeFrom = from, timeTo = to, roomId, modality, unknownMeetingField = "x" };

    public static object Subject(int id, string? code, string name) =>
        new { id, code, name, units = 3, status = "active", extra = 42 };

    public static object Instructor(string id) => new
    {
        id,
        employeeNo = "E-0007",
        firstName = "Maria",
        middleName = (string?)null,
        lastName = "Santos",
        suffix = (string?)null,
        honorific = "Dr.",
        departmentId = "D04",
        status = "active",
        email = "ignored@example.test",
    };

    public static object Student(string studentId) => new
    {
        studentId,
        enrollmentId = "ENR-" + studentId,
        firstName = "Ana",
        middleName = "B",
        lastName = "Cruz",
        yearLevel = 2,
    };
}
