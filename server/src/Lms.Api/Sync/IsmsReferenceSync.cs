using System.Text.Json;
using Lms.Api.Classes;
using Lms.Api.Data;
using Lms.Api.Isms;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Sync;

public sealed record SyncResult(DateTimeOffset At, string? TermName, int Classes, int ActiveClasses, int Students, string? Error);

/// <summary>
/// Copies ISMS classes and class lists into lmsdb so LMS content can reference them.
/// ISMS rows are upserted, never deleted: a class or student ISMS stops listing is marked
/// inactive and everything the LMS holds for it is kept.
/// </summary>
public sealed class IsmsReferenceSync(IIsmsCatalog catalog, LmsDbContext db, TimeProvider time, ILogger<IsmsReferenceSync> logger)
{
    /// <summary>Classes of the current ISMS term (all classes when ISMS flags none), then their class lists.</summary>
    public async Task<SyncResult> SyncAsync(CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var term = await IsmsTerms.ResolveCurrentAsync(catalog, ct, requireFresh: true);
        var schedules = await catalog.GetSchedulesAsync(new IsmsScheduleQuery(term?.SchoolYearId, term?.SemesterId), ct);
        if (schedules.IsStale)
            throw new IsmsException(IsmsFailure.Unreachable, "ISMS schedules are stale; the previous database copy is kept.");
        var offered = ClassMapper.FromSchedules(schedules.Data);
        var termName = IsmsTerms.DisplayName(term);
        var classLists = new Dictionary<string, IReadOnlyList<IsmsStudent>>();
        foreach (var item in offered)
        {
            var roster = await catalog.GetScheduleStudentsAsync(item.ScheduleId, ct);
            if (roster.IsStale)
                throw new IsmsException(IsmsFailure.Unreachable, "An ISMS class list is stale; the previous database copy is kept.");
            classLists[item.Id] = roster.Data;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var existing = await db.IsmsClasses.ToDictionaryAsync(c => c.Id, ct);
        foreach (var item in offered)
        {
            if (!existing.TryGetValue(item.Id, out var row))
            {
                row = new IsmsClass { Id = item.Id };
                db.IsmsClasses.Add(row);
                existing[item.Id] = row;
            }
            row.ScheduleId = item.ScheduleId;
            row.SubjectId = item.SubjectId;
            row.SubjectCode = item.SubjectCode;
            row.SubjectName = item.SubjectName;
            row.SectionId = item.SectionId;
            row.SectionName = item.SectionName;
            row.InstructorId = item.InstructorId;
            row.InstructorName = item.InstructorName;
            row.SchoolYearId = item.SchoolYearId;
            row.SemesterId = item.SemesterId;
            row.TermName = termName ?? row.TermName;
            row.MeetingsJson = JsonSerializer.Serialize(item.Meetings, JsonSerializerOptions.Web);
            row.IsActive = true;
            row.SyncedAt = now.UtcDateTime;
        }

        var offeredIds = offered.Select(c => c.Id).ToHashSet();
        if (offered.Count == 0 && existing.Values.Any(c => c.IsActive))
        {
            // An empty answer is more likely an ISMS problem than every class ending at once.
            logger.LogWarning("ISMS returned no classes; keeping the {Count} active classes as they are", existing.Values.Count(c => c.IsActive));
        }
        else
        {
            foreach (var row in existing.Values.Where(c => c.IsActive && !offeredIds.Contains(c.Id)))
                row.IsActive = false;
        }
        await db.SaveChangesAsync(ct);

        foreach (var item in offered)
            await SyncClassStudentsAsync(item.Id, classLists[item.Id], now.UtcDateTime, ct);

        var students = await db.IsmsClassStudents.CountAsync(s => s.IsActive &&
            db.IsmsClasses.Any(c => c.Id == s.ClassId && c.IsActive), ct);
        await transaction.CommitAsync(ct);

        return new SyncResult(now, termName, existing.Count, existing.Values.Count(c => c.IsActive), students, null);
    }

    /// <summary>Upserts one class list; returns the number of active students.</summary>
    private async Task<int> SyncClassStudentsAsync(string classId, IReadOnlyList<IsmsStudent> listed, DateTime now, CancellationToken ct)
    {
        var rows = await db.IsmsClassStudents.Where(s => s.ClassId == classId).ToDictionaryAsync(s => s.StudentId, ct);

        foreach (var student in listed)
        {
            if (!rows.TryGetValue(student.StudentId, out var row))
            {
                row = new IsmsClassStudent { ClassId = classId, StudentId = student.StudentId };
                db.IsmsClassStudents.Add(row);
                rows[student.StudentId] = row;
            }
            row.EnrollmentId = student.EnrollmentId;
            row.FirstName = student.FirstName ?? "";
            row.MiddleName = student.MiddleName ?? "";
            row.LastName = student.LastName ?? "";
            row.IsActive = true;
            row.SyncedAt = now;
        }

        var listedIds = listed.Select(s => s.StudentId).ToHashSet();
        if (listed.Count == 0 && rows.Values.Any(r => r.IsActive))
            logger.LogWarning("ISMS returned an empty class list; keeping the previous active students");
        else
            foreach (var row in rows.Values.Where(r => r.IsActive && !listedIds.Contains(r.StudentId)))
                row.IsActive = false;

        await db.SaveChangesAsync(ct);
        return rows.Values.Count(r => r.IsActive);
    }
}

/// <summary>The outcome of the most recent sync, for the status endpoint.</summary>
public sealed class SyncState
{
    private SyncResult? _last;
    public SyncResult? Last => Volatile.Read(ref _last);
    public void Record(SyncResult result) => Volatile.Write(ref _last, result);
}

public sealed class SyncOptions
{
    public const string SectionName = "Lms:Sync";
    public bool Enabled { get; set; } = true;
    public int IntervalMinutes { get; set; } = 15;
}

/// <summary>Runs the sync at startup and then every <see cref="SyncOptions.IntervalMinutes"/>.</summary>
public sealed class IsmsSyncWorker(IServiceScopeFactory scopes, SyncState state, TimeProvider time, Microsoft.Extensions.Options.IOptions<SyncOptions> options, ILogger<IsmsSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.IntervalMinutes));
        while (!stoppingToken.IsCancellationRequested)
        {
            await RunOnceAsync(scopes, state, time, logger, stoppingToken);
            try { await Task.Delay(interval, time, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    public static async Task<SyncResult> RunOnceAsync(IServiceScopeFactory scopes, SyncState state, TimeProvider time, ILogger logger, CancellationToken ct)
    {
        SyncResult result;
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            result = await scope.ServiceProvider.GetRequiredService<IsmsReferenceSync>().SyncAsync(ct);
            logger.LogInformation("ISMS sync: {Active} active classes, {Students} students", result.ActiveClasses, result.Students);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Never let one failed sync stop the worker; the previous copy stays in place.
            logger.LogWarning(ex, "ISMS sync failed");
            var previous = state.Last;
            result = new SyncResult(time.GetUtcNow(), previous?.TermName, previous?.Classes ?? 0, previous?.ActiveClasses ?? 0, previous?.Students ?? 0, ex is IsmsException ? "ISMS could not be read." : "The sync failed; see the server log.");
        }
        state.Record(result);
        return result;
    }
}
