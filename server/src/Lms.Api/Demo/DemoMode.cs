using System.Collections.Concurrent;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Isms;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Demo;

/// <summary>
/// DEMO MODE (ASPNETCORE_ENVIRONMENT=Demo, or Lms:Demo:Enabled). The API runs on its own:
/// no MySQL and no ISMS API. People and classes come from the fictional seed in
/// demo-seed.json (exported from the client's data.js) through a built-in fake ISMS, and each
/// sandbox (header X-Demo-Sandbox) gets its own freshly seeded SQLite database, so parallel
/// browser tests never see each other's changes. Never enable this on a shared server.
/// </summary>
public sealed class DemoOptions
{
    public const string SectionName = "Lms:Demo";
    public const string SandboxHeader = "X-Demo-Sandbox";

    public bool Enabled { get; set; }
    /// <summary>Folder for the per-sandbox SQLite files; emptied at startup.</summary>
    public string DataDirectory { get; set; } = Path.Combine(Path.GetTempPath(), "lms-demo");
    /// <summary>Time zone for the seed's dates, which carry no offset.</summary>
    public string TimeZone { get; set; } = "Asia/Manila";
    /// <summary>Optional start of the server's clock, e.g. 2026-10-23T09:00:00+08:00 for the browser tests.</summary>
    public DateTimeOffset? Now { get; set; }
}

/// <summary>The seed file's shape.</summary>
public sealed record DemoSeed(DemoTerm Term, List<DemoPerson> Instructors, List<DemoPerson> Students, List<DemoClass> Classes,
    List<DemoMaterial> Materials, List<DemoCoursework> Coursework)
{
    public static DemoSeed Load() =>
        JsonSerializer.Deserialize<DemoSeed>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Demo", "demo-seed.json")), JsonSerializerOptions.Web)
        ?? throw new InvalidOperationException("Demo/demo-seed.json is empty.");
}

public sealed record DemoTerm(string SchoolYear, string Semester);
public sealed record DemoPerson(string Id, string FirstName, string LastName, string? Honorific, string? Email);
public sealed record DemoClass(string Id, int SubjectId, string Code, string Name, string Section, string InstructorId);
public sealed record DemoMaterial(string ClassId, string Title, string Kind, string? Description);
public sealed record DemoQuestion(string Prompt, List<string> Options, int Correct, decimal Points, int? TimeLimitSeconds);
public sealed record DemoCoursework(string ClassId, string Title, string Category, string? Description, string? Instructions,
    string? DueAt, int? TimeLimitMinutes, List<DemoQuestion> Questions);

/// <summary>A clock that starts at <see cref="DemoOptions.Now"/> and then runs normally.</summary>
public sealed class DemoClock(DateTimeOffset start) : TimeProvider
{
    private readonly DateTimeOffset _realStart = System.GetUtcNow();
    public override DateTimeOffset GetUtcNow() => start.ToUniversalTime() + (System.GetUtcNow() - _realStart);
}

/// <summary>Picks and prepares the SQLite database of the request's sandbox.</summary>
public sealed class DemoDatabases(DemoOptions options, DemoSeed seed, ILogger<DemoDatabases> logger)
{
    private readonly ConcurrentDictionary<string, Lazy<Task>> _ready = new();

    public static string SandboxOf(HttpContext? http)
    {
        var value = http?.Request.Headers[DemoOptions.SandboxHeader].ToString() ?? "";
        return value.Length is > 0 and <= 40 && value.All(c => char.IsAsciiLetterOrDigit(c) || c == '-') ? value : "default";
    }

    public string ConnectionString(string sandbox) => $"Data Source={Path.Combine(options.DataDirectory, $"lms-{sandbox}.db")};Pooling=False";

    public void ResetAll()
    {
        Directory.CreateDirectory(options.DataDirectory);
        foreach (var file in Directory.GetFiles(options.DataDirectory, "lms-*.db*")) File.Delete(file);
    }

    /// <summary>Creates and seeds the sandbox's database once per process.</summary>
    public Task EnsureReadyAsync(string sandbox) => _ready.GetOrAdd(sandbox, s => new Lazy<Task>(() => CreateAsync(s))).Value;

    private async Task CreateAsync(string sandbox)
    {
        await using var db = new LmsDbContext(new DbContextOptionsBuilder<LmsDbContext>().UseSqlite(ConnectionString(sandbox)).Options);
        await db.Database.EnsureCreatedAsync();
        await DemoSeeder.SeedAsync(db, seed, options);
        logger.LogInformation("Demo sandbox {Sandbox} seeded", sandbox);
    }
}

/// <summary>Seeds one demo database: the fake ISMS classes and class lists, then the LMS content.</summary>
public static class DemoSeeder
{
    public static async Task SeedAsync(LmsDbContext db, DemoSeed seed, DemoOptions options)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(options.TimeZone);
        var term = $"{seed.Term.SchoolYear} · {seed.Term.Semester}";
        var now = DateTime.UtcNow;
        foreach (var c in seed.Classes)
        {
            var teacher = seed.Instructors.Single(i => i.Id == c.InstructorId);
            db.IsmsClasses.Add(new IsmsClass
            {
                Id = c.Id, ScheduleId = c.Id, SubjectId = c.SubjectId, SubjectCode = c.Code, SubjectName = c.Name,
                SectionId = c.SubjectId, SectionName = c.Section, InstructorId = c.InstructorId,
                InstructorName = $"{teacher.FirstName} {teacher.LastName}", SchoolYearId = 1, SemesterId = 1, TermName = term,
                MeetingsJson = "[]", IsActive = true, SyncedAt = now,
            });
            // Every demo student is in every demo class, as in the browser-local seed.
            foreach (var s in seed.Students)
                db.IsmsClassStudents.Add(new IsmsClassStudent { ClassId = c.Id, StudentId = s.Id, EnrollmentId = $"{c.Id}-{s.Id}", FirstName = s.FirstName, LastName = s.LastName, IsActive = true, SyncedAt = now });
            db.GradebookSettings.Add(new GradebookSetting { ClassId = c.Id });
        }
        await db.SaveChangesAsync();

        var modules = seed.Classes.ToDictionary(c => c.Id, c => new Module { ClassId = c.Id, Title = Sync.IsmsReferenceSync.StarterModuleTitle, SortOrder = 1 });
        db.Modules.AddRange(modules.Values);
        await db.SaveChangesAsync();

        foreach (var m in seed.Materials)
            db.Materials.Add(new Material { ClassId = m.ClassId, ModuleId = modules[m.ClassId].Id, Title = m.Title, Kind = m.Kind, Description = m.Description, CreatedBy = seed.Classes.Single(c => c.Id == m.ClassId).InstructorId });
        await db.SaveChangesAsync();

        foreach (var w in seed.Coursework)
        {
            var room = seed.Classes.Single(c => c.Id == w.ClassId);
            var owner = room.InstructorId;
            var questionnaire = new Questionnaire { OwnerInstructorId = owner, SubjectId = room.SubjectId, Title = w.Title, CreatedBy = owner };
            db.Questionnaires.Add(questionnaire);
            await db.SaveChangesAsync();
            for (var i = 0; i < w.Questions.Count; i++)
            {
                var q = w.Questions[i];
                var question = new Question { QuestionnaireId = questionnaire.Id, Type = QuestionType.MultipleChoice, Prompt = q.Prompt, Points = q.Points, SortOrder = i + 1, TimeLimitSeconds = q.TimeLimitSeconds, CreatedBy = owner };
                db.Questions.Add(question);
                await db.SaveChangesAsync();
                for (var k = 0; k < q.Options.Count; k++)
                    db.QuestionOptions.Add(new QuestionOption { QuestionId = question.Id, Text = q.Options[k], IsCorrect = k == q.Correct, SortOrder = k + 1, CreatedBy = owner });
            }
            DateTime? due = w.DueAt is { } text ? TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(DateTime.Parse(text, System.Globalization.CultureInfo.InvariantCulture), DateTimeKind.Unspecified), zone) : null;
            db.Coursework.Add(new Data.Coursework
            {
                ClassId = w.ClassId, ModuleId = modules[w.ClassId].Id, Type = CourseworkType.Exam, Title = w.Title, Description = w.Description,
                Category = w.Category, Instructions = w.Instructions, MaxPoints = w.Questions.Sum(q => q.Points), DueAt = due,
                TimeLimitMinutes = w.TimeLimitMinutes, QuestionnaireId = questionnaire.Id, Status = CourseworkStatus.Published, CreatedBy = owner,
                // The prototype let students retake a quiz; keep that for the demo.
                MaxAttempts = 20, AllowLate = true,
            });
            await db.SaveChangesAsync();
        }
    }
}

/// <summary>The fake ISMS: serves the seed's people and classes through the normal ISMS client interface.</summary>
public sealed class DemoIsmsClient(DemoSeed seed) : IIsmsClient
{
    private static string Name(DemoPerson p) => $"{p.FirstName} {p.LastName}";

    public Task<IReadOnlyList<IsmsLookup>> GetSchoolYearsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<IsmsLookup>>([new IsmsLookup(1, seed.Term.SchoolYear, "1", true)]);

    public Task<IReadOnlyList<IsmsLookup>> GetSemestersAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<IsmsLookup>>([new IsmsLookup(1, seed.Term.Semester, "1", true)]);

    public Task<IReadOnlyList<IsmsSubject>> GetSubjectsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<IsmsSubject>>(seed.Classes.Select(c => new IsmsSubject(c.SubjectId, c.Code, c.Name, 3, "1")).ToList());

    public Task<IReadOnlyList<IsmsInstructor>> GetInstructorsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<IsmsInstructor>>(seed.Instructors.Select(i => new IsmsInstructor(i.Id, null, i.FirstName, "", i.LastName, "", i.Honorific ?? "", "1", "1")).ToList());

    public Task<IReadOnlyList<IsmsSchedule>> GetSchedulesAsync(IsmsScheduleQuery query, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<IsmsSchedule>>(seed.Classes
            .Where(c => query.InstructorId is null || c.InstructorId == query.InstructorId)
            .Select(c => new IsmsSchedule(c.Id, 1, 1, c.SubjectId, c.Section, c.SubjectId, c.Code, c.Name, c.InstructorId,
                Name(seed.Instructors.Single(i => i.Id == c.InstructorId)), []))
            .ToList());

    public Task<IReadOnlyList<IsmsStudent>> GetScheduleStudentsAsync(string scheduleId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<IsmsStudent>>(seed.Classes.Any(c => c.Id == scheduleId)
            ? seed.Students.Select(s => new IsmsStudent(s.Id, $"{scheduleId}-{s.Id}", s.FirstName, "", s.LastName)).ToList()
            : throw new IsmsException(IsmsFailure.NotFound, "Unknown schedule."));

    public Task<IsmsProbeResult> ProbeAsync(CancellationToken ct = default) => Task.FromResult(new IsmsProbeResult(200));
}

public static class DemoServices
{
    /// <summary>Registers demo mode in place of MySQL, the ISMS client and the background sync.</summary>
    public static void AddDemoMode(this IServiceCollection services, DemoOptions options)
    {
        var seed = DemoSeed.Load();
        services.AddSingleton(options);
        services.AddSingleton(seed);
        services.AddSingleton<DemoDatabases>();
        services.AddHttpContextAccessor();
        if (options.Now is { } start) services.AddSingleton<TimeProvider>(new DemoClock(start));
        else services.AddSingleton(TimeProvider.System);

        // The normal cached catalog, in front of the fake ISMS instead of the HTTP client.
        services.AddOptions<IsmsOptions>();
        services.AddMemoryCache(o => o.SizeLimit = 512);
        services.AddSingleton<IsmsFetchLocks>();
        services.AddScoped<IIsmsCatalog, MemoryIsmsCatalog>();
        services.AddSingleton<IIsmsClient, DemoIsmsClient>();

        services.AddDbContext<LmsDbContext>((sp, o) => o.UseSqlite(sp.GetRequiredService<DemoDatabases>()
            .ConnectionString(DemoDatabases.SandboxOf(sp.GetRequiredService<IHttpContextAccessor>().HttpContext))));
    }

    /// <summary>Empties old sandboxes at startup and seeds each sandbox before its first request.</summary>
    public static void UseDemoMode(this WebApplication app)
    {
        var databases = app.Services.GetRequiredService<DemoDatabases>();
        databases.ResetAll();
        app.Use(async (http, next) =>
        {
            await databases.EnsureReadyAsync(DemoDatabases.SandboxOf(http));
            await next(http);
        });
    }
}
