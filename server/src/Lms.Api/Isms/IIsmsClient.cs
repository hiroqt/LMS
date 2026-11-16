namespace Lms.Api.Isms;

/// <summary>
/// Typed client for the ISMS API. List methods follow every page and return the full list.
/// Failures are thrown as <see cref="IsmsException"/>.
/// </summary>
public interface IIsmsClient
{
    Task<IReadOnlyList<IsmsLookup>> GetSchoolYearsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<IsmsLookup>> GetSemestersAsync(CancellationToken ct = default);
    Task<IReadOnlyList<IsmsSubject>> GetSubjectsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<IsmsInstructor>> GetInstructorsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<IsmsSchedule>> GetSchedulesAsync(IsmsScheduleQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<IsmsStudent>> GetScheduleStudentsAsync(string scheduleId, CancellationToken ct = default);

    /// <summary>One small authenticated request; never throws for HTTP or network failures.</summary>
    Task<IsmsProbeResult> ProbeAsync(CancellationToken ct = default);
}
