namespace Lms.Api.Isms;

/// <summary>Data read from ISMS plus when it was fetched.</summary>
/// <param name="SyncedAt">When this copy was fetched from ISMS.</param>
/// <param name="IsStale">True when ISMS could not be reached and an expired copy was served.</param>
public sealed record IsmsSnapshot<T>(T Data, DateTimeOffset SyncedAt, bool IsStale = false);

/// <summary>
/// The LMS's read-side copy of ISMS data. Today this is an in-memory cache in front of
/// <see cref="IIsmsClient"/> (<see cref="MemoryIsmsCatalog"/>); a database-backed copy can
/// implement the same interface later without touching the endpoints.
/// </summary>
public interface IIsmsCatalog
{
    Task<IsmsSnapshot<IReadOnlyList<IsmsLookup>>> GetSchoolYearsAsync(CancellationToken ct = default);
    Task<IsmsSnapshot<IReadOnlyList<IsmsLookup>>> GetSemestersAsync(CancellationToken ct = default);
    Task<IsmsSnapshot<IReadOnlyList<IsmsSubject>>> GetSubjectsAsync(CancellationToken ct = default);
    Task<IsmsSnapshot<IReadOnlyList<IsmsInstructor>>> GetInstructorsAsync(CancellationToken ct = default);
    Task<IsmsSnapshot<IReadOnlyList<IsmsSchedule>>> GetSchedulesAsync(IsmsScheduleQuery query, CancellationToken ct = default);
    Task<IsmsSnapshot<IReadOnlyList<IsmsStudent>>> GetScheduleStudentsAsync(string scheduleId, CancellationToken ct = default);
}
