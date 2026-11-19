using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Rubrics;

public sealed record RubricLevelDto(long Id, string Title, string? Description, decimal Points);
public sealed record RubricCriterionDto(long Id, string Title, string? Description, IReadOnlyList<RubricLevelDto> Levels);

/// <param name="TotalPoints">The sum of each criterion's highest level: what an assignment using it is worth.</param>
/// <param name="Locked">A grade has used it, so its criteria can't change; copy it instead.</param>
/// <param name="UsedBy">How many assignments use it.</param>
public sealed record RubricDto(long Id, string Title, decimal TotalPoints, bool Locked, int UsedBy, IReadOnlyList<RubricCriterionDto> Criteria);

public sealed record RubricLevelInput(string? Title, string? Description, decimal? Points);
public sealed record RubricCriterionInput(string? Title, string? Description, IReadOnlyList<RubricLevelInput>? Levels);

/// <summary>Create: both fields. Update: a locked rubric takes a title only.</summary>
public sealed record RubricInput(string? Title, IReadOnlyList<RubricCriterionInput>? Criteria);

/// <summary>
/// Grading rubrics (D-062, contract §12). A rubric belongs to a class and is written by its
/// instructor. Once a grade has used it, it is locked like a question set (D-034): its criteria
/// and levels can no longer change, so earlier grades always mean what they meant. Students read
/// an assignment's rubric through the coursework route.
/// </summary>
public static class RubricEndpoints
{
    private const int TitleMax = 120;
    private const int LevelTitleMax = 60;
    private const int DescriptionMax = 500;
    private const int MaxCriteria = 12;
    private const int MinLevels = 2;
    private const int MaxLevels = 6;
    private const decimal MaxTotal = 1000;
    private const string LockedMessage = "This rubric has been used to grade. Copy it to change its criteria.";

    public static IEndpointRouteBuilder MapRubricEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/classes/{classId}/rubrics").RequireDemoUser();

        group.MapGet("", async Task<IResult> (string classId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForGradingAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var rubrics = await db.Rubrics.AsNoTracking().Where(r => r.ClassId == classId).OrderBy(r => r.Title).ThenBy(r => r.Id).ToListAsync(ct);
            return TypedResults.Ok(await ToDtosAsync(db, rubrics, ct));
        }).WithName("ListRubrics");

        group.MapGet("/{id:long}", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForGradingAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var rubric = await db.Rubrics.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id && r.ClassId == classId, ct);
            return rubric is null ? ContentEndpoints.NotFound("Rubric") : TypedResults.Ok((await ToDtosAsync(db, [rubric], ct))[0]);
        }).WithName("GetRubric");

        group.MapPost("", async Task<IResult> (string classId, RubricInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var errors = new Errors();
            var title = errors.Required("title", input.Title, TitleMax, "a title");
            var criteria = Read(input.Criteria, errors);
            if (errors.Any) return errors.Result();

            var rubric = new Rubric { ClassId = classId, Title = title! };
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            db.Rubrics.Add(rubric);
            await db.SaveChangesAsync(ct);
            await WriteAsync(db, rubric.Id, criteria, ct);
            Audit(db, user, "created", rubric.Id);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Created($"/api/classes/{classId}/rubrics/{rubric.Id}", (await ToDtosAsync(db, [rubric], ct))[0]);
        }).WithName("CreateRubric");

        group.MapPut("/{id:long}", async Task<IResult> (string classId, long id, RubricInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var rubric = await db.Rubrics.SingleOrDefaultAsync(r => r.Id == id && r.ClassId == classId, ct);
            if (rubric is null) return ContentEndpoints.NotFound("Rubric");
            var locked = await IsLockedAsync(db, id, ct);
            if (locked && input.Criteria is not null) return Conflict(LockedMessage);
            // Not locked, but an assignment using it may hold plain-point grades; a new total would rescale them.
            if (input.Criteria is not null && await db.Grades.AnyAsync(g => db.Submissions.Any(s => s.Id == g.SubmissionId && db.Coursework.Any(c => c.Id == s.CourseworkId && c.RubricId == id)), ct))
                return Conflict("An assignment that uses this rubric has grades. Copy the rubric to change its criteria.");

            var errors = new Errors();
            if (input.Title is not null) rubric.Title = errors.Required("title", input.Title, TitleMax, "a title") ?? rubric.Title;
            var criteria = input.Criteria is null ? null : Read(input.Criteria, errors);
            if (errors.Any) return errors.Result();

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            if (criteria is not null)
            {
                // Not locked, so nothing refers to the old criteria; the cascade removes their levels.
                await db.RubricCriteria.Where(c => c.RubricId == id).ExecuteDeleteAsync(ct);
                await WriteAsync(db, id, criteria, ct);
                // Assignments using it are worth its new total.
                var total = criteria.Sum(c => c.Levels.Max(l => l.Points));
                await db.Coursework.Where(c => c.RubricId == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.MaxPoints, total), ct);
            }
            Audit(db, user, "updated", id);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok((await ToDtosAsync(db, [rubric], ct))[0]);
        }).WithName("UpdateRubric");

        group.MapPost("/{id:long}/copy", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var source = await db.Rubrics.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id && r.ClassId == classId, ct);
            if (source is null) return ContentEndpoints.NotFound("Rubric");
            var dto = (await ToDtosAsync(db, [source], ct))[0];
            var title = $"{source.Title} (copy)";
            var copy = new Rubric { ClassId = classId, Title = title.Length > TitleMax ? title[..TitleMax] : title };

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            db.Rubrics.Add(copy);
            await db.SaveChangesAsync(ct);
            await WriteAsync(db, copy.Id, dto.Criteria.Select(c => new Criterion(c.Title, c.Description, c.Levels.Select(l => new Level(l.Title, l.Description, l.Points)).ToList())).ToList(), ct);
            Audit(db, user, "copied", copy.Id);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Created($"/api/classes/{classId}/rubrics/{copy.Id}", (await ToDtosAsync(db, [copy], ct))[0]);
        }).WithName("CopyRubric");

        group.MapDelete("/{id:long}", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var rubric = await db.Rubrics.SingleOrDefaultAsync(r => r.Id == id && r.ClassId == classId, ct);
            if (rubric is null) return ContentEndpoints.NotFound("Rubric");
            if (await db.Coursework.AnyAsync(c => c.RubricId == id, ct)) return Conflict("An assignment uses this rubric. Take it off the assignment first.");
            if (await IsLockedAsync(db, id, ct)) return Conflict("This rubric has been used to grade, so it is kept.");
            db.Rubrics.Remove(rubric);
            Audit(db, user, "deleted", id);
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        }).WithName("DeleteRubric");

        // The rubric of one assignment: for its instructor, and for students who can see the assignment.
        app.MapGroup("/api/classes/{classId}/coursework/{courseworkId:long}").RequireDemoUser().MapGet("/rubric", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var now = time.GetUtcNow().UtcDateTime;
            var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId
                && (user.IsInstructor || ((c.Status == CourseworkStatus.Published || c.Status == CourseworkStatus.Closed) && (c.AvailableFrom == null || c.AvailableFrom <= now))), ct);
            if (cw?.RubricId is not { } rubricId) return ContentEndpoints.NotFound("Rubric");
            var rubric = await db.Rubrics.AsNoTracking().SingleAsync(r => r.Id == rubricId, ct);
            var dto = (await ToDtosAsync(db, [rubric], ct))[0];
            // How much it is used is the instructor's business.
            return TypedResults.Ok(user.IsInstructor ? dto : dto with { UsedBy = 0, Locked = false });
        }).WithName("GetCourseworkRubric");

        return app;
    }

    private sealed record Level(string Title, string? Description, decimal Points);
    private sealed record Criterion(string Title, string? Description, List<Level> Levels);

    /// <summary>Checks the criteria and levels, adding field errors like <c>criteria[1].levels[0].points</c>.</summary>
    private static List<Criterion> Read(IReadOnlyList<RubricCriterionInput>? input, Errors errors)
    {
        var criteria = new List<Criterion>();
        if (input is not { Count: > 0 }) { errors.Add("criteria", "Add at least one criterion."); return criteria; }
        if (input.Count > MaxCriteria) { errors.Add("criteria", $"Use at most {MaxCriteria} criteria."); return criteria; }
        for (var i = 0; i < input.Count; i++)
        {
            var at = $"criteria[{i}]";
            var title = errors.Required($"{at}.title", input[i].Title, TitleMax, "a title");
            var description = errors.Optional($"{at}.description", input[i].Description, DescriptionMax);
            var levels = new List<Level>();
            var sent = input[i].Levels ?? [];
            if (sent.Count is < MinLevels or > MaxLevels) errors.Add($"{at}.levels", $"Give each criterion {MinLevels} to {MaxLevels} levels.");
            for (var k = 0; k < sent.Count && k < MaxLevels; k++)
            {
                var level = $"{at}.levels[{k}]";
                var levelTitle = errors.Required($"{level}.title", sent[k].Title, LevelTitleMax, "a title");
                var levelDescription = errors.Optional($"{level}.description", sent[k].Description, DescriptionMax);
                if (sent[k].Points is not { } points || points < 0 || points > MaxTotal) { errors.Add($"{level}.points", $"Give 0 to {MaxTotal} points."); continue; }
                levels.Add(new Level(levelTitle ?? "", levelDescription, Math.Round(points, 2)));
            }
            criteria.Add(new Criterion(title ?? "", description, levels));
        }
        if (!errors.Any)
        {
            var total = criteria.Sum(c => c.Levels.Max(l => l.Points));
            if (total <= 0) errors.Add("criteria", "A rubric must be worth more than 0 points: give at least one level points.");
            else if (total > MaxTotal) errors.Add("criteria", $"A rubric can be worth at most {MaxTotal} points; this one adds up to {total}.");
        }
        return criteria;
    }

    private static async Task WriteAsync(LmsDbContext db, long rubricId, List<Criterion> criteria, CancellationToken ct)
    {
        for (var i = 0; i < criteria.Count; i++)
        {
            var row = new RubricCriterion { RubricId = rubricId, Title = criteria[i].Title, Description = criteria[i].Description, SortOrder = i + 1 };
            db.RubricCriteria.Add(row);
            await db.SaveChangesAsync(ct);
            for (var k = 0; k < criteria[i].Levels.Count; k++)
            {
                var level = criteria[i].Levels[k];
                db.RubricLevels.Add(new RubricLevel { CriterionId = row.Id, Title = level.Title, Description = level.Description, Points = level.Points, SortOrder = k + 1 });
            }
        }
        await db.SaveChangesAsync(ct);
    }

    internal static async Task<List<RubricDto>> ToDtosAsync(LmsDbContext db, IReadOnlyList<Rubric> rubrics, CancellationToken ct)
    {
        var ids = rubrics.Select(r => r.Id).ToList();
        var criteria = await db.RubricCriteria.AsNoTracking().Where(c => ids.Contains(c.RubricId)).OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToListAsync(ct);
        var criterionIds = criteria.Select(c => c.Id).ToList();
        var levels = (await db.RubricLevels.AsNoTracking().Where(l => criterionIds.Contains(l.CriterionId)).OrderBy(l => l.SortOrder).ThenBy(l => l.Id).ToListAsync(ct)).ToLookup(l => l.CriterionId);
        var locked = (await db.GradeRubricScores.AsNoTracking().Where(s => criterionIds.Contains(s.CriterionId)).Select(s => s.CriterionId).Distinct().ToListAsync(ct)).ToHashSet();
        var usedBy = await db.Coursework.AsNoTracking().Where(c => c.RubricId != null && ids.Contains(c.RubricId.Value)).GroupBy(c => c.RubricId!.Value)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        return rubrics.Select(r =>
        {
            var mine = criteria.Where(c => c.RubricId == r.Id).ToList();
            var dtos = mine.Select(c => new RubricCriterionDto(c.Id, c.Title, c.Description, levels[c.Id].Select(l => new RubricLevelDto(l.Id, l.Title, l.Description, l.Points)).ToList())).ToList();
            return new RubricDto(r.Id, r.Title, dtos.Sum(c => c.Levels.Count == 0 ? 0 : c.Levels.Max(l => l.Points)), mine.Any(c => locked.Contains(c.Id)), usedBy.GetValueOrDefault(r.Id), dtos);
        }).ToList();
    }

    private static Task<bool> IsLockedAsync(LmsDbContext db, long rubricId, CancellationToken ct) =>
        db.GradeRubricScores.AnyAsync(s => db.RubricCriteria.Any(c => c.Id == s.CriterionId && c.RubricId == rubricId), ct);

    /// <summary>What an assignment using the rubric is worth.</summary>
    internal static async Task<decimal> TotalPointsAsync(LmsDbContext db, long rubricId, CancellationToken ct)
    {
        var rubric = await db.Rubrics.AsNoTracking().SingleOrDefaultAsync(r => r.Id == rubricId, ct);
        return rubric is null ? 0 : (await ToDtosAsync(db, [rubric], ct))[0].TotalPoints;
    }

    /// <summary>
    /// Whether the assignment has any grade, with a rubric or as plain points ("not handed in"
    /// grades too). Its rubric can then no longer change: the rubric sets what the assignment is
    /// worth, and a grade of 90 must not become 90 out of 10.
    /// </summary>
    internal static Task<bool> HasGradesAsync(LmsDbContext db, long courseworkId, CancellationToken ct) =>
        db.Grades.AnyAsync(g => db.Submissions.Any(s => s.Id == g.SubmissionId && s.CourseworkId == courseworkId), ct);

    /// <summary>
    /// Reads the levels an instructor chose (criterion id to level id) into score rows, adding a
    /// field error for each criterion without a level of its own. The caller sets the grade id.
    /// </summary>
    internal static async Task<List<GradeRubricScore>> ScoreAsync(LmsDbContext db, long rubricId, IReadOnlyDictionary<long, long>? chosen, Errors errors, CancellationToken ct)
    {
        var criteria = await db.RubricCriteria.AsNoTracking().Where(c => c.RubricId == rubricId).OrderBy(c => c.SortOrder).ToListAsync(ct);
        var criterionIds = criteria.Select(c => c.Id).ToList();
        var levels = await db.RubricLevels.AsNoTracking().Where(l => criterionIds.Contains(l.CriterionId)).ToListAsync(ct);
        var scores = new List<GradeRubricScore>();
        foreach (var criterion in criteria)
        {
            var level = chosen is not null && chosen.TryGetValue(criterion.Id, out var levelId) ? levels.FirstOrDefault(l => l.Id == levelId && l.CriterionId == criterion.Id) : null;
            if (level is null) errors.Add($"rubric[{criterion.Id}]", $"Choose a level for {criterion.Title}.");
            else scores.Add(new GradeRubricScore { CriterionId = criterion.Id, LevelId = level.Id, Points = level.Points });
        }
        foreach (var unknown in (chosen?.Keys ?? []).Where(id => !criterionIds.Contains(id)))
            errors.Add($"rubric[{unknown}]", "This criterion is not part of the assignment's rubric.");
        return scores;
    }

    private static IResult Conflict(string title) => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title);

    private static void Audit(LmsDbContext db, CurrentUser user, string action, long id) =>
        db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "grading", Action = action, Target = "Rubric", TargetId = id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = $"Rubric {action}" });
}
