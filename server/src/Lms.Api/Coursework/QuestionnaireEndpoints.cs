using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Coursework;

/// <summary>
/// Reusable question sets owned by one instructor. One questionnaire can back exams in many
/// sections. Only the owner sees it, and once any student has started an exam that uses it,
/// its questions are locked so recorded answers keep pointing at the questions they answered.
/// </summary>
public static class QuestionnaireEndpoints
{
    public static IEndpointRouteBuilder MapQuestionnaireEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/questionnaires").RequireDemoUser();

        group.MapGet("", async Task<IResult> (HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            var rows = await db.Questionnaires.AsNoTracking().Where(q => q.OwnerInstructorId == user.Id).OrderBy(q => q.Title).ToListAsync(ct);
            var ids = rows.Select(r => r.Id).ToList();
            var stats = await db.Questions.Where(q => ids.Contains(q.QuestionnaireId))
                .GroupBy(q => q.QuestionnaireId).Select(g => new { g.Key, Count = g.Count(), Points = g.Sum(q => q.Points), Incomplete = g.Count(q => q.Incomplete) }).ToListAsync(ct);
            var locked = await LockedAsync(db, ids, ct);
            var uses = await UsesAsync(db, ids, ct);
            return TypedResults.Ok(rows.Select(r =>
            {
                var s = stats.FirstOrDefault(x => x.Key == r.Id);
                return new QuestionnaireSummary(r.Id, r.Title, r.SubjectId, s?.Count ?? 0, s?.Points ?? 0, locked.Contains(r.Id), uses.GetValueOrDefault(r.Id) ?? [], s?.Incomplete ?? 0);
            }).ToList());
        }).WithName("ListQuestionnaires");

        group.MapPost("", async Task<IResult> (QuestionnaireCreate input, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            var errors = new Errors();
            var title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title");
            // A set belongs to a subject the instructor teaches, so it can be offered for that subject's exams.
            if (input.SubjectId is { } subjectId && !await db.IsmsClasses.AnyAsync(c => c.InstructorId == user.Id && c.SubjectId == subjectId, ct))
                errors.Add("subjectId", "Choose a subject you teach.");
            if (errors.Any) return errors.Result();
            db.Actor = user.Id;
            var row = new Questionnaire { OwnerInstructorId = user.Id, Title = title!, SubjectId = input.SubjectId };
            await ContentEndpoints.SaveWithAuditAsync(db, user, row, "created", "Questionnaire", () => row.Id, ct, "coursework");
            return TypedResults.Created($"/api/questionnaires/{row.Id}", await LoadAsync(db, row, ct));
        }).WithName("CreateQuestionnaire");

        group.MapGet("/{id:long}", async Task<IResult> (long id, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var (row, denied) = await OwnedAsync(db, id, http.CurrentUser(), ct);
            return denied ?? TypedResults.Ok(await LoadAsync(db, row!, ct));
        }).WithName("GetQuestionnaire");

        group.MapPatch("/{id:long}", async Task<IResult> (long id, QuestionnaireUpdate input, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (row, denied) = await OwnedAsync(db, id, user, ct, track: true);
            if (denied is not null) return denied;
            var errors = new Errors();
            row!.Title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title") ?? row.Title;
            if (errors.Any) return errors.Result();
            db.Actor = user.Id;
            await ContentEndpoints.SaveWithAuditAsync(db, user, row, "updated", "Questionnaire", () => row.Id, ct, "coursework");
            return TypedResults.Ok(await LoadAsync(db, row, ct));
        }).WithName("UpdateQuestionnaire");

        // A deep copy: new sections, questions, options and answers, so the copy can change while the original stays locked.
        group.MapPost("/{id:long}/copy", async Task<IResult> (long id, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (source, denied) = await OwnedAsync(db, id, user, ct);
            if (denied is not null) return denied;

            db.Actor = user.Id;
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var copy = new Questionnaire { OwnerInstructorId = user.Id, SubjectId = source!.SubjectId, Title = CopyTitle(source.Title) };
            db.Questionnaires.Add(copy);
            await db.SaveChangesAsync(ct);
            await QuestionStore.CopyAsync(db, id, copy.Id, ct);
            db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "coursework", Action = "copied", Target = "Questionnaire", TargetId = copy.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = "Questionnaire copied" });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Created($"/api/questionnaires/{copy.Id}", await LoadAsync(db, copy, ct));
        }).WithName("CopyQuestionnaire");

        // The whole question list is replaced at once, so the order and numbering are always consistent.
        group.MapPut("/{id:long}/questions", async Task<IResult> (long id, QuestionsReplace input, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (row, denied) = await OwnedAsync(db, id, user, ct, track: true);
            if (denied is not null) return denied;
            if ((await LockedAsync(db, [id], ct)).Count > 0)
                return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Students have already started an exam that uses these questions, so they can no longer be changed. Copy them into a new questionnaire instead.");

            var questions = input.Questions ?? [];
            IReadOnlyList<SectionInput> sections = input.Sections is { Count: > 0 } sent ? sent : [new SectionInput("", null, null)];
            var errors = new Errors();
            if (questions.Count > QuestionRules.MaxQuestions) errors.Add("questions", $"Use at most {QuestionRules.MaxQuestions} questions.");
            QuestionRules.ValidateSections(errors, sections);
            // With allowIncomplete only structural problems refuse the request; content problems mark the question incomplete.
            for (var i = 0; i < questions.Count; i++)
            {
                if (input.AllowIncomplete == true) QuestionRules.Structural(errors, i, questions[i], sections.Count);
                else QuestionRules.Validate(errors, i, questions[i], sections.Count);
            }
            if (errors.Any) return errors.Result();

            db.Actor = user.Id;
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            db.Questions.RemoveRange(await db.Questions.Where(q => q.QuestionnaireId == id).ToListAsync(ct));
            await db.SaveChangesAsync(ct);
            db.QuestionSections.RemoveRange(await db.QuestionSections.Where(s => s.QuestionnaireId == id).ToListAsync(ct));
            await db.SaveChangesAsync(ct);
            await QuestionStore.AddAsync(db, id, sections, questions, ct);

            // Exams that use this questionnaire are worth its total points.
            var total = questions.Sum(q => Math.Clamp(q.Points ?? 0, 0, 1000));
            await db.Coursework.Where(c => c.QuestionnaireId == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.MaxPoints, total), ct);
            db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "coursework", Action = "updated", Target = "Questions", TargetId = id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = "Questions updated" });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(await LoadAsync(db, row!, ct));
        }).WithName("ReplaceQuestions");

        return app;
    }

    /// <summary>The owner's view of a questionnaire with its sections and every answer.</summary>
    internal static async Task<QuestionnaireDto> LoadAsync(LmsDbContext db, Questionnaire row, CancellationToken ct)
    {
        var sections = await QuestionStore.SectionsAsync(db, row.Id, ct);
        var questions = await db.Questions.AsNoTracking().Where(q => q.QuestionnaireId == row.Id).OrderBy(q => q.SortOrder).ToListAsync(ct);
        var ids = questions.Select(q => q.Id).ToList();
        var options = await db.QuestionOptions.AsNoTracking().Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.SortOrder).ToListAsync(ct);
        var answers = await db.QuestionExpectedAnswers.AsNoTracking().Where(a => ids.Contains(a.QuestionId)).OrderBy(a => a.SortOrder).ToListAsync(ct);
        var locked = (await LockedAsync(db, [row.Id], ct)).Count > 0;
        var uses = (await UsesAsync(db, [row.Id], ct)).GetValueOrDefault(row.Id) ?? [];
        return new QuestionnaireDto(row.Id, row.Title, row.SubjectId, locked,
            sections.Select(s => new SectionDto(s.Id, s.Title, s.Directions, s.DefaultPoints, s.SortOrder)).ToList(),
            questions.Select(q => QuestionStore.ToDto(q, options.Where(o => o.QuestionId == q.Id).ToList(), answers.Where(a => a.QuestionId == q.Id).ToList())).ToList(),
            uses);
    }

    /// <summary>"Midterm" becomes "Midterm (copy)", shortened so it still fits the title limit.</summary>
    internal static string CopyTitle(string title)
    {
        const string suffix = " (copy)";
        var room = ContentRules.TitleMax - suffix.Length;
        return (title.Length > room ? title[..room].TrimEnd() : title) + suffix;
    }

    /// <summary>The exams (archived ones left out) that use each questionnaire, with their class.</summary>
    internal static async Task<Dictionary<long, List<QuestionnaireUse>>> UsesAsync(LmsDbContext db, IReadOnlyCollection<long> questionnaireIds, CancellationToken ct)
    {
        var rows = await db.Coursework.AsNoTracking()
            .Where(c => c.QuestionnaireId != null && questionnaireIds.Contains(c.QuestionnaireId.Value) && c.Status != CourseworkStatus.Archived)
            .Join(db.IsmsClasses, c => c.ClassId, k => k.Id, (c, k) => new { QuestionnaireId = c.QuestionnaireId!.Value, c.Id, c.Title, c.ClassId, k.SubjectName, k.SectionName })
            .OrderBy(x => x.Id).ToListAsync(ct);
        return rows.GroupBy(x => x.QuestionnaireId)
            .ToDictionary(g => g.Key, g => g.Select(x => new QuestionnaireUse(x.Id, x.Title, x.ClassId, x.SubjectName, x.SectionName)).ToList());
    }

    /// <summary>Questionnaires an exam has been started on: their questions can no longer change.</summary>
    internal static async Task<HashSet<long>> LockedAsync(LmsDbContext db, IReadOnlyCollection<long> questionnaireIds, CancellationToken ct) =>
        (await db.Coursework.Where(c => c.QuestionnaireId != null && questionnaireIds.Contains(c.QuestionnaireId.Value))
            .Where(c => db.Submissions.Any(s => s.CourseworkId == c.Id))
            .Select(c => c.QuestionnaireId!.Value).Distinct().ToListAsync(ct)).ToHashSet();

    internal static async Task<(Questionnaire? Row, IResult? Denied)> OwnedAsync(LmsDbContext db, long id, CurrentUser user, CancellationToken ct, bool track = false)
    {
        if (!user.IsInstructor) return (null, InstructorsOnly());
        var query = track ? db.Questionnaires : db.Questionnaires.AsNoTracking();
        var row = await query.SingleOrDefaultAsync(q => q.Id == id && q.OwnerInstructorId == user.Id, ct);
        return row is null ? (null, ContentEndpoints.NotFound("Questionnaire")) : (row, null);
    }

    private static IResult InstructorsOnly() =>
        TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only instructors have questionnaires.");
}
