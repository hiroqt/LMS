using Isms.Api.Access;
using Isms.Api.Isms;

namespace Isms.Api.Features.Subjects;

/// <param name="Code">The ISMS ShortCode column.</param>
/// <param name="Status">Raw ISMS status code (for example "1").</param>
public sealed record SubjectDto(int Id, string? Code, string Name, int Units, string Status);

public sealed class SubjectService(IsmsDbContext db)
{
    public Task<PagedResult<SubjectDto>> ListAsync(string? status, PageRequest page, CancellationToken ct)
    {
        var query = db.Subjects.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status.Trim());
        return page.ApplyAsync(
            query.OrderBy(s => s.Name).ThenBy(s => s.Id)
                .Select(s => new SubjectDto(s.Id, s.ShortCode, s.Name, s.Units, s.Status.Trim())),
            ct);
    }
}

public static class SubjectEndpoints
{
    public static void MapSubjectEndpoints(this IEndpointRouteBuilder v1)
    {
        v1.MapGet("/subjects", async (string? status, int? page, int? pageSize, SubjectService service, CancellationToken ct) =>
                PageRequest.TryCreate(page, pageSize, out var p, out var problem)
                    ? Results.Ok(await service.ListAsync(status, p, ct))
                    : problem!)
            .RequirePermission(Permissions.SubjectView)
            .WithName("ListSubjects");
    }
}
