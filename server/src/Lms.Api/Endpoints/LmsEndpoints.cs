using Lms.Api.Classes;
using Lms.Api.Isms;

namespace Lms.Api.Endpoints;

/// <summary>Envelope for every list the LMS serves from ISMS.</summary>
public sealed record IsmsListResponse<T>(IReadOnlyList<T> Items, string Source, DateTimeOffset SyncedAt)
{
    public static IsmsListResponse<T> From(IsmsSnapshot<IReadOnlyList<T>> snapshot) => new(snapshot.Data, "isms", snapshot.SyncedAt);
}

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

        api.MapGet("/classes", async (string? instructorId, int? schoolYearId, int? semesterId, IIsmsCatalog catalog, CancellationToken ct) =>
            {
                var query = new IsmsScheduleQuery(schoolYearId, semesterId, string.IsNullOrWhiteSpace(instructorId) ? null : instructorId.Trim());
                var schedules = await catalog.GetSchedulesAsync(query, ct);
                var classes = ClassMapper.FromSchedules(schedules.Data);
                return TypedResults.Ok(new IsmsListResponse<LmsClass>(classes, "isms", schedules.SyncedAt));
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
