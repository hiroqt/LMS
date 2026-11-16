using Isms.Api.Access;
using Isms.Api.Isms;

namespace Isms.Api.Features.Calendar;

/// <param name="Name">Built from SYFrom-SYTo; the table has no name column.</param>
/// <param name="Standing">Raw ISMS "Standing" code.</param>
/// <param name="IsCurrent">True when Standing is "1" (ISMS marks the current school year this way).</param>
public sealed record SchoolYearDto(int Id, string Name, string Status, string Standing, bool IsCurrent);

/// <param name="Standing">Raw ISMS "StandingID" code.</param>
/// <param name="IsCurrent">True when StandingID is "1".</param>
public sealed record SemesterDto(int Id, string Name, string Status, string Standing, bool IsCurrent);

public sealed class CalendarService(IsmsDbContext db)
{
    public const string CurrentStanding = "1";

    public Task<PagedResult<SchoolYearDto>> SchoolYearsAsync(PageRequest page, CancellationToken ct) =>
        page.ApplyAsync(
            db.SchoolYears.OrderByDescending(y => y.Syfrom).ThenBy(y => y.Id)
                .Select(y => new SchoolYearDto(
                    y.Id, y.Syfrom + "-" + y.Syto, y.Status.Trim(), y.Standing.Trim(), y.Standing.Trim() == CurrentStanding)),
            ct);

    public Task<PagedResult<SemesterDto>> SemestersAsync(PageRequest page, CancellationToken ct) =>
        page.ApplyAsync(
            db.Semesters.OrderBy(s => s.Id)
                .Select(s => new SemesterDto(
                    s.Id, s.Name, s.Status.Trim(), s.StandingId.Trim(), s.StandingId.Trim() == CurrentStanding)),
            ct);
}

public static class CalendarEndpoints
{
    public static void MapCalendarEndpoints(this IEndpointRouteBuilder v1)
    {
        v1.MapGet("/school-years", async (int? page, int? pageSize, CalendarService service, CancellationToken ct) =>
                PageRequest.TryCreate(page, pageSize, out var p, out var problem)
                    ? Results.Ok(await service.SchoolYearsAsync(p, ct))
                    : problem!)
            .RequirePermission(Permissions.ScheduleView)
            .WithName("ListSchoolYears");

        v1.MapGet("/semesters", async (int? page, int? pageSize, CalendarService service, CancellationToken ct) =>
                PageRequest.TryCreate(page, pageSize, out var p, out var problem)
                    ? Results.Ok(await service.SemestersAsync(p, ct))
                    : problem!)
            .RequirePermission(Permissions.ScheduleView)
            .WithName("ListSemesters");
    }
}
