using System.Text.Json;
using Lms.Api.Classes;
using Lms.Api.Data;
using Lms.Api.Isms;
using Lms.Api.Meetings;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Sync;

public sealed record SyncResult(DateTimeOffset At, string? TermName, int Classes, int ActiveClasses, int Students, string? Error);

/// <summary>
/// Copies ISMS classes and class lists into lmsdb so LMS content can reference them.
/// ISMS rows are upserted, never deleted: a class or student ISMS stops listing is marked
/// inactive and everything the LMS holds for it is kept.
/// </summary>
public sealed class IsmsReferenceSync(IIsmsCatalog catalog, LmsDbContext db, TimeProvider time, IMeetingServer meetings, ILogger<IsmsReferenceSync> logger)
{
    /// <summary>Students this sync took off a class list; they leave that class's live meetings once it commits.</summary>
    private readonly List<(string ClassId, string StudentId)> _dropped = [];

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
        // Everything is read from ISMS before anything is written, so a failure part-way changes nothing.
        // Classes of one section share a schedule and the catalog caches each list, so ISMS is asked
        // once per section, not once per class.
        foreach (var item in offered)
        {
            var roster = await catalog.GetScheduleStudentsAsync(item.ScheduleId, ct);
            if (roster.IsStale)
                throw new IsmsException(IsmsFailure.Unreachable, "An ISMS class list is stale; the previous database copy is kept.");
            classLists[item.Id] = roster.Data;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Only rows that can change: the ones offered now and the ones still active. Past terms stay untouched.
        var offeredIds = offered.Select(c => c.Id).ToList();
        var existing = await db.IsmsClasses.Where(c => c.IsActive || offeredIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);
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

        var offeredSet = offeredIds.ToHashSet();
        if (offered.Count == 0 && existing.Values.Any(c => c.IsActive))
        {
            // An empty answer is more likely an ISMS problem than every class ending at once.
            logger.LogWarning("ISMS returned no classes; keeping the {Count} active classes as they are", existing.Values.Count(c => c.IsActive));
        }
        else
        {
            foreach (var row in existing.Values.Where(c => c.IsActive && !offeredSet.Contains(c.Id)))
                row.IsActive = false;
        }
        await db.SaveChangesAsync(ct);
        await AddStartersAsync(offeredIds, ct);

        foreach (var item in offered)
            await SyncClassStudentsAsync(item.Id, classLists[item.Id], now.UtcDateTime, ct);

        var students = await db.IsmsClassStudents.CountAsync(s => s.IsActive &&
            db.IsmsClasses.Any(c => c.Id == s.ClassId && c.IsActive), ct);
        await transaction.CommitAsync(ct);
        // A student taken off a class list leaves its live meeting now, not when their join pass would have run out (D-072).
        await MeetingPresence.RemoveDroppedAsync(db, meetings, _dropped, logger, ct);

        var activeClasses = await db.IsmsClasses.CountAsync(c => c.IsActive, ct);
        return new SyncResult(now, termName, offered.Count, activeClasses, students, null);
    }

    public const string StarterModuleTitle = "Unit 1 · Foundations";

    /// <summary>
    /// Gives every offered class what a new class always had: a starter module when it has no
    /// module yet, and default gradebook weights (40% activities, 60% exams, pass at 60).
    /// </summary>
    private async Task AddStartersAsync(IReadOnlyCollection<string> classIds, CancellationToken ct)
    {
        var withModules = await db.Modules.Where(m => classIds.Contains(m.ClassId)).Select(m => m.ClassId).Distinct().ToListAsync(ct);
        var withSettings = await db.GradebookSettings.Where(g => classIds.Contains(g.ClassId)).Select(g => g.ClassId).ToListAsync(ct);
        foreach (var id in classIds.Except(withModules))
            db.Modules.Add(new Module { ClassId = id, Title = StarterModuleTitle, SortOrder = 1 });
        foreach (var id in classIds.Except(withSettings))
            db.GradebookSettings.Add(new GradebookSetting { ClassId = id });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Upserts one class list; returns the number of active students.</summary>
    private async Task<int> SyncClassStudentsAsync(string classId, IReadOnlyList<IsmsStudent> listed, DateTime now, CancellationToken ct)
    {
        var rows = await db.IsmsClassStudents.Where(s => s.ClassId == classId).ToDictionaryAsync(s => s.StudentId, ct);

        // A row without a student id cannot be matched to anyone; skip it rather than fail the sync.
        listed = listed.Where(s => !string.IsNullOrWhiteSpace(s.StudentId)).ToList();
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
            {
                row.IsActive = false;
                _dropped.Add((classId, row.StudentId));
            }

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
