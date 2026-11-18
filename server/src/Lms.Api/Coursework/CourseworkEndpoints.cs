using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Coursework;

/// <param name="QuestionnaireId">Instructors only; null for students.</param>
/// <param name="GradedCount">Instructors only: students on the class list with a grade (see <see cref="GradingRules"/>).</param>
/// <param name="RosterCount">Instructors only: students active on the class list.</param>
/// <param name="AnswerReview">What students see after submitting (see <see cref="Data.AnswerReview"/>). Students get it too, for the notices.</param>
/// <param name="SpellingMode">How near misses in typed answers are scored (see <see cref="Data.SpellingMode"/>).</param>
/// <param name="CloseAt">Assignments: the last moment late work is accepted (D-044).</param>
/// <param name="GradeRelease">Assignments: when students see a grade (see <see cref="Data.GradeRelease"/>).</param>
/// <param name="TurnIn">Students, assignments only: whether they can turn work in now, and why not (contract §2).</param>
public sealed record CourseworkDto(long Id, long ModuleId, string Type, string Title, string? Description, string? Category, string? Instructions, decimal MaxPoints,
    DateTime? DueAt, DateTime? AvailableFrom, bool AllowLate, bool AllowResubmission, int? MaxAttempts, int? TimeLimitMinutes,
    long? QuestionnaireId, int QuestionCount, string Status, string AnswerReview, string SpellingMode, bool ShuffleQuestions, bool ShuffleChoices,
    int? GradedCount = null, int? RosterCount = null, DateTime? CloseAt = null, string GradeRelease = Data.GradeRelease.Immediate, TurnInStatus? TurnIn = null);

/// <summary>Create: every field. Update: only the fields sent change (type cannot change).</summary>
public sealed record CourseworkInput(string? Type, long? ModuleId, string? Title, string? Description, string? Category, string? Instructions, decimal? MaxPoints,
    DateTimeOffset? DueAt, DateTimeOffset? AvailableFrom, bool? AllowLate, bool? AllowResubmission, int? MaxAttempts,
    int? TimeLimitMinutes, long? QuestionnaireId, string? Status,
    string? AnswerReview = null, string? SpellingMode = null, bool? ShuffleQuestions = null, bool? ShuffleChoices = null,
    bool? ClearDueAt = null, bool? ClearAvailableFrom = null,
    DateTimeOffset? CloseAt = null, bool? ClearCloseAt = null, string? GradeRelease = null);

/// <summary>
/// Assignments and exams given to one class. Instructors create drafts and publish them; students
/// see published work once it is available. An exam is worth the total points of its
/// questionnaire, and its questions reach students only when they start an attempt (step 4).
/// Published work is closed with the close action once every student is graded (D-036); the
/// plain update never sets or leaves the closed status. Changing an exam's spelling mode re-scores
/// the attempts already handed in (D-042).
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
            var progress = await ProgressForAsync(db, user, list.Items, ct);
            var turnIn = await AssignmentRules.ForStudentAsync(db, user, list.Items, time.GetUtcNow().UtcDateTime, ct);
            return TypedResults.Ok(new PagedList<CourseworkDto>(list.Items.Select(c => ToDto(c, user, counts, progress, turnIn)).ToList(), list.Page, list.PageSize, list.Total));
        }).WithName("ListCoursework");

        group.MapGet("/{id:long}", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await VisibleTo(user, db.Coursework.AsNoTracking().Where(c => c.ClassId == classId && c.Id == id), time).SingleOrDefaultAsync(ct);
            if (row is null) return ContentEndpoints.NotFound("Coursework");
            var turnIn = await AssignmentRules.ForStudentAsync(db, user, [row], time.GetUtcNow().UtcDateTime, ct);
            return TypedResults.Ok(ToDto(row, user, await QuestionCountsAsync(db, [row], ct), await ProgressForAsync(db, user, [row], ct), turnIn));
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
            return TypedResults.Created($"/api/classes/{classId}/coursework/{row.Id}", await DtoAsync(db, user, row, ct));
        }).WithName("CreateCoursework");

        group.MapPatch("/{id:long}", async Task<IResult> (string classId, long id, CourseworkInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Coursework.SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId, ct);
            if (row is null) return ContentEndpoints.NotFound("Coursework");
            var errors = new Errors();
            if (input.Type is not null && input.Type != row.Type) errors.Add("type", "The type cannot change; create new coursework instead.");
            // Closing checks that every student is graded, so it has its own actions.
            if (input.Status == CourseworkStatus.Closed && row.Status != CourseworkStatus.Closed)
                errors.Add("status", "Use the Close action (POST …/close) to close coursework once every student is graded.");
            else if (row.Status == CourseworkStatus.Closed && input.Status is not null && input.Status != CourseworkStatus.Closed)
                errors.Add("status", "This coursework is closed. Use the Reopen action (POST …/reopen) before changing its status.");
            if (errors.Any) return errors.Result();
            var before = row.Status;
            var spelling = row.SpellingMode;
            if (await ApplyAsync(db, user, classId, row, input, errors, ct) is { } invalid) return invalid;
            var action = row.Status == before ? "updated" : row.Status;
            await ContentEndpoints.SaveWithAuditAsync(db, user, row, action, Label(row), () => row.Id, ct, "coursework");
            if (row.SpellingMode != spelling && row.QuestionnaireId is { } setId)
            {
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                var keys = await SubmissionEndpoints.KeysAsync(db, setId, ct);
                var (regraded, changed) = await AttemptGrading.RegradeAsync(db, row, keys, time.GetUtcNow().UtcDateTime, ct);
                if (regraded > 0)
                    db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "grading", Action = "regraded", Target = Label(row),
                        TargetId = row.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = $"Spelling mode changed: {regraded} attempts re-scored, {changed} changed" });
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            return await OkAsync(db, user, row, ct);
        }).WithName("UpdateCoursework");

        // Closing stops hand-ins and attempts. It is refused, naming the students still to grade, until everyone has a grade.
        group.MapPost("/{id:long}/close", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Coursework.SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId, ct);
            if (row is null) return ContentEndpoints.NotFound("Coursework");
            if (row.Status == CourseworkStatus.Closed) return Conflict("This coursework is already closed.");
            if (row.Status != CourseworkStatus.Published) return Conflict("Only published coursework can be closed.");
            var progress = (await GradingRules.ProgressAsync(db, [row], ct))[row.Id];
            if (progress.Ungraded.Count > 0)
                return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Not every student is graded yet.",
                    detail: $"{progress.Ungraded.Count} of {progress.Roster} students still need a grade.",
                    extensions: new Dictionary<string, object?> { ["ungraded"] = progress.Ungraded });
            row.Status = CourseworkStatus.Closed;
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "closed", Label(row), () => row.Id, ct, "coursework");
            return await OkAsync(db, user, row, ct);
        }).WithName("CloseCoursework");

        group.MapPost("/{id:long}/reopen", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Coursework.SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId, ct);
            if (row is null) return ContentEndpoints.NotFound("Coursework");
            if (row.Status != CourseworkStatus.Closed) return Conflict("Only closed coursework can be reopened.");
            row.Status = CourseworkStatus.Published;
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "reopened", Label(row), () => row.Id, ct, "coursework");
            return await OkAsync(db, user, row, ct);
        }).WithName("ReopenCoursework");

        return app;
    }

    private static IResult Conflict(string title) => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title);

    private static async Task<CourseworkDto> DtoAsync(LmsDbContext db, CurrentUser user, CourseworkRow row, CancellationToken ct) =>
        ToDto(row, user, await QuestionCountsAsync(db, [row], ct), await ProgressForAsync(db, user, [row], ct));

    private static async Task<IResult> OkAsync(LmsDbContext db, CurrentUser user, CourseworkRow row, CancellationToken ct) =>
        TypedResults.Ok(await DtoAsync(db, user, row, ct));

    /// <summary>Graded progress for instructors; students get none.</summary>
    internal static async Task<Dictionary<long, GradingProgress>?> ProgressForAsync(LmsDbContext db, CurrentUser user, IReadOnlyCollection<CourseworkRow> rows, CancellationToken ct) =>
        user.IsInstructor ? await GradingRules.ProgressAsync(db, rows, ct) : null;

    /// <summary>Students see published and closed work whose availability date has passed.</summary>
    private static IQueryable<CourseworkRow> VisibleTo(CurrentUser user, IQueryable<CourseworkRow> query, TimeProvider time)
    {
        if (user.IsInstructor) return query;
        var now = time.GetUtcNow().UtcDateTime;
        return query.Where(c => (c.Status == CourseworkStatus.Published || c.Status == CourseworkStatus.Closed) && (c.AvailableFrom == null || c.AvailableFrom <= now));
    }

    /// <summary>Applies the sent fields, then checks the whole record. Returns a 400 result, or null when valid.</summary>
    private static async Task<IResult?> ApplyAsync(LmsDbContext db, CurrentUser user, string classId, CourseworkRow row, CourseworkInput input, Errors errors, CancellationToken ct)
    {
        if (input.Title is not null) row.Title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title") ?? row.Title;
        if (input.Description is not null) row.Description = errors.Optional("description", input.Description, 1000);
        if (input.Category is not null) row.Category = errors.Optional("category", input.Category, 40);
        if (input.Instructions is not null) row.Instructions = errors.Optional("instructions", input.Instructions, ContentRules.DescriptionMax);
        if (input.ModuleId is { } moduleId)
        {
            if (await db.Modules.AnyAsync(m => m.Id == moduleId && m.ClassId == classId, ct)) row.ModuleId = moduleId;
            else errors.Add("moduleId", "Choose a module of this class.");
        }
        // A null date means "unchanged"; clearDueAt / clearAvailableFrom remove one.
        if (input.ClearDueAt == true) row.DueAt = null;
        else if (input.DueAt is { } due) row.DueAt = due.UtcDateTime;
        if (input.ClearAvailableFrom == true) row.AvailableFrom = null;
        else if (input.AvailableFrom is { } from) row.AvailableFrom = from.UtcDateTime;
        if (input.AllowLate is { } late) row.AllowLate = late;
        if (input.AllowResubmission is { } again) row.AllowResubmission = again;
        if (input.MaxAttempts is { } attempts) { if (attempts is < 1 or > 20) errors.Add("maxAttempts", "Allow 1 to 20 attempts."); else row.MaxAttempts = attempts; }
        if (input.TimeLimitMinutes is { } minutes) { if (minutes is < 0 or > 600) errors.Add("timeLimitMinutes", "Use 0 to 600 minutes (0 means no limit)."); else row.TimeLimitMinutes = minutes == 0 ? null : minutes; }
        var publishing = input.Status == CourseworkStatus.Published && row.Status != CourseworkStatus.Published;
        if (input.Status is not null) { if (Statuses.Contains(input.Status)) row.Status = input.Status; else errors.Add("status", "Choose draft, published or archived."); }
        if (input.AnswerReview is not null) { if (AnswerReview.All.Contains(input.AnswerReview)) row.AnswerReview = input.AnswerReview; else errors.Add("answerReview", $"Choose one of: {string.Join(", ", AnswerReview.All)}."); }
        if (input.SpellingMode is not null) { if (SpellingMode.All.Contains(input.SpellingMode)) row.SpellingMode = input.SpellingMode; else errors.Add("spellingMode", $"Choose one of: {string.Join(", ", SpellingMode.All)}."); }
        if (input.ShuffleQuestions is { } shuffleQuestions) row.ShuffleQuestions = shuffleQuestions;
        if (input.ShuffleChoices is { } shuffleChoices) row.ShuffleChoices = shuffleChoices;
        if (row.DueAt is { } d && row.AvailableFrom is { } a && d <= a) errors.Add("dueAt", "The due date must be after the date it becomes available.");

        if (row.Type == CourseworkType.Assignment)
        {
            if (input.ClearCloseAt == true) row.CloseAt = null;
            else if (input.CloseAt is { } close) row.CloseAt = close.UtcDateTime;
            if (input.GradeRelease is not null) { if (GradeRelease.All.Contains(input.GradeRelease)) row.GradeRelease = input.GradeRelease; else errors.Add("gradeRelease", $"Choose one of: {string.Join(", ", GradeRelease.All)}."); }
            // "Accept until" ends late work, so it needs late work and a due date before it (D-044).
            if (row.CloseAt is { } last)
            {
                if (row.DueAt is not { } dueAt) errors.Add("closeAt", "Set a due date before the last day for late work.");
                else if (!row.AllowLate) errors.Add("closeAt", "Accept late work to set a last day for it.");
                else if (last <= dueAt) errors.Add("closeAt", "The last day for late work must be after the due date.");
            }
            if (input.QuestionnaireId is not null) errors.Add("questionnaireId", "Assignments have no questions; use an exam.");
            if (input.MaxPoints is { } points) { if (points is <= 0 or > 1000) errors.Add("maxPoints", "Points must be more than 0 and at most 1000."); else row.MaxPoints = points; }
            else if (row.Id == 0) errors.Add("maxPoints", "Enter the points this assignment is worth.");
        }
        else
        {
            if (input.CloseAt is not null || input.ClearCloseAt == true) errors.Add("closeAt", "Only assignments have a last day for late work.");
            if (input.GradeRelease is not null) errors.Add("gradeRelease", "Exams show results by their answer review setting.");
            if (input.QuestionnaireId is { } qid)
            {
                // Only the caller's own set, and only one for this class's subject (or one with no subject).
                var set = await db.Questionnaires.AsNoTracking().Where(q => q.Id == qid && q.OwnerInstructorId == user.Id).Select(q => new { q.SubjectId }).SingleOrDefaultAsync(ct);
                var subjectId = await db.IsmsClasses.Where(c => c.Id == classId).Select(c => c.SubjectId).SingleAsync(ct);
                if (set is null) errors.Add("questionnaireId", "Choose one of your questionnaires.");
                else if (set.SubjectId is { } s && s != subjectId) errors.Add("questionnaireId", "Choose a question set for this class's subject.");
                else row.QuestionnaireId = qid;
            }
            if (row.QuestionnaireId is null) errors.Add("questionnaireId", "An exam needs a questionnaire.");
            else
            {
                // An exam is worth its questions' points; a sent maxPoints is ignored.
                var stats = await db.Questions.Where(q => q.QuestionnaireId == row.QuestionnaireId)
                    .GroupBy(_ => 1).Select(g => new { Count = g.Count(), Points = g.Sum(q => q.Points), Incomplete = g.Count(q => q.Incomplete) }).SingleOrDefaultAsync(ct);
                row.MaxPoints = stats?.Points ?? 0;
                if (row.Status == CourseworkStatus.Published && (stats?.Count ?? 0) == 0)
                    errors.Add("status", "Add at least one question before publishing this exam.");
                // A draft may use an incomplete set; publishing it, or giving a published exam such a set, is refused.
                else if (row.Status == CourseworkStatus.Published && (publishing || input.QuestionnaireId is not null) && stats?.Incomplete > 0)
                    errors.Add("questionnaireId", "Finish the questions marked \"needs attention\" before publishing.");
            }
        }
        if (errors.Any) return errors.Result();
        return null;
    }

    private static string Label(CourseworkRow row) => row.Type == CourseworkType.Exam ? "Exam" : "Assignment";

    internal static async Task<Dictionary<long, int>> QuestionCountsAsync(LmsDbContext db, IEnumerable<CourseworkRow> rows, CancellationToken ct)
    {
        var ids = rows.Where(r => r.QuestionnaireId != null).Select(r => r.QuestionnaireId!.Value).Distinct().ToList();
        return await db.Questions.Where(q => ids.Contains(q.QuestionnaireId)).GroupBy(q => q.QuestionnaireId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
    }

    internal static CourseworkDto ToDto(CourseworkRow c, CurrentUser user, Dictionary<long, int> counts, Dictionary<long, GradingProgress>? progress, Dictionary<long, TurnInStatus>? turnIn = null)
    {
        var p = user.IsInstructor ? progress?.GetValueOrDefault(c.Id) : null;
        return new(c.Id, c.ModuleId, c.Type, c.Title, c.Description, c.Category, c.Instructions, c.MaxPoints, c.DueAt, c.AvailableFrom, c.AllowLate, c.AllowResubmission,
            c.MaxAttempts, c.TimeLimitMinutes, user.IsInstructor ? c.QuestionnaireId : null,
            c.QuestionnaireId is { } q && counts.TryGetValue(q, out var n) ? n : 0, c.Status, c.AnswerReview, c.SpellingMode, c.ShuffleQuestions, c.ShuffleChoices, p?.Graded, p?.Roster,
            c.CloseAt, c.GradeRelease, user.IsInstructor ? null : turnIn?.GetValueOrDefault(c.Id));
    }
}
