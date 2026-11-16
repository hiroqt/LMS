using Isms.Api.Access;
using Isms.Api.Isms;

namespace Isms.Api.Features.Instructors;

/// <summary>
/// Instructor directory entry. Birthdate, sex, address, contact number, email and
/// username are deliberately not part of this shape (and not even mapped from ISMS).
/// </summary>
/// <param name="Id">The employee RefID (what schedule items reference as InstructorID).</param>
public sealed record InstructorDto(
    string Id, string? EmployeeNo, string? FirstName, string? MiddleName, string? LastName,
    string? Suffix, string? Honorific, string? DepartmentId, string Status);

public sealed class InstructorService(IsmsDbContext db)
{
    /// <summary>Employees referenced as instructor by at least one schedule item.</summary>
    public Task<PagedResult<InstructorDto>> ListAsync(PageRequest page, CancellationToken ct) =>
        page.ApplyAsync(
            db.Employees
                .Where(e => db.ScheduleItems.Any(i => i.InstructorId == e.RefId))
                .OrderBy(e => e.Lname).ThenBy(e => e.Fname).ThenBy(e => e.RefId)
                .Select(e => new InstructorDto(
                    e.RefId, e.EmpNo, e.Fname, e.Mname, e.Lname, e.Suffix, e.Honorific, e.DepartmentId, e.Status.Trim())),
            ct);
}

public static class InstructorEndpoints
{
    public static void MapInstructorEndpoints(this IEndpointRouteBuilder v1)
    {
        v1.MapGet("/instructors", async (int? page, int? pageSize, InstructorService service, CancellationToken ct) =>
                PageRequest.TryCreate(page, pageSize, out var p, out var problem)
                    ? Results.Ok(await service.ListAsync(p, ct))
                    : problem!)
            .RequirePermission(Permissions.InstructorView)
            .WithName("ListInstructors");
    }
}
