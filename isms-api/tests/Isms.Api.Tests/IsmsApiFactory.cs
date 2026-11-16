using Isms.Api.Access;
using Isms.Api.Isms;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Isms.Api.Tests;

/// <summary>
/// Runs the real app (Program) with both DbContexts on in-memory SQLite, seeded with
/// small fictional data. No MySQL server is needed.
/// </summary>
public class IsmsApiFactory : WebApplicationFactory<Program>
{
    // One temp-file SQLite database per context and factory. (A single shared in-memory
    // connection is not safe here: the request log is written while the next request runs.)
    private readonly string _ismsDb = Path.Combine(Path.GetTempPath(), $"isms-test-{Guid.NewGuid():N}.db");
    private readonly string _accessDb = Path.Combine(Path.GetTempPath(), $"ismsapi-test-{Guid.NewGuid():N}.db");

    public const string FullClient = "lms-test";
    public const string SubjectsOnlyClient = "subjects-only";
    public const string DisabledClient = "disabled-client";
    public const string ExpiredClient = "expired-client";
    public const string RevokedClient = "revoked-client";

    public string FullKey { get; private set; } = "";
    public string SubjectsOnlyKey { get; private set; } = "";
    public string DisabledKey { get; private set; } = "";
    public string ExpiredKey { get; private set; } = "";
    public string RevokedKey { get; private set; } = "";

    protected virtual int PermitsPerMinute => 100_000;

    // Build (and seed) the host up front so the key properties are populated before use.
    public IsmsApiFactory() => _ = Services;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("RateLimiting:PermitsPerMinute", PermitsPerMinute.ToString());
        // Satisfy the startup check; the MySQL registrations are replaced with SQLite below.
        builder.UseSetting("ConnectionStrings:IsmsDb", "unused-in-tests");
        builder.UseSetting("ConnectionStrings:IsmsApiDb", "unused-in-tests");
        builder.ConfigureServices(services =>
        {
            ReplaceWithSqlite<IsmsDbContext>(services, _ismsDb);
            ReplaceWithSqlite<ApiAccessDbContext>(services, _accessDb);
            ConfigureTestServices(services);
        });
    }

    protected virtual void ConfigureTestServices(IServiceCollection services) { }

    private static void ReplaceWithSqlite<TContext>(IServiceCollection services, string file)
        where TContext : DbContext
    {
        services.RemoveAll<DbContextOptions<TContext>>();
        services.RemoveAll<IDbContextOptionsConfiguration<TContext>>();
        services.AddDbContext<TContext>(o => o.UseSqlite($"Data Source={file};Pooling=False"));
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        SeedIsms(scope.ServiceProvider.GetRequiredService<IsmsDbContext>());
        SeedAccessAsync(scope.ServiceProvider).GetAwaiter().GetResult();
        return host;
    }

    public HttpClient ClientWith(string? clientId, string? key)
    {
        var http = CreateClient();
        if (clientId is not null) http.DefaultRequestHeaders.Add("X-Client-Id", clientId);
        if (key is not null) http.DefaultRequestHeaders.Add("X-Api-Key", key);
        return http;
    }

    public HttpClient FullAccessClient() => ClientWith(FullClient, FullKey);

    public T WithAccessDb<T>(Func<ApiAccessDbContext, T> action)
    {
        using var scope = Services.CreateScope();
        return action(scope.ServiceProvider.GetRequiredService<ApiAccessDbContext>());
    }

    public async Task<T> WithAdminAsync<T>(Func<ClientAdmin, Task<T>> action)
    {
        using var scope = Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<ClientAdmin>());
    }

    private async Task SeedAccessAsync(IServiceProvider sp)
    {
        var db = sp.GetRequiredService<ApiAccessDbContext>();
        db.Database.EnsureCreated();
        var admin = sp.GetRequiredService<ClientAdmin>();

        FullKey = (await admin.CreateAsync(FullClient, "LMS (test)", Permissions.All, 30)).Key;
        SubjectsOnlyKey = (await admin.CreateAsync(SubjectsOnlyClient, "Subjects only", [Permissions.SubjectView], 30)).Key;

        DisabledKey = (await admin.CreateAsync(DisabledClient, "Disabled", Permissions.All, 30)).Key;
        await admin.SetStatusAsync(DisabledClient, ClientStatus.Disabled);

        ExpiredKey = (await admin.CreateAsync(ExpiredClient, "Expired", Permissions.All, 30)).Key;
        await db.ClientKeys.Where(k => k.KeyPrefix == ApiKeys.PrefixOf(ExpiredKey))
            .ExecuteUpdateAsync(s => s.SetProperty(k => k.ExpiresAt, DateTime.UtcNow.AddMinutes(-1)));

        var revoked = await admin.CreateAsync(RevokedClient, "Revoked", Permissions.All, 30);
        RevokedKey = revoked.Key;
        await admin.RevokeKeyAsync(RevokedClient, revoked.KeyPrefix);
    }

    // Raw SQL with the real ISMS column names, so the seed also proves the EF column mapping.
    private static void SeedIsms(IsmsDbContext db)
    {
        db.Database.EnsureCreated();
        var sql = new List<string>
        {
            "INSERT INTO schoolyear_tbl (ID, SYFrom, SYTo, Standing, Status) VALUES (1, 2025, 2026, '1', '1'), (2, 2024, 2025, '0', '1')",
            "INSERT INTO semester_tbl (ID, Name, StandingID, Status) VALUES (1, 'First Semester', '1', '1'), (2, 'Second Semester', '0', '1')",
            "INSERT INTO educsections_tbl (ID, Name) VALUES (10, 'BSIT 1-A')",
            "INSERT INTO subjects_tbl (ID, Name, ShortCode, Units, Status) VALUES (1000, 'Retired Elective', 'RET100', 2, '0')",
            """
            INSERT INTO employees_tbl (ID, RefID, EmpNo, FName, MName, LName, Suffix, Honorific, DepartmentID, Status) VALUES
              (1, 'EMP-A', 'E-0001', 'Ana', 'Lopez', 'Reyes', '', 'Prof.', 'D-IT', '1'),
              (2, 'EMP-B', 'E-0002', 'Ben', NULL, 'Cruz', 'Jr.', 'Mr.', 'D-IT', '1'),
              (3, 'EMP-C', 'E-0003', 'Carla', NULL, 'Diaz', '', 'Ms.', 'D-HR', '1')
            """,
            "INSERT INTO schedules_tbl (ID, RefID, SYID, SemesterID, SectionID, Status) VALUES (1, 'SCH-1', 1, 1, 10, '1'), (2, 'SCH-2', 1, 2, 10, '1')",
            """
            INSERT INTO scheduleitems_tbl (ID, RefID, SubjectID, InstructorID, RoomID, Modality, DayID, TimeFrom, TimeTo) VALUES
              (1, 'SCH-1', 1, 'EMP-A', 101, 1, 'M', '08:00:00', '09:30:00'),
              (2, 'SCH-1', 1, 'EMP-A', 101, 1, 'W', '08:00:00', '09:30:00'),
              (3, 'SCH-1', 2, 'EMP-B', 102, 2, 'T', '10:00:00', '11:00:00'),
              (4, 'SCH-2', 3, 'EMP-B', 103, 1, 'F', '13:00:00', '14:00:00')
            """,
            "INSERT INTO students_tbl (ID, RefID, FName, MName, LName) VALUES (1, 'STU-1', 'Lia', 'Mae', 'Torres'), (2, 'STU-2', 'Marco', NULL, 'Lim')",
            "INSERT INTO enrollments_tbl (ID, RefID, StudentID) VALUES (1, 'ENR-1', 'STU-1'), (2, 'ENR-2', 'STU-2')",
            "INSERT INTO schedulestudents_tbl (ID, RefID, EnrollmentID) VALUES (1, 'SCH-1', 'ENR-1'), (2, 'SCH-1', 'ENR-2')",
        };
        // 120 active subjects for pagination tests.
        sql.Add("INSERT INTO subjects_tbl (ID, Name, ShortCode, Units, Status) VALUES " + string.Join(", ",
            Enumerable.Range(1, 120).Select(i => $"({i}, 'Subject {i:000}', 'SUB{i:000}', 3, '1')")));
        foreach (var statement in sql)
            db.Database.ExecuteSqlRaw(statement);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            foreach (var file in new[] { _ismsDb, _accessDb })
                File.Delete(file);
        }
    }
}
