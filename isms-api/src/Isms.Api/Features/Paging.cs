using Microsoft.EntityFrameworkCore;

namespace Isms.Api.Features;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

/// <summary><c>page</c> (default 1) and <c>pageSize</c> (default 50, max 200) query parameters.</summary>
public sealed record PageRequest(int Page, int PageSize)
{
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 200;

    public int Skip => (Page - 1) * PageSize;

    /// <summary>Returns a page request, or a 400 validation problem when out of bounds.</summary>
    public static bool TryCreate(int? page, int? pageSize, out PageRequest request, out IResult? problem)
    {
        request = new PageRequest(page ?? 1, pageSize ?? DefaultPageSize);
        var errors = new Dictionary<string, string[]>();
        if (request.Page < 1)
            errors["page"] = ["page must be 1 or greater."];
        if (request.PageSize is < 1 or > MaxPageSize)
            errors["pageSize"] = [$"pageSize must be between 1 and {MaxPageSize}."];
        problem = errors.Count > 0 ? Results.ValidationProblem(errors) : null;
        return problem is null;
    }

    public async Task<PagedResult<T>> ApplyAsync<T>(IQueryable<T> orderedQuery, CancellationToken ct)
    {
        var total = await orderedQuery.CountAsync(ct);
        var items = await orderedQuery.Skip(Skip).Take(PageSize).ToListAsync(ct);
        return new PagedResult<T>(items, Page, PageSize, total);
    }
}
