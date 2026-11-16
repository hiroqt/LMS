using System.Net;
using System.Text.Json;
using Lms.Api.Classes;
using Lms.Api.Data;
using Lms.Api.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using static Lms.Api.Tests.IsmsFixtures;

namespace Lms.Api.Tests;

public sealed class DatabaseTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    private StubIsmsHandler Isms => _factory.Isms;

    public void Dispose() => _factory.Dispose();

    private static readonly object[] CurrentYear = [new { id = 1, name = "2025-2026", status = "1", isCurrent = false }, new { id = 2026, name = "2026-2027", status = "1", isCurrent = true }];
    private static readonly object[] CurrentSemester = [new { id = 1, name = "1st Semester", status = "1", isCurrent = true }];

    /// <summary>ISMS offers these schedules, with these class lists.</summary>
    private void IsmsOffers(object[] schedules, Dictionary<string, object[]> students)
    {
        var routes = new Dictionary<string, Func<HttpRequestMessage, HttpResponseMessage>>
        {
            ["/v1/school-years"] = _ => StubIsmsHandler.Page(CurrentYear),
            ["/v1/semesters"] = _ => StubIsmsHandler.Page(CurrentSemester),
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(schedules),
        };
        foreach (var (scheduleId, list) in students)
            routes[$"/v1/schedules/{scheduleId}/students"] = _ => StubIsmsHandler.Page(list);
        Isms.Responder = StubIsmsHandler.Routes(routes);
        // Past the catalog's cache, so the next sync asks ISMS again.
        _factory.Time.Now += TimeSpan.FromHours(1);
    }

    private Task<SyncResult> SyncAsync() =>
        _factory.WithServiceAsync<IsmsReferenceSync, SyncResult>(sync => sync.SyncAsync(CancellationToken.None));

    private static readonly string Database = ClassId.Create("SCH-1", 101, "EMP-7");
    private static readonly string Web = ClassId.Create("SCH-1", 102, "EMP-9");

    [Fact]
    public async Task Sync_copies_current_term_classes_and_class_lists()
    {
        IsmsOffers(
            [Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30")), Schedule("SCH-1", 102, "EMP-9", Meeting("F", "13:00", "14:00"))],
            new() { ["SCH-1"] = [Student("S-1"), Student("S-2")] });

        var result = await SyncAsync();

        Assert.Equal("2026-2027 · 1st Semester", result.TermName);
        Assert.Equal(2, result.ActiveClasses);
        var schedulesQuery = Isms.RequestsTo("/v1/schedules").Single().RequestUri!.Query;
        Assert.Contains("schoolYearId=2026", schedulesQuery);
        Assert.Contains("semesterId=1", schedulesQuery);

        var row = await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync(c => c.Id == Database));
        Assert.Equal("EMP-7", row.InstructorId);
        Assert.Equal("BSIT 2-A", row.SectionName);
        Assert.Equal("2026-2027 · 1st Semester", row.TermName);
        Assert.True(row.IsActive);
        Assert.Equal("MW", JsonDocument.Parse(row.MeetingsJson).RootElement[0].GetProperty("day").GetString());

        var students = await _factory.WithDbAsync(db => db.IsmsClassStudents.Where(s => s.ClassId == Database && s.IsActive).Select(s => s.StudentId).OrderBy(s => s).ToListAsync());
        Assert.Equal(["S-1", "S-2"], students);
    }

    [Fact]
    public async Task A_class_or_student_ISMS_drops_is_marked_inactive_and_its_content_is_kept()
    {
        IsmsOffers(
            [Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30")), Schedule("SCH-1", 102, "EMP-9", Meeting("F", "13:00", "14:00"))],
            new() { ["SCH-1"] = [Student("S-1"), Student("S-2")] });
        await SyncAsync();
        await _factory.WithDbAsync(async db =>
        {
            db.Modules.Add(new Module { ClassId = Web, Title = "Unit 1", SortOrder = 1 });
            return await db.SaveChangesAsync();
        });

        IsmsOffers([Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))], new() { ["SCH-1"] = [Student("S-2")] });
        await SyncAsync();

        var web = await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync(c => c.Id == Web));
        Assert.False(web.IsActive);
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Modules.CountAsync(m => m.ClassId == Web)));
        var s1 = await _factory.WithDbAsync(db => db.IsmsClassStudents.SingleAsync(s => s.ClassId == Database && s.StudentId == "S-1"));
        Assert.False(s1.IsActive);

        // Offered again: the same row comes back.
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30")), Schedule("SCH-1", 102, "EMP-9", Meeting("F", "13:00", "14:00"))], new() { ["SCH-1"] = [Student("S-2")] });
        await SyncAsync();
        Assert.Equal(2, await _factory.WithDbAsync(db => db.IsmsClasses.CountAsync(c => c.IsActive)));
    }

    [Fact]
    public async Task An_empty_answer_from_ISMS_does_not_deactivate_every_class()
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))], new() { ["SCH-1"] = [Student("S-1")] });
        await SyncAsync();

        IsmsOffers([], new());
        var result = await SyncAsync();
        Assert.Equal(1, result.Students);

        Assert.True((await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync(c => c.Id == Database))).IsActive);
    }

    [Fact]
    public async Task A_failed_sync_is_reported_without_secrets_and_keeps_the_previous_copy()
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))], new() { ["SCH-1"] = [Student("S-1")] });
        var scopes = _factory.Services.GetRequiredService<IServiceScopeFactory>();
        var state = _factory.Services.GetRequiredService<SyncState>();
        await IsmsSyncWorker.RunOnceAsync(scopes, state, _factory.Time, NullLogger.Instance, CancellationToken.None);

        Isms.Responder = _ => new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent($"bad key {LmsApiFactory.ApiKey}") };
        _factory.Time.Now += TimeSpan.FromDays(3);
        var failed = await IsmsSyncWorker.RunOnceAsync(scopes, state, _factory.Time, NullLogger.Instance, CancellationToken.None);

        Assert.NotNull(failed.Error);
        Assert.DoesNotContain(LmsApiFactory.ApiKey, failed.Error);
        Assert.Equal(1, failed.ActiveClasses);
        Assert.True((await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync(c => c.Id == Database))).IsActive);
    }

    [Fact]
    public async Task A_later_roster_failure_keeps_classes_and_earlier_rosters_unchanged()
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7")], new() { ["SCH-1"] = [Student("S-1")] });
        await SyncAsync();
        var before = await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync());

        // SCH-2 has no roster route, so it fails after SCH-1 was fetched successfully.
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7"), Schedule("SCH-2", 102, "EMP-9")],
            new() { ["SCH-1"] = [Student("S-2")] });
        await Assert.ThrowsAnyAsync<Exception>(() => SyncAsync());

        Assert.Equal(1, await _factory.WithDbAsync(db => db.IsmsClasses.CountAsync()));
        Assert.Equal(before.SyncedAt, (await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync())).SyncedAt);
        Assert.Equal(["S-1"], await _factory.WithDbAsync(db => db.IsmsClassStudents.Where(s => s.IsActive).Select(s => s.StudentId).ToListAsync()));
    }

    [Fact]
    public async Task A_database_failure_rolls_back_class_updates()
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7")], new() { ["SCH-1"] = [Student("S-1")] });
        await SyncAsync();
        var before = await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync());
        await _factory.WithDbAsync(db => db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER reject_student BEFORE INSERT ON isms_class_students BEGIN SELECT RAISE(ABORT, 'test failure'); END;"));

        IsmsOffers([Schedule("SCH-1", 101, "EMP-7"), Schedule("SCH-2", 102, "EMP-9")],
            new() { ["SCH-1"] = [Student("S-2")], ["SCH-2"] = [] });
        await Assert.ThrowsAsync<DbUpdateException>(() => SyncAsync());

        Assert.Equal(1, await _factory.WithDbAsync(db => db.IsmsClasses.CountAsync()));
        Assert.Equal(before.SyncedAt, (await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync())).SyncedAt);
        Assert.Equal(["S-1"], await _factory.WithDbAsync(db => db.IsmsClassStudents.Where(s => s.IsActive).Select(s => s.StudentId).ToListAsync()));
    }

    [Fact]
    public async Task An_empty_roster_preserves_previous_memberships()
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7")], new() { ["SCH-1"] = [Student("S-1")] });
        await SyncAsync();
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7")], new() { ["SCH-1"] = [] });
        Assert.Equal(1, (await SyncAsync()).Students);
        Assert.True((await _factory.WithDbAsync(db => db.IsmsClassStudents.SingleAsync())).IsActive);
    }

    [Theory]
    [InlineData("/v1/school-years")]
    [InlineData("/v1/semesters")]
    [InlineData("/v1/schedules")]
    [InlineData("/v1/schedules/SCH-1/students")]
    public async Task Stale_ISMS_data_does_not_refresh_the_database(string failedPath)
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7")], new() { ["SCH-1"] = [Student("S-1")] });
        await SyncAsync();
        var before = await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync());
        var original = Isms.Responder;
        Isms.Responder = request => request.RequestUri!.AbsolutePath == failedPath
            ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
            : original(request);
        _factory.Time.Now += TimeSpan.FromMinutes(10);

        await Assert.ThrowsAsync<Lms.Api.Isms.IsmsException>(() => SyncAsync());
        Assert.Equal(before.SyncedAt, (await _factory.WithDbAsync(db => db.IsmsClasses.SingleAsync())).SyncedAt);
    }

    [Fact]
    public async Task Status_reports_the_database_and_the_last_sync()
    {
        var client = _factory.CreateClient();
        var before = JsonDocument.Parse(await client.GetStringAsync("/api/lms/status")).RootElement;
        Assert.True(before.GetProperty("database").GetProperty("reachable").GetBoolean());
        Assert.Equal(JsonValueKind.Null, before.GetProperty("sync").ValueKind);

        IsmsOffers([Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))], new() { ["SCH-1"] = [Student("S-1"), Student("S-2")] });
        await IsmsSyncWorker.RunOnceAsync(_factory.Services.GetRequiredService<IServiceScopeFactory>(), _factory.Services.GetRequiredService<SyncState>(), _factory.Time, NullLogger.Instance, CancellationToken.None);

        var after = JsonDocument.Parse(await client.GetStringAsync("/api/lms/status")).RootElement.GetProperty("sync");
        Assert.Equal(1, after.GetProperty("activeClasses").GetInt32());
        Assert.Equal(2, after.GetProperty("students").GetInt32());
        Assert.Equal(JsonValueKind.Null, after.GetProperty("error").ValueKind);
    }

    [Fact]
    public async Task Saves_record_who_created_and_changed_a_row()
    {
        IsmsOffers([Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))], new() { ["SCH-1"] = [] });
        await SyncAsync();
        var created = _factory.Time.Now.UtcDateTime;

        var id = await _factory.WithDbAsync(async db =>
        {
            db.Actor = "EMP-7";
            var module = new Module { ClassId = Database, Title = "Unit 1", SortOrder = 1 };
            db.Modules.Add(module);
            await db.SaveChangesAsync();
            return module.Id;
        });
        _factory.Time.Now += TimeSpan.FromMinutes(5);
        await _factory.WithDbAsync(async db =>
        {
            db.Actor = "EMP-8";
            (await db.Modules.SingleAsync(m => m.Id == id)).Title = "Unit 1 · SQL";
            return await db.SaveChangesAsync();
        });

        var row = await _factory.WithDbAsync(db => db.Modules.AsNoTracking().SingleAsync(m => m.Id == id));
        Assert.Equal("EMP-7", row.CreatedBy);
        Assert.Equal(created, row.CreatedAt);
        Assert.Equal("EMP-8", row.UpdatedBy);
        Assert.Equal(created.AddMinutes(5), row.UpdatedAt);
    }

    [Fact]
    public async Task Content_cannot_point_at_a_class_that_does_not_exist()
    {
        await Assert.ThrowsAsync<DbUpdateException>(() => _factory.WithDbAsync(async db =>
        {
            db.Modules.Add(new Module { ClassId = "no-such-class", Title = "Unit 1" });
            return await db.SaveChangesAsync();
        }));
    }

    [Fact]
    public void Tables_and_columns_are_snake_case()
    {
        using var db = new LmsDbContextDesignTimeFactory().CreateDbContext([]);
        foreach (var entity in db.Model.GetEntityTypes())
        {
            Assert.Matches("^[a-z_]+$", entity.GetTableName());
            foreach (var property in entity.GetProperties())
                Assert.Matches("^[a-z_]+$", property.GetColumnName());
        }
        Assert.Equal("isms_class_students", db.Model.FindEntityType(typeof(IsmsClassStudent))!.GetTableName());
        Assert.Equal("meetings_json", db.Model.FindEntityType(typeof(IsmsClass))!.FindProperty(nameof(IsmsClass.MeetingsJson))!.GetColumnName());
    }

    [Fact]
    public void The_migrations_match_the_model()
    {
        // Fails when the model changes without `dotnet ef migrations add`. No database is needed.
        using var db = new LmsDbContextDesignTimeFactory().CreateDbContext([]);
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
