using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Coursework;

/// <param name="QuestionnaireId">Instructors only; null for students.</param>
public sealed record CourseworkDto(long Id, long ModuleId, string Type, string Title, string? Instructions, decimal MaxPoints,
    DateTime? DueAt, DateTime? AvailableFrom, bool AllowLate, bool AllowResubmission, int? MaxAttempts, int? TimeLimitMinutes,
    long? QuestionnaireId, int QuestionCount, string Status);

/// <summary>Create: every field. Update: only the fields sent change (type cannot change).</summary>
public sealed record CourseworkInput(string? Type, long? ModuleId, string? Title, string? Instructions, decimal? MaxPoints,
    DateTimeOffset? DueAt, DateTimeOffset? AvailableFrom, bool? AllowLate, bool? AllowResubmission, int? MaxAttempts,
    int? TimeLimitMinutes, long? QuestionnaireId, string? Status);

/// <summary>
/// Assignments and exams given to one class. Instructors create drafts and publish them; students
/// see published work once it is available. An exam is worth the total points of its
/// questionnaire, and its questions reach students only when they start an attempt (step 4).
/// </summary>
public static class CourseworkEndpoints
{
    private static readonly string[] Statuses = [CourseworkStatus.Draft, CourseworkStatus.Published, CourseworkStatus.Archived];

    public static IEndpointRouteBuilder MapCourseworkEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/classes/{classId}/coursework").RequireDemoUser();

        group.MapGet("", async Task<IResult> (string classId, string? type, int? page, int? pageSize, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            if (ContentEndpoints.PageError(page, pageSize) is { } bad) return bad;
            var query = VisibleTo(user, db.Coursework.AsNoTracking().Where(c => c.ClassId == classId), time);
            if (type is not null) query = query.Where(c => c.Type == type);
            var list = await ContentEndpoints.PageAsync(query.OrderBy(c => c.DueAt == null).ThenBy(c => c.DueAt).ThenBy(c => c.Id), page, pageSize, c => c, ct);
            var counts = await QuestionCountsAsync(db, list.Items, ct);
            return TypedResults.Ok(new PagedList<CourseworkDto>(list.Items.Select(c => ToDto(c, user, counts)).ToList(), list.Page, list.PageSize, list.Total));
        }).WithName("ListCoursework");

        group.MapGet("/{id:long}", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await VisibleTo(user, db.Coursework.AsNoTracking().Where(c => c.ClassId == classId && c.Id == id), time).SingleOrDefaultAsync(ct);
            if (row is null) return ContentEndpoints.NotFound("Coursework");
            return TypedResults.Ok(ToDto(row, user, await QuestionCountsAsync(db, [row], ct)));
        }).WithName("GetCoursework");

        group.MapPost("", async Task<IResult> (string classId, CourseworkInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var errors = new Errors();
            if (input.Type is not (CourseworkType.Assignment or CourseworkType.Exam)) errors.Add("type", "Choose assignment or exam.");
            if (input.ModuleId is null) errors.Add("moduleId", "Choose a module of this class.");
            if (input.Title is null) errors.Add("title", "Enter a title.");
            if (errors.Any) return errors.Result();

            var row = new CourseworkRow { ClassId = classId, Type = input.Type!, Status = CourseworkStatus.Draft };
            if (await ApplyAsync(db, user, classId, row, input, errors, ct) is { } invalid) return invalid;
            await ContentEndpoints.SaveWithAuditAsync(db, user, row, row.Status == CourseworkStatus.Published ? "published" : "created", Label(row), () => row.Id, ct, "coursework");
            return TypedResults.Created($"/api/classes/{classId}/coursework/{row.Id}", ToDto(row, user, await QuestionCountsAsync(db, [row], ct)));
        }).WithName("CreateCoursework");

        group.MapPatch("/{id:long}", async Task<IResult> (string classId, long id, CourseworkInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Coursework.SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId, ct);
            if (row is null) return ContentEndpoints.NotFound("Coursework");
            var errors = new Errors();
            if (input.Type is not null && input.Type != row.Type) errors.Add("type", "The type cannot change; create new coursework instead.");
            var before = row.Status;
            if (await ApplyAsync(db, user, classId, row, input, errors, ct) is { } invalid) return invalid;
            var action = row.Status == before ? "updated" : row.Status;
            await ContentEndpoints.SaveWithAuditAsync(db, user, row, action, Label(row), () => row.Id, ct, "coursework");
            return TypedResults.Ok(ToDto(row, user, await QuestionCountsAsync(db, [row], ct)));
        }).WithName("UpdateCoursework");

        return app;
    }

    /// <summary>Students see published work whose availability date has passed.</summary>
    private static IQueryable<CourseworkRow> VisibleTo(CurrentUser user, IQueryable<CourseworkRow> query, TimeProvider time)
    {
        if (user.IsInstructor) return query;
        var now = time.GetUtcNow().UtcDateTime;
        return query.Where(c => c.Status == CourseworkStatus.Published && (c.AvailableFrom == null || c.AvailableFrom <= now));
    }

    /// <summary>Applies the sent fields, then checks the whole record. Returns a 400 result, or null when valid.</summary>
    private static async Task<IResult?> ApplyAsync(LmsDbContext db, CurrentUser user, string classId, CourseworkRow row, CourseworkInput input, Errors errors, CancellationToken ct)
    {
        if (input.Title is not null) row.Title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title") ?? row.Title;
        if (input.Instructions is not null) row.Instructions = errors.Optional("instructions", input.Instructions, ContentRules.DescriptionMax);
        if (input.ModuleId is { } moduleId)
        {
            if (await db.Modules.AnyAsync(m => m.Id == moduleId && m.ClassId == classId, ct)) row.ModuleId = moduleId;
            else errors.Add("moduleId", "Choose a module of this class.");
        }
        if (input.DueAt is { } due) row.DueAt = due.UtcDateTime;
        if (input.AvailableFrom is { } from) row.AvailableFrom = from.UtcDateTime;
        if (input.AllowLate is { } late) row.AllowLate = late;
        if (input.AllowResubmission is { } again) row.AllowResubmission = again;
        if (input.MaxAttempts is { } attempts) { if (attempts is < 1 or > 20) errors.Add("maxAttempts", "Allow 1 to 20 attempts."); else row.MaxAttempts = attempts; }
        if (input.TimeLimitMinutes is { } minutes) { if (minutes is < 0 or > 600) errors.Add("timeLimitMinutes", "Use 0 to 600 minutes (0 means no limit)."); else row.TimeLimitMinutes = minutes == 0 ? null : minutes; }
        if (input.Status is not null) { if (Statuses.Contains(input.Status)) row.Status = input.Status; else errors.Add("status", "Choose draft, published or archived."); }
        if (row.DueAt is { } d && row.AvailableFrom is { } a && d <= a) errors.Add("dueAt", "The due date must be after the date it becomes available.");

        if (row.Type == CourseworkType.Assignment)
        {
            if (input.QuestionnaireId is not null) errors.Add("questionnaireId", "Assignments have no questions; use an exam.");
            if (input.MaxPoints is { } points) { if (points is <= 0 or > 1000) errors.Add("maxPoints", "Points must be more than 0 and at most 1000."); else row.MaxPoints = points; }
            else if (row.Id == 0) errors.Add("maxPoints", "Enter the points this assignment is worth.");
        }
        else
        {
            if (input.QuestionnaireId is { } qid)
            {
                if (await db.Questionnaires.AnyAsync(q => q.Id == qid && q.OwnerInstructorId == user.Id, ct)) row.QuestionnaireId = qid;
                else errors.Add("questionnaireId", "Choose one of your questionnaires.");
            }
            if (row.QuestionnaireId is null) errors.Add("questionnaireId", "An exam needs a questionnaire.");
            else
            {
                // An exam is worth its questions' points; a sent maxPoints is ignored.
                var stats = await db.Questions.Where(q => q.QuestionnaireId == row.QuestionnaireId)
                    .GroupBy(_ => 1).Select(g => new { Count = g.Count(), Points = g.Sum(q => q.Points) }).SingleOrDefaultAsync(ct);
                row.MaxPoints = stats?.Points ?? 0;
                if (row.Status == CourseworkStatus.Published && (stats?.Count ?? 0) == 0)
                    errors.Add("status", "Add at least one question before publishing this exam.");
            }
        }
        if (errors.Any) return errors.Result();
        return null;
    }

    private static string Label(CourseworkRow row) => row.Type == CourseworkType.Exam ? "Exam" : "Assignment";

    private static async Task<Dictionary<long, int>> QuestionCountsAsync(LmsDbContext db, IEnumerable<CourseworkRow> rows, CancellationToken ct)
    {
        var ids = rows.Where(r => r.QuestionnaireId != null).Select(r => r.QuestionnaireId!.Value).Distinct().ToList();
        return await db.Questions.Where(q => ids.Contains(q.QuestionnaireId)).GroupBy(q => q.QuestionnaireId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
    }

    private static CourseworkDto ToDto(CourseworkRow c, CurrentUser user, Dictionary<long, int> counts) => new(
        c.Id, c.ModuleId, c.Type, c.Title, c.Instructions, c.MaxPoints, c.DueAt, c.AvailableFrom, c.AllowLate, c.AllowResubmission,
        c.MaxAttempts, c.TimeLimitMinutes, user.IsInstructor ? c.QuestionnaireId : null,
        c.QuestionnaireId is { } q && counts.TryGetValue(q, out var n) ? n : 0, c.Status);
}
