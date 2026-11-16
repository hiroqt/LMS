using Lms.Api.Isms;

namespace Lms.Api.Classes;

public sealed record ClassMeeting(string Day, string TimeFrom, string TimeTo, int RoomId, int Modality);

/// <summary>An LMS class: one ISMS section + subject + instructor offering.</summary>
public sealed record LmsClass(
    string Id,
    string ScheduleId,
    int SubjectId,
    string? SubjectCode,
    string SubjectName,
    int SectionId,
    string? SectionName,
    string InstructorId,
    string InstructorName,
    int SchoolYearId,
    int SemesterId,
    IReadOnlyList<ClassMeeting> Meetings);

public static class ClassMapper
{
    /// <summary>
    /// Turns ISMS schedule rows into LMS classes. Rows for the same scheduleId + subjectId +
    /// instructorId (for example one row per meeting) become one class with their meetings merged
    /// and de-duplicated. Output is sorted by subject, section, then instructor.
    /// </summary>
    public static IReadOnlyList<LmsClass> FromSchedules(IEnumerable<IsmsSchedule> schedules) =>
        schedules
            .Where(s => !string.IsNullOrEmpty(s.ScheduleId) && !string.IsNullOrEmpty(s.InstructorId))
            .GroupBy(s => (s.ScheduleId, s.SubjectId, s.InstructorId))
            .Select(g =>
            {
                var first = g.First();
                var meetings = g
                    .SelectMany(s => s.Meetings ?? [])
                    .Select(m => new ClassMeeting(m.Day, m.TimeFrom, m.TimeTo, m.RoomId, m.Modality))
                    .Distinct()
                    .ToList();

                return new LmsClass(
                    ClassId.Create(first.ScheduleId, first.SubjectId, first.InstructorId),
                    first.ScheduleId,
                    first.SubjectId,
                    first.SubjectCode,
                    first.SubjectName,
                    first.SectionId,
                    first.SectionName,
                    first.InstructorId,
                    first.InstructorName,
                    first.SchoolYearId,
                    first.SemesterId,
                    meetings);
            })
            .OrderBy(c => c.SubjectCode ?? c.SubjectName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.SubjectName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.SectionName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.InstructorName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.Id, StringComparer.Ordinal)
            .ToList();
}
