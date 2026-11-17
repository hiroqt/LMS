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
                .GroupBy(q => q.QuestionnaireId).Select(g => new { g.Key, Count = g.Count(), Points = g.Sum(q => q.Points) }).ToListAsync(ct);
            var locked = await LockedAsync(db, ids, ct);
            var uses = await UsesAsync(db, ids, ct);
            return TypedResults.Ok(rows.Select(r =>
            {
                var s = stats.FirstOrDefault(x => x.Key == r.Id);
                return new QuestionnaireSummary(r.Id, r.Title, r.SubjectId, s?.Count ?? 0, s?.Points ?? 0, locked.Contains(r.Id), uses.GetValueOrDefault(r.Id) ?? []);
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

        // A deep copy: new questions, options and answers, so the copy can change while the original stays locked.
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

            var questions = await db.Questions.AsNoTracking().Where(q => q.QuestionnaireId == id).OrderBy(q => q.SortOrder).ToListAsync(ct);
            var ids = questions.Select(q => q.Id).ToList();
            var options = await db.QuestionOptions.AsNoTracking().Where(o => ids.Contains(o.QuestionId)).ToListAsync(ct);
            var answers = await db.QuestionExpectedAnswers.AsNoTracking().Where(a => ids.Contains(a.QuestionId)).ToListAsync(ct);
            foreach (var q in questions)
            {
                var question = new Question { QuestionnaireId = copy.Id, Type = q.Type, Prompt = q.Prompt, Points = q.Points, SortOrder = q.SortOrder, TimeLimitSeconds = q.TimeLimitSeconds };
                db.Questions.Add(question);
                await db.SaveChangesAsync(ct);
                foreach (var o in options.Where(o => o.QuestionId == q.Id))
                    db.QuestionOptions.Add(new QuestionOption { QuestionId = question.Id, Text = o.Text, IsCorrect = o.IsCorrect, SortOrder = o.SortOrder });
                foreach (var a in answers.Where(a => a.QuestionId == q.Id))
                    db.QuestionExpectedAnswers.Add(new QuestionExpectedAnswer { QuestionId = question.Id, AnswerText = a.AnswerText, SortOrder = a.SortOrder });
            }
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
            var errors = new Errors();
            if (questions.Count > QuestionRules.MaxQuestions) errors.Add("questions", $"Use at most {QuestionRules.MaxQuestions} questions.");
            for (var i = 0; i < questions.Count; i++) QuestionRules.Validate(errors, i, questions[i]);
            if (errors.Any) return errors.Result();

            db.Actor = user.Id;
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            db.Questions.RemoveRange(await db.Questions.Where(q => q.QuestionnaireId == id).ToListAsync(ct));
            await db.SaveChangesAsync(ct);

            for (var i = 0; i < questions.Count; i++)
            {
                var q = questions[i];
                var question = new Question { QuestionnaireId = id, Type = q.Type!, Prompt = q.Prompt!.Trim(), Points = q.Points!.Value, SortOrder = i + 1, TimeLimitSeconds = q.TimeLimitSeconds is > 0 ? q.TimeLimitSeconds : null };
                db.Questions.Add(question);
                await db.SaveChangesAsync(ct);
                AddParts(db, question.Id, q);
            }
            await db.SaveChangesAsync(ct);

            // Exams that use this questionnaire are worth its total points.
            var total = questions.Sum(q => q.Points ?? 0);
            await db.Coursework.Where(c => c.QuestionnaireId == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.MaxPoints, total), ct);
            db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "coursework", Action = "updated", Target = "Questions", TargetId = id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = "Questions updated" });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(await LoadAsync(db, row!, ct));
        }).WithName("ReplaceQuestions");

        return app;
    }

    private static void AddParts(LmsDbContext db, long questionId, QuestionInput q)
    {
        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
                for (var k = 0; k < q.Options!.Count; k++)
                    db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = q.Options[k].Text!.Trim(), IsCorrect = q.Options[k].IsCorrect, SortOrder = k + 1 });
                break;
            case QuestionType.TrueFalse:
                db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = "True", IsCorrect = q.CorrectAnswer == true, SortOrder = 1 });
                db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = "False", IsCorrect = q.CorrectAnswer == false, SortOrder = 2 });
                break;
            case QuestionType.Enumeration:
                for (var k = 0; k < q.ExpectedAnswers!.Count; k++)
                    db.QuestionExpectedAnswers.Add(new QuestionExpectedAnswer { QuestionId = questionId, AnswerText = q.ExpectedAnswers[k]!.Trim(), SortOrder = k + 1 });
                break;
            case QuestionType.Matching:
                // A pair is the option (left) and the expected answer (right) with the same sort order.
                for (var k = 0; k < q.Pairs!.Count; k++)
                {
                    db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = q.Pairs[k].Left!.Trim(), SortOrder = k + 1 });
                    db.QuestionExpectedAnswers.Add(new QuestionExpectedAnswer { QuestionId = questionId, AnswerText = q.Pairs[k].Right!.Trim(), SortOrder = k + 1 });
                }
                break;
        }
    }

    /// <summary>The owner's view of a questionnaire with every answer.</summary>
    internal static async Task<QuestionnaireDto> LoadAsync(LmsDbContext db, Questionnaire row, CancellationToken ct)
    {
        var questions = await db.Questions.AsNoTracking().Where(q => q.QuestionnaireId == row.Id).OrderBy(q => q.SortOrder).ToListAsync(ct);
        var ids = questions.Select(q => q.Id).ToList();
        var options = await db.QuestionOptions.AsNoTracking().Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.SortOrder).ToListAsync(ct);
        var answers = await db.QuestionExpectedAnswers.AsNoTracking().Where(a => ids.Contains(a.QuestionId)).OrderBy(a => a.SortOrder).ToListAsync(ct);
        var locked = (await LockedAsync(db, [row.Id], ct)).Count > 0;
        var uses = (await UsesAsync(db, [row.Id], ct)).GetValueOrDefault(row.Id) ?? [];
        return new QuestionnaireDto(row.Id, row.Title, row.SubjectId, locked, questions.Select(q =>
        {
            var opts = options.Where(o => o.QuestionId == q.Id).ToList();
            var exp = answers.Where(a => a.QuestionId == q.Id).ToList();
            return q.Type == QuestionType.Matching
                ? new QuestionDto(q.Id, q.Type, q.Prompt, q.Points, q.SortOrder, q.TimeLimitSeconds, [], [],
                    opts.Join(exp, o => o.SortOrder, a => a.SortOrder, (o, a) => new PairDto(o.Text, a.AnswerText)).ToList())
                : new QuestionDto(q.Id, q.Type, q.Prompt, q.Points, q.SortOrder, q.TimeLimitSeconds,
                    opts.Select(o => new OptionDto(o.Id, o.Text, o.IsCorrect)).ToList(), exp.Select(a => a.AnswerText).ToList(), []);
        }).ToList(), uses);
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
