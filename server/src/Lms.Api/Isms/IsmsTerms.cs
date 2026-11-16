using Lms.Api.Endpoints;

namespace Lms.Api.Isms;

public static class IsmsTerms
{
    /// <summary>The school year and semester ISMS flags as current, or null when it flags none.</summary>
    public static async Task<ClassTerm?> ResolveCurrentAsync(IIsmsCatalog catalog, CancellationToken ct, bool requireFresh = false)
    {
        var years = await catalog.GetSchoolYearsAsync(ct);
        var semesters = await catalog.GetSemestersAsync(ct);
        if (requireFresh && (years.IsStale || semesters.IsStale))
            throw new IsmsException(IsmsFailure.Unreachable, "ISMS term data is stale; the previous database copy is kept.");
        var year = years.Data.FirstOrDefault(y => y.IsCurrent);
        var semester = semesters.Data.FirstOrDefault(s => s.IsCurrent);
        return year is not null && semester is not null
            ? new ClassTerm(year.Id, year.Name, semester.Id, semester.Name)
            : null;
    }

    public static string? DisplayName(ClassTerm? term) => term is null ? null : $"{term.SchoolYearName} · {term.SemesterName}";
}
