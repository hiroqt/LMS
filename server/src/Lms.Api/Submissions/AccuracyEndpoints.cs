using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <param name="Given">The typed answer; enumeration items joined with "; ".</param>
public sealed record SpellingReviewRow(long SubmissionId, string StudentId, string? StudentName, long QuestionId, int Number, string Prompt,
    string Given, IReadOnlyList<string> Accepted, string MatchNote, string? Decision, decimal? PointsAwarded, decimal Points);

public sealed record SpellingDecisionInput(string? Decision);
public sealed record PreviewScoreInput(IReadOnlyList<AnswerInput>? Answers);
public sealed record PreviewAnswer(long QuestionId, decimal? PointsAwarded, string? MatchNote);
public sealed record PreviewKey(long QuestionId, AnswerKeyDto? Key);
public sealed record PreviewScore(decimal Score, decimal MaxPoints, IReadOnlyList<PreviewAnswer> Answers, IReadOnlyList<PreviewKey> Keys);

/// <summary>
/// Accuracy tools for the class's instructor (contract §6): the spelling review list and
/// decisions, item analysis, and a preview of the exam as a student, which saves nothing.
/// </summary>
public static class AccuracyEndpoints
{
    public static IEndpointRouteBuilder MapAccuracyEndpoints(this IEndpointRouteBuilder app)
    {
        var exam = app.MapGroup("/api/classes/{classId}/coursework/{courseworkId:long}").RequireDemoUser();

        exam.MapGet("/spelling-review", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (cw, denied) = await ExamAsync(db, access, classId, courseworkId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            return TypedResults.Ok(await ReviewRowsAsync(db, cw!, null, ct));
        }).WithName("ListSpellingReview");

        exam.MapPut("/spelling-review/{submissionId:long}/{questionId:long}", async Task<IResult> (string classId, long courseworkId, long submissionId, long questionId,
            SpellingDecisionInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (cw, denied) = await ExamAsync(db, access, classId, courseworkId, user, ct);
            if (denied is not null) return denied;
            if (input.Decision is not (SpellingDecision.Accepted or SpellingDecision.Rejected))
            {
                var errors = new Errors();
                errors.Add("decision", "Choose accepted or rejected.");
                return errors.Result();
            }
            var attempt = await db.Submissions.SingleOrDefaultAsync(s => s.Id == submissionId && s.CourseworkId == cw!.Id && s.SubmittedAt != null && s.Status != SubmissionStatus.InProgress, ct);
            var answer = attempt is null ? null : await db.SubmissionAnswers.SingleOrDefaultAsync(a => a.SubmissionId == attempt.Id && a.QuestionId == questionId
                && (a.MatchNote == MatchNote.Typo || a.MatchNote == MatchNote.Review), ct);
            if (answer is null) return ContentEndpoints.NotFound("Spelling note");

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            answer.SpellingDecision = input.Decision;
            // The decision is the instructor's newer word on this answer, so it replaces points given to it earlier.
            answer.ManualPoints = null;
            await db.SaveChangesAsync(ct);
            var keys = await SubmissionEndpoints.KeysAsync(db, cw!.QuestionnaireId!.Value, ct);
            // Only an attempt whose score students could already see counts as "updated".
            await AttemptGrading.ScoreAsync(db, cw, keys, attempt!, time.GetUtcNow().UtcDateTime, regrade: attempt!.Status == SubmissionStatus.Graded, ct);
            db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "grading", Action = "spelling_decided", Target = "Exam attempt",
                TargetId = attempt.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = $"Spelling {input.Decision}" });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok((await ReviewRowsAsync(db, cw, (attempt.Id, questionId), ct)).Single());
        }).WithName("DecideSpelling");

        exam.MapGet("/item-analysis", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (cw, denied) = await ExamAsync(db, access, classId, courseworkId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var handedIn = HandedIn(db, cw!.Id);
            var answers = await db.SubmissionAnswers.AsNoTracking().Where(a => handedIn.Select(s => s.Id).Contains(a.SubmissionId)).ToListAsync(ct);
            var keys = await SubmissionEndpoints.KeysAsync(db, cw.QuestionnaireId!.Value, ct);
            return TypedResults.Ok(ItemAnalysis.Compute(keys, answers, await handedIn.CountAsync(ct)));
        }).WithName("GetItemAnalysis");

        exam.MapGet("/preview", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (cw, denied) = await ExamAsync(db, access, classId, courseworkId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            return TypedResults.Ok(await AttemptView.PreviewAsync(db, cw!, time.GetUtcNow().UtcDateTime, ct));
        }).WithName("PreviewExam");

        // Scores answers the way a submit would, with the exam's spelling mode. Nothing is saved.
        exam.MapPost("/preview/score", async Task<IResult> (string classId, long courseworkId, PreviewScoreInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (cw, denied) = await ExamAsync(db, access, classId, courseworkId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var keys = await SubmissionEndpoints.KeysAsync(db, cw!.QuestionnaireId!.Value, ct);
            var errors = new Errors();
            var rows = new Dictionary<long, SubmissionAnswer>();
            var answers = input.Answers ?? [];
            for (var i = 0; i < answers.Count; i++)
            {
                var key = keys.FirstOrDefault(k => k.Question.Id == answers[i].QuestionId);
                if (key is null) { errors.Add($"answers[{i}].questionId", "This question is not part of the exam."); continue; }
                var row = rows.TryGetValue(key.Question.Id, out var seen) ? seen : rows[key.Question.Id] = new SubmissionAnswer { QuestionId = key.Question.Id };
                SubmissionEndpoints.ApplyAnswer(errors, $"answers[{i}]", key, answers[i], row);
            }
            if (errors.Any) return errors.Result();
            var results = keys.Select(k => (k.Question.Id, Result: Scoring.Evaluate(k, rows.GetValueOrDefault(k.Question.Id), cw.SpellingMode))).ToList();
            return TypedResults.Ok(new PreviewScore(results.Sum(r => r.Result.Points ?? 0), cw.MaxPoints,
                results.Select(r => new PreviewAnswer(r.Id, r.Result.Points, r.Result.MatchNote)).ToList(),
                keys.Select(k => new PreviewKey(k.Question.Id, AttemptView.KeyOf(k))).ToList()));
        }).WithName("ScorePreview");

        return app;
    }

    /// <summary>The class's instructor and an exam of the class with a question set.</summary>
    private static async Task<(CourseworkRow? Exam, IResult? Denied)> ExamAsync(LmsDbContext db, ClassAccess access, string classId, long id, CurrentUser user, CancellationToken ct)
    {
        var (_, denied) = await access.ForGradingAsync(classId, user, ct);
        if (denied is not null) return (null, denied);
        var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId && c.Type == CourseworkType.Exam && c.QuestionnaireId != null, ct);
        return cw is null ? (null, ContentEndpoints.NotFound("Exam")) : (cw, null);
    }

    /// <summary>Handed-in attempts: never one in progress or a "not handed in" grade.</summary>
    private static IQueryable<Submission> HandedIn(LmsDbContext db, long courseworkId) =>
        db.Submissions.AsNoTracking().Where(s => s.CourseworkId == courseworkId && s.Status != SubmissionStatus.InProgress && s.SubmittedAt != null);

    /// <summary>Every typo and review answer of the exam (or just one), by question number then student.</summary>
    private static async Task<List<SpellingReviewRow>> ReviewRowsAsync(LmsDbContext db, CourseworkRow cw, (long SubmissionId, long QuestionId)? only, CancellationToken ct)
    {
        var handedIn = HandedIn(db, cw.Id);
        if (only is { } one) handedIn = handedIn.Where(s => s.Id == one.SubmissionId);
        var attempts = await handedIn.ToDictionaryAsync(s => s.Id, ct);
        var ids = attempts.Keys.ToList();
        var answers = await db.SubmissionAnswers.AsNoTracking()
            .Where(a => ids.Contains(a.SubmissionId) && (a.MatchNote == MatchNote.Typo || a.MatchNote == MatchNote.Review))
            .ToListAsync(ct);
        if (only is { } single) answers = answers.Where(a => a.QuestionId == single.QuestionId).ToList();
        var keys = (await SubmissionEndpoints.KeysAsync(db, cw.QuestionnaireId!.Value, ct)).ToDictionary(k => k.Question.Id);
        var students = attempts.Values.Select(s => s.StudentId).Distinct().ToList();
        var names = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == cw.ClassId && students.Contains(s.StudentId))
            .ToDictionaryAsync(s => s.StudentId, s => $"{s.FirstName} {s.LastName}".Trim(), ct);
        return answers.Where(a => keys.ContainsKey(a.QuestionId)).Select(a =>
        {
            var key = keys[a.QuestionId];
            var student = attempts[a.SubmissionId].StudentId;
            var given = key.Question.Type == QuestionType.Enumeration ? string.Join("; ", Scoring.ReadItems(a.AnswerText)) : a.AnswerText ?? "";
            return new SpellingReviewRow(a.SubmissionId, student, names.GetValueOrDefault(student), a.QuestionId, key.Question.SortOrder, key.Question.Prompt,
                given, key.Expected.Select(e => e.AnswerText).ToList(), a.MatchNote!, a.SpellingDecision, a.PointsAwarded, key.Question.Points);
        }).OrderBy(r => r.Number).ThenBy(r => r.StudentName, StringComparer.OrdinalIgnoreCase).ThenBy(r => r.SubmissionId).ToList();
    }
}
