using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Lms.Api.Isms;

/// <summary>
/// In-memory cache of ISMS reads. A copy is fresh for Isms:CacheTtlSeconds. After that the next
/// request refetches; if ISMS is unreachable or rate limiting, the expired copy is served for up
/// to Isms:MaxStaleSeconds more (stale-serve). 401/403 are never masked by stale data, so a
/// credentials problem shows up immediately.
/// </summary>
internal sealed class MemoryIsmsCatalog(
    IIsmsClient client,
    IMemoryCache cache,
    IsmsFetchLocks locks,
    TimeProvider time,
    IOptions<IsmsOptions> options,
    ILogger<MemoryIsmsCatalog> logger) : IIsmsCatalog
{
    private const string KeyPrefix = "isms:";

    public Task<IsmsSnapshot<IReadOnlyList<IsmsLookup>>> GetSchoolYearsAsync(CancellationToken ct = default) =>
        GetAsync("school-years", client.GetSchoolYearsAsync, ct);

    public Task<IsmsSnapshot<IReadOnlyList<IsmsLookup>>> GetSemestersAsync(CancellationToken ct = default) =>
        GetAsync("semesters", client.GetSemestersAsync, ct);

    public Task<IsmsSnapshot<IReadOnlyList<IsmsSubject>>> GetSubjectsAsync(CancellationToken ct = default) =>
        GetAsync("subjects", client.GetSubjectsAsync, ct);

    public Task<IsmsSnapshot<IReadOnlyList<IsmsInstructor>>> GetInstructorsAsync(CancellationToken ct = default) =>
        GetAsync("instructors", client.GetInstructorsAsync, ct);

    public Task<IsmsSnapshot<IReadOnlyList<IsmsSchedule>>> GetSchedulesAsync(IsmsScheduleQuery query, CancellationToken ct = default) =>
        GetAsync(
            $"schedules?sy={query.SchoolYearId}&sem={query.SemesterId}&ins={query.InstructorId}&subj={query.SubjectId}",
            token => client.GetSchedulesAsync(query, token),
            ct);

    public Task<IsmsSnapshot<IReadOnlyList<IsmsStudent>>> GetScheduleStudentsAsync(string scheduleId, CancellationToken ct = default) =>
        GetAsync($"schedule-students:{scheduleId}", token => client.GetScheduleStudentsAsync(scheduleId, token), ct);

    private async Task<IsmsSnapshot<T>> GetAsync<T>(string key, Func<CancellationToken, Task<T>> fetch, CancellationToken ct)
    {
        key = KeyPrefix + key;
        var ttl = TimeSpan.FromSeconds(options.Value.CacheTtlSeconds);
        var maxStale = TimeSpan.FromSeconds(options.Value.MaxStaleSeconds);

        if (TryGetFresh<T>(key, ttl, out var fresh)) return fresh;

        // One fetch per key at a time, so a burst of requests on a cold cache hits ISMS once.
        var gate = locks.For(key);
        await gate.WaitAsync(ct);
        try
        {
            if (TryGetFresh(key, ttl, out fresh)) return fresh;
            cache.TryGetValue(key, out IsmsSnapshot<T>? previous);

            try
            {
                var data = await fetch(ct);
                var snapshot = new IsmsSnapshot<T>(data, time.GetUtcNow());
                // Kept past the TTL so it can be served stale; evicted once it is too old for that.
                // Size 1 counts the entry against the cache's SizeLimit, which bounds memory.
                cache.Set(key, snapshot, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = ttl + maxStale + TimeSpan.FromSeconds(1),
                    Size = 1,
                });
                return snapshot;
            }
            catch (IsmsException ex) when (ex.AllowsStaleServe && previous is not null && time.GetUtcNow() - previous.SyncedAt <= ttl + maxStale)
            {
                logger.LogWarning("Serving stale ISMS data for {CacheKey} synced at {SyncedAt}: {Failure}", key, previous.SyncedAt, ex.Failure);
                return previous with { IsStale = true };
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private bool TryGetFresh<T>(string key, TimeSpan ttl, out IsmsSnapshot<T> snapshot)
    {
        if (cache.TryGetValue(key, out IsmsSnapshot<T>? cached) && cached is not null && time.GetUtcNow() - cached.SyncedAt < ttl)
        {
            snapshot = cached;
            return true;
        }
        snapshot = null!;
        return false;
    }
}

/// <summary>
/// Fetch locks shared across requests (the catalog itself is scoped). A fixed set of locks is
/// picked by key hash, so caller-chosen keys can never grow memory; two keys sharing a lock
/// only means their fetches run one after the other.
/// </summary>
internal sealed class IsmsFetchLocks
{
    private readonly SemaphoreSlim[] _locks = [.. Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1))];

    public SemaphoreSlim For(string key) => _locks[(uint)string.GetHashCode(key, StringComparison.Ordinal) % (uint)_locks.Length];
}
