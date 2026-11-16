using Lms.Api.Classes;
using Lms.Api.Data;
using Lms.Api.Isms;
using Lms.Api.Sync;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Endpoints;

/// <summary>Envelope for every list the LMS serves from ISMS.</summary>
public sealed record IsmsListResponse<T>(IReadOnlyList<T> Items, string Source, DateTimeOffset SyncedAt)
{
    public static IsmsListResponse<T> From(IsmsSnapshot<IReadOnlyList<T>> snapshot) => new(snapshot.Data, "isms", snapshot.SyncedAt);
}

/// <summary>The term a class list was limited to, when the caller asked for the current one.</summary>
public sealed record ClassTerm(int SchoolYearId, string SchoolYearName, int SemesterId, string SemesterName);

/// <param name="Term">Set only when <c>term=current</c> was requested and ISMS flags a current term.</param>
public sealed record ClassListResponse(IReadOnlyList<LmsClass> Items, string Source, DateTimeOffset SyncedAt, ClassTerm? Term);

public sealed record LmsDatabaseStatus(bool Reachable, int PendingMigrations);

public sealed record LmsSyncStatus(DateTimeOffset At, string? TermName, int Classes, int ActiveClasses, int Students, string? Error);

/// <param name="Sync">Null until the first sync has run (or when the sync is turned off).</param>
public sealed record LmsStatusResponse(LmsDatabaseStatus Database, LmsSyncStatus? Sync, DateTimeOffset CheckedAt);

public sealed record IsmsStatusResponse(bool Reachable, bool Authorized, DateTimeOffset CheckedAt, string Detail);

/// <summary>
/// Read-only endpoints. Classes, subjects and instructors are owned by ISMS, so there is
/// deliberately no POST/PUT/PATCH/DELETE here; those methods get 405.
/// </summary>
public static class LmsEndpoints
{
    public static IEndpointRouteBuilder MapLmsEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/classes", async (string? instructorId, int? schoolYearId, int? semesterId, string? term, IIsmsCatalog catalog, CancellationToken ct) =>
            {
                // term=current limits the list to the school year and semester ISMS flags as
                // current. When ISMS flags none, nothing is filtered and "term" is null.
                ClassTerm? current = null;
                if (string.Equals(term, "current", StringComparison.OrdinalIgnoreCase))
                {
                    current = await IsmsTerms.ResolveCurrentAsync(catalog, ct);
                    if (current is not null)
                    {
                        schoolYearId = current.SchoolYearId;
                        semesterId = current.SemesterId;
                    }
                }

                // The instructor filter is applied here, not sent to ISMS, so free text from the
                // caller never becomes a cache key.
                var schedules = await catalog.GetSchedulesAsync(new IsmsScheduleQuery(schoolYearId, semesterId), ct);
                var instructor = string.IsNullOrWhiteSpace(instructorId) ? null : instructorId.Trim();
                var classes = ClassMapper.FromSchedules(schedules.Data)
                    .Where(c => instructor is null || string.Equals(c.InstructorId, instructor, StringComparison.Ordinal))
                    .ToList();
                return TypedResults.Ok(new ClassListResponse(classes, "isms", schedules.SyncedAt, current));
            })
            .WithName("ListClasses")
            .WithSummary("Classes (section + subject + instructor offerings) from ISMS schedules.")
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        api.MapGet("/classes/{id}/students", async Task<IResult> (string id, IIsmsCatalog catalog, CancellationToken ct) =>
            {
                if (!ClassId.TryParse(id, out var parts))
                {
                    return TypedResults.Problem(
                        statusCode: StatusCodes.Status404NotFound,
                        title: "Class not found",
                        detail: "The class id is not one this LMS issued. Get class ids from GET /api/classes.");
                }

                // Only ids of classes that exist in ISMS are looked up, so an edited id cannot be
                // used to probe other schedules.
                var schedules = await catalog.GetSchedulesAsync(new IsmsScheduleQuery(), ct);
                if (!ClassMapper.FromSchedules(schedules.Data).Any(c => c.Id == id))
                {
                    return TypedResults.Problem(
                        statusCode: StatusCodes.Status404NotFound,
                        title: "Class not found",
                        detail: "No class with this id exists in ISMS. Get class ids from GET /api/classes.");
                }

                var students = await catalog.GetScheduleStudentsAsync(parts.ScheduleId, ct);
                return TypedResults.Ok(IsmsListResponse<IsmsStudent>.From(students));
            })
            .WithName("ListClassStudents")
            .WithSummary("Students enrolled in a class, from ISMS.")
            .Produces<IsmsListResponse<IsmsStudent>>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        api.MapGet("/subjects", async (IIsmsCatalog catalog, CancellationToken ct) =>
                TypedResults.Ok(IsmsListResponse<IsmsSubject>.From(await catalog.GetSubjectsAsync(ct))))
            .WithName("ListSubjects")
            .WithSummary("Subjects from ISMS.")
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        api.MapGet("/instructors", async (IIsmsCatalog catalog, CancellationToken ct) =>
                TypedResults.Ok(IsmsListResponse<IsmsInstructor>.From(await catalog.GetInstructorsAsync(ct))))
            .WithName("ListInstructors")
            .WithSummary("Instructors from ISMS.")
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        api.MapGet("/lms/status", async (LmsDbContext db, SyncState sync, TimeProvider time, CancellationToken ct) =>
            {
                var reachable = false;
                var pending = 0;
                try
                {
                    reachable = await db.Database.CanConnectAsync(ct);
                    // Only MySQL is managed by migrations; demo and test databases are created from the model.
                    if (reachable && db.Database.ProviderName == "MySql.EntityFrameworkCore" && db.Database.GetMigrations().Any())
                        pending = (await db.Database.GetPendingMigrationsAsync(ct)).Count();
                }
                catch (Exception) when (!ct.IsCancellationRequested)
                {
                    reachable = false;
                }
                var last = sync.Last;
                return TypedResults.Ok(new LmsStatusResponse(
                    new LmsDatabaseStatus(reachable, pending),
                    last is null ? null : new LmsSyncStatus(last.At, last.TermName, last.Classes, last.ActiveClasses, last.Students, last.Error),
                    time.GetUtcNow()));
            })
            .WithName("LmsStatus")
            .WithSummary("Diagnostic: is the LMS database reachable and up to date, and how did the last ISMS sync go?");

        api.MapGet("/isms/status", async (IIsmsClient client, TimeProvider time, CancellationToken ct) =>
            {
                var probe = await client.ProbeAsync(ct);
                var checkedAt = time.GetUtcNow();
                return TypedResults.Ok(probe.StatusCode switch
                {
                    null => new IsmsStatusResponse(false, false, checkedAt, "ISMS could not be reached or did not respond in time."),
                    401 => new IsmsStatusResponse(true, false, checkedAt, "ISMS rejected the LMS's client id or API key (401). Check Isms:ClientId and Isms:ApiKey on the LMS server."),
                    403 => new IsmsStatusResponse(true, false, checkedAt, "ISMS accepted the credentials but this client may not read subjects (403). Ask the ISMS administrator to grant the permission."),
                    429 => new IsmsStatusResponse(true, true, checkedAt, "ISMS is reachable but rate limiting the LMS (429)."),
                    >= 200 and < 300 => new IsmsStatusResponse(true, true, checkedAt, "ISMS is reachable and accepted the LMS's credentials."),
                    var code => new IsmsStatusResponse(true, false, checkedAt, $"ISMS answered an unexpected status ({code})."),
                });
            })
            .WithName("IsmsStatus")
            .WithSummary("Diagnostic: can the LMS reach ISMS with its configured credentials?");

        return app;
    }
}
