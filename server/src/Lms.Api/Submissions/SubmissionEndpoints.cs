using Lms.Api.Content;
using Lms.Api.Coursework;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>
/// Handing in work and grading it. Every rule is checked here, not in the browser: when work is
/// available, due dates and late work, attempt limits, the exam time limit, and scoring.
/// Correct answers reach only the class's instructor.
/// </summary>
public static class SubmissionEndpoints
{
    /// <summary>Extra time after a deadline for answers already on their way.</summary>
    public static readonly TimeSpan Grace = TimeSpan.FromSeconds(60);
    private const int TextMax = 20_000;
    /// <summary>Exam answers (contract §1): essays, typed answers, and each enumeration item.</summary>
    public const int EssayMax = 10_000;
    public const int TypedMax = 200;
    public const int ItemsMax = 20;
    private const int FeedbackMax = 2_000;

    public static IEndpointRouteBuilder MapSubmissionEndpoints(this IEndpointRouteBuilder app)
    {
        var work = app.MapGroup("/api/classes/{classId}/coursework/{courseworkId:long}").RequireDemoUser();

        // ------------------------------------------------------------- student: exams
        work.MapPost("/attempts", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForStudentWorkAsync(classId, user, ct);
            if (denied is not null) return denied;
            var cw = await VisibleAsync(db, classId, courseworkId, time, ct);
            if (cw is null || cw.Type != CourseworkType.Exam) return ContentEndpoints.NotFound("Exam");
            if (cw.Status == CourseworkStatus.Closed) return Conflict(ClosedExam);
            var now = time.GetUtcNow().UtcDateTime;

            var mine = await db.Submissions.Where(s => s.CourseworkId == cw.Id && s.StudentId == user.Id).ToListAsync(ct);
            if (mine.Any(GradingRules.IsNotHandedIn)) return Conflict("Your instructor has already recorded a grade for this exam without an attempt.");
            var open = mine.FirstOrDefault(s => s.Status == SubmissionStatus.InProgress);
            if (open is not null) return TypedResults.Ok(await AttemptView.BuildAsync(db, cw, open, now, ct));

            if (cw.DueAt is { } due && now > due && !cw.AllowLate) return Conflict("This exam is past its due date.");
            if (mine.Count >= (cw.MaxAttempts ?? 1)) return Conflict("You have used every attempt for this exam.");

            var attempt = new Submission { CourseworkId = cw.Id, StudentId = user.Id, AttemptNumber = mine.Count + 1, Status = SubmissionStatus.InProgress, StartedAt = now };
            db.Submissions.Add(attempt);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return Conflict("Another attempt was started at the same moment. Reload and try again."); }
            return TypedResults.Created($"/api/classes/{classId}/coursework/{cw.Id}/attempts/{attempt.Id}", await AttemptView.BuildAsync(db, cw, attempt, now, ct));
        }).WithName("StartAttempt");

        work.MapGet("/attempts/{id:long}", async Task<IResult> (string classId, long courseworkId, long id, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var (cw, attempt) = await OwnAttemptAsync(db, classId, courseworkId, id, user, ct);
            return attempt is null ? ContentEndpoints.NotFound("Attempt") : TypedResults.Ok(await AttemptView.BuildAsync(db, cw!, attempt, time.GetUtcNow().UtcDateTime, ct));
        }).WithName("GetAttempt");

        work.MapPut("/attempts/{id:long}/answers", async Task<IResult> (string classId, long courseworkId, long id, AnswersInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForStudentWorkAsync(classId, user, ct);
            if (denied is not null) return denied;
            var (cw, attempt) = await OwnAttemptAsync(db, classId, courseworkId, id, user, ct);
            if (attempt is null) return ContentEndpoints.NotFound("Attempt");
            if (cw!.Status == CourseworkStatus.Closed) return Conflict(ClosedExam);
            if (attempt.Status != SubmissionStatus.InProgress) return Conflict("This attempt has already been submitted.");
            if (Deadline(cw!, attempt) is { } deadline && time.GetUtcNow().UtcDateTime > deadline + Grace) return Conflict("Time is up for this attempt; submit it to record your saved answers.");
            var keys = await KeysAsync(db, cw!.QuestionnaireId!.Value, ct);
            if (await SaveAnswersAsync(db, attempt.Id, keys, input.Answers ?? [], ct) is { } invalid) return invalid;
            return TypedResults.Ok(await AttemptView.BuildAsync(db, cw, attempt, time.GetUtcNow().UtcDateTime, ct));
        }).WithName("SaveAnswers");

        work.MapPost("/attempts/{id:long}/submit", async Task<IResult> (string classId, long courseworkId, long id, AnswersInput? input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForStudentWorkAsync(classId, user, ct);
            if (denied is not null) return denied;
            var (cw, attempt) = await OwnAttemptAsync(db, classId, courseworkId, id, user, ct, track: true);
            if (attempt is null) return ContentEndpoints.NotFound("Attempt");
            if (cw!.Status == CourseworkStatus.Closed) return Conflict(ClosedExam);
            if (attempt.Status != SubmissionStatus.InProgress) return Conflict("This attempt has already been submitted.");
            var now = time.GetUtcNow().UtcDateTime;
            var keys = await KeysAsync(db, cw!.QuestionnaireId!.Value, ct);

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            // Answers sent with the submit count only while there is still time; after that the saved ones stand.
            var inTime = Deadline(cw, attempt) is not { } deadline || now <= deadline + Grace;
            if (inTime && input?.Answers is { Count: > 0 } answers && await SaveAnswersAsync(db, attempt.Id, keys, answers, ct) is { } invalid)
                return invalid;

            // Graded now unless an essay or a near miss in review mode waits for the instructor.
            attempt.SubmittedAt = now;
            await AttemptGrading.ScoreAsync(db, cw, keys, attempt, now, regrade: false, ct);
            Audit(db, user, "submissions", "submitted", "Exam attempt", attempt.Id);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(await AttemptView.BuildAsync(db, cw, attempt, now, ct));
        }).WithName("SubmitAttempt");

        // -------------------------------------------------------- student: assignments
        work.MapPost("/submissions", async Task<IResult> (string classId, long courseworkId, AssignmentSubmit input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForStudentWorkAsync(classId, user, ct);
            if (denied is not null) return denied;
            var cw = await VisibleAsync(db, classId, courseworkId, time, ct);
            if (cw is null || cw.Type != CourseworkType.Assignment) return ContentEndpoints.NotFound("Assignment");
            if (cw.Status == CourseworkStatus.Closed) return Conflict("This assignment is closed and no longer accepts work.");
            var now = time.GetUtcNow().UtcDateTime;
            if (cw.DueAt is { } due && now > due && !cw.AllowLate) return Conflict("This assignment is past its due date and does not accept late work.");
            var mine = await db.Submissions.AsNoTracking().Where(s => s.CourseworkId == cw.Id && s.StudentId == user.Id).ToListAsync(ct);
            if (mine.Any(GradingRules.IsNotHandedIn)) return Conflict("Your instructor has already recorded a grade for this assignment without a submission.");
            var previous = mine.Count;
            if (previous > 0 && !cw.AllowResubmission) return Conflict("You have already handed this in, and resubmission is not allowed.");

            var errors = new Errors();
            var text = errors.Optional("text", input.Text, TextMax);
            var fileName = errors.Optional("fileName", input.FileName, 255);
            if (fileName?.IndexOfAny(['/', '\\']) >= 0) errors.Add("fileName", "Use a file name without a folder path.");
            if (text is null && fileName is null) errors.Add("text", "Write something or attach a file.");
            if (errors.Any) return errors.Result();

            var row = new Submission { CourseworkId = cw.Id, StudentId = user.Id, AttemptNumber = previous + 1, Status = SubmissionStatus.Submitted, StartedAt = now, SubmittedAt = now, Text = text, FileName = fileName };
            db.Submissions.Add(row);
            try { await ContentEndpoints.SaveWithAuditAsync(db, user, row, "submitted", "Assignment", () => row.Id, ct, "submissions"); }
            catch (DbUpdateException) { return Conflict("Another submission was saved at the same moment. Reload and try again."); }
            return TypedResults.Created($"/api/classes/{classId}/coursework/{cw.Id}/submissions/{row.Id}", await ToDtoAsync(db, cw, [row], ct) is [var dto] ? dto : null);
        }).WithName("SubmitAssignment");

        work.MapGet("/my-submissions", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var cw = await VisibleAsync(db, classId, courseworkId, time, ct);
            if (cw is null) return ContentEndpoints.NotFound("Coursework");
            var rows = await db.Submissions.AsNoTracking().Where(s => s.CourseworkId == cw.Id && s.StudentId == user.Id).OrderBy(s => s.AttemptNumber).ToListAsync(ct);
            return TypedResults.Ok(await ToDtoAsync(db, cw, rows, ct));
        }).WithName("ListMySubmissions");

        // ------------------------------------------------------------------ instructor
        work.MapGet("/submissions", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForGradingAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId, ct);
            if (cw is null) return ContentEndpoints.NotFound("Coursework");
            var rows = await db.Submissions.AsNoTracking().Where(s => s.CourseworkId == cw.Id).OrderBy(s => s.StudentId).ThenBy(s => s.AttemptNumber).ToListAsync(ct);
            var handedIn = rows.Where(r => r.Status != SubmissionStatus.InProgress).Select(r => r.StudentId).ToHashSet();
            var missing = (await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == classId && s.IsActive).OrderBy(s => s.LastName).ThenBy(s => s.FirstName).ToListAsync(ct))
                .Where(s => !handedIn.Contains(s.StudentId)).Select(s => new StudentRef(s.StudentId, $"{s.FirstName} {s.LastName}".Trim())).ToList();
            return TypedResults.Ok(new SubmissionList(await ToDtoAsync(db, cw, rows, ct), missing));
        }).WithName("ListSubmissions");

        work.MapGet("/submissions/{id:long}", async Task<IResult> (string classId, long courseworkId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForGradingAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var (cw, row) = await SubmissionOfClassAsync(db, classId, courseworkId, id, ct);
            if (row is null) return ContentEndpoints.NotFound("Submission");
            var dto = (await ToDtoAsync(db, cw!, [row], ct))[0];
            if (cw!.QuestionnaireId is not { } qid) return TypedResults.Ok(new SubmissionDetail(dto, [], []));
            var questionnaire = await db.Questionnaires.AsNoTracking().SingleAsync(q => q.Id == qid, ct);
            var keys = await KeysAsync(db, qid, ct);
            var answers = await db.SubmissionAnswers.AsNoTracking().Where(a => a.SubmissionId == row.Id).ToListAsync(ct);
            return TypedResults.Ok(new SubmissionDetail(dto, (await QuestionnaireEndpoints.LoadAsync(db, questionnaire, ct)).Questions,
                answers.Select(a => AttemptView.ToAnswerDto(keys, a, true, instructor: true)).ToList()));
        }).WithName("GetSubmission");

        work.MapPut("/submissions/{id:long}/grade", async Task<IResult> (string classId, long courseworkId, long id, GradeInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForGradingAsync(classId, user, ct);
            if (denied is not null) return denied;
            var (cw, row) = await SubmissionOfClassAsync(db, classId, courseworkId, id, ct, track: true);
            if (row is null) return ContentEndpoints.NotFound("Submission");
            if (row.Status == SubmissionStatus.InProgress) return Conflict("This attempt has not been submitted yet.");

            var errors = new Errors();
            var feedback = errors.Optional("feedback", input.Feedback, FeedbackMax);
            decimal total;
            // A "not handed in" grade has no answers to add up, so an exam's one also takes plain points.
            if (cw!.Type == CourseworkType.Assignment || GradingRules.IsNotHandedIn(row))
            {
                if (input.Points is not { } points || points < 0 || points > cw.MaxPoints) { errors.Add("points", $"Give a score from 0 to {cw.MaxPoints}."); total = 0; }
                else total = Math.Round(points, 2);
            }
            else
            {
                var keys = await KeysAsync(db, cw.QuestionnaireId!.Value, ct);
                var answers = await db.SubmissionAnswers.Where(a => a.SubmissionId == row.Id).ToListAsync(ct);
                foreach (var (questionId, points) in input.AnswerPoints ?? new Dictionary<long, decimal>())
                {
                    var key = keys.FirstOrDefault(k => k.Question.Id == questionId);
                    if (key is null) { errors.Add($"answerPoints[{questionId}]", "This question is not part of the exam."); continue; }
                    if (points < 0 || points > key.Question.Points) { errors.Add($"answerPoints[{questionId}]", $"Give 0 to {key.Question.Points} points."); continue; }
                    var answer = answers.FirstOrDefault(a => a.QuestionId == questionId);
                    if (answer is null) { answer = new SubmissionAnswer { SubmissionId = row.Id, QuestionId = questionId }; db.SubmissionAnswers.Add(answer); answers.Add(answer); }
                    answer.PointsAwarded = Math.Round(points, 2);
                }
                foreach (var waiting in answers.Where(a => a.PointsAwarded is null && a.MatchNote == MatchNote.Review && a.SpellingDecision is null))
                    errors.Add($"answerPoints[{waiting.QuestionId}]", "Accept or reject the spelling of this answer in the spelling review first.");
                foreach (var essay in keys.Where(k => k.Question.Type == QuestionType.Essay))
                {
                    var answer = answers.FirstOrDefault(a => a.QuestionId == essay.Question.Id);
                    if (answer?.PointsAwarded is null && input.AnswerPoints?.ContainsKey(essay.Question.Id) != true)
                    {
                        if (answer is null) { answer = new SubmissionAnswer { SubmissionId = row.Id, QuestionId = essay.Question.Id }; db.SubmissionAnswers.Add(answer); answers.Add(answer); }
                        if (string.IsNullOrWhiteSpace(answer.AnswerText)) answer.PointsAwarded = 0; // nothing written: nothing to grade
                        else errors.Add($"answerPoints[{essay.Question.Id}]", "Score this essay.");
                    }
                }
                total = answers.Sum(a => a.PointsAwarded ?? 0);
            }
            if (errors.Any) return errors.Result();

            var grade = await db.Grades.SingleOrDefaultAsync(g => g.SubmissionId == row.Id, ct);
            if (grade is null) { grade = new Grade { SubmissionId = row.Id }; db.Grades.Add(grade); }
            grade.Points = total;
            grade.Feedback = feedback;
            grade.GradedBy = user.Id;
            grade.GradedAt = time.GetUtcNow().UtcDateTime;
            row.Status = SubmissionStatus.Graded;
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "graded", GradingRules.IsNotHandedIn(row) ? NotHandedIn : cw.Type == CourseworkType.Exam ? "Exam attempt" : "Assignment", () => row.Id, ct, "grading");
            return TypedResults.Ok((await ToDtoAsync(db, cw, [row], ct))[0]);
        }).WithName("GradeSubmission");

        // A grade for one student who handed in nothing (D-036). It creates a "not handed in" record, or
        // corrects the one already there; it never replaces work the student handed in or started.
        work.MapPut("/students/{studentId}/grade", async Task<IResult> (string classId, long courseworkId, string studentId, MissingGradeInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForGradingAsync(classId, user, ct);
            if (denied is not null) return denied;
            var (cw, invalid) = await GradableAsync(db, classId, courseworkId, input.Points, time.GetUtcNow().UtcDateTime, ct);
            if (invalid is not null) return invalid;
            var student = await db.IsmsClassStudents.AsNoTracking().SingleOrDefaultAsync(s => s.ClassId == classId && s.StudentId == studentId && s.IsActive, ct);
            if (student is null) return ContentEndpoints.NotFound("Student");
            var errors = new Errors();
            var feedback = errors.Optional("feedback", input.Feedback, FeedbackMax);
            if (errors.Any) return errors.Result();

            var rows = await db.Submissions.Where(s => s.CourseworkId == cw!.Id && s.StudentId == studentId).ToListAsync(ct);
            if (rows.Any(s => s.Status == SubmissionStatus.InProgress)) return Conflict("This student has an attempt in progress. Grade it once they submit.");
            if (rows.Any(s => !GradingRules.IsNotHandedIn(s))) return Conflict("This student handed in work. Grade their submission instead.");
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var row = rows.FirstOrDefault();
            if (row is null)
            {
                row = NotHandedInRecord(cw!.Id, studentId);
                db.Submissions.Add(row);
                try { await db.SaveChangesAsync(ct); }
                catch (DbUpdateException) { return Conflict("The student handed in work at the same moment. Reload and try again."); }
            }
            var grade = await db.Grades.SingleOrDefaultAsync(g => g.SubmissionId == row.Id, ct);
            if (grade is null) { grade = new Grade { SubmissionId = row.Id }; db.Grades.Add(grade); }
            Fill(grade, Math.Round(input.Points!.Value, 2), feedback, user.Id, time.GetUtcNow().UtcDateTime);
            Audit(db, user, "grading", "graded", NotHandedIn, row.Id);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok((await ToDtoAsync(db, cw!, [row], ct))[0]);
        }).WithName("GradeStudentWithoutSubmission");

        // "Give N to everyone who didn't hand in": only students with no submission at all. Never
        // overwrites a grade and never touches work in progress or waiting for a grade.
        work.MapPost("/grade-missing", async Task<IResult> (string classId, long courseworkId, MissingGradeInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForGradingAsync(classId, user, ct);
            if (denied is not null) return denied;
            var (cw, invalid) = await GradableAsync(db, classId, courseworkId, input.Points, time.GetUtcNow().UtcDateTime, ct);
            if (invalid is not null) return invalid;
            var errors = new Errors();
            var feedback = errors.Optional("feedback", input.Feedback, FeedbackMax);
            if (errors.Any) return errors.Result();

            var started = db.Submissions.Where(s => s.CourseworkId == cw!.Id).Select(s => s.StudentId);
            var missing = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == classId && s.IsActive && !started.Contains(s.StudentId))
                .Select(s => s.StudentId).ToListAsync(ct);
            if (missing.Count == 0) return TypedResults.Ok(new MissingGradeResult(0));

            var now = time.GetUtcNow().UtcDateTime;
            var points = Math.Round(input.Points!.Value, 2);
            var rows = missing.Select(id => NotHandedInRecord(cw!.Id, id)).ToList();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            db.Submissions.AddRange(rows);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return Conflict("A student handed in work at the same moment. Reload and try again."); }
            foreach (var row in rows)
            {
                var grade = new Grade { SubmissionId = row.Id };
                Fill(grade, points, feedback, user.Id, now);
                db.Grades.Add(grade);
            }
            // One metadata-only row for the whole action: which coursework and how many students.
            db.AuditLog.Add(new AuditLogEntry
            {
                ActorId = user.Id, ActorRole = user.Role, Category = "grading", Action = "graded", Target = NotHandedIn,
                TargetId = cw!.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Summary = $"{NotHandedIn} graded for {rows.Count} students",
            });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(new MissingGradeResult(rows.Count));
        }).WithName("GradeEveryoneWithoutSubmission");

        return app;
    }

    private const string NotHandedIn = "Not handed in";
    private const string ClosedExam = "This exam is closed. Attempts can no longer be started, saved or submitted.";

    /// <summary>Graded, with no work and no submitted time (see <see cref="GradingRules.IsNotHandedIn"/>).</summary>
    private static Submission NotHandedInRecord(long courseworkId, string studentId) =>
        new() { CourseworkId = courseworkId, StudentId = studentId, AttemptNumber = 1, Status = SubmissionStatus.Graded };

    private static void Fill(Grade grade, decimal points, string? feedback, string by, DateTime at)
    {
        grade.Points = points;
        grade.Feedback = feedback;
        grade.GradedBy = by;
        grade.GradedAt = at;
    }

    /// <summary>Published or closed coursework of the class, and points within its maximum.</summary>
    private static async Task<(CourseworkRow? Coursework, IResult? Invalid)> GradableAsync(LmsDbContext db, string classId, long courseworkId, decimal? points, DateTime now, CancellationToken ct)
    {
        var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId, ct);
        if (cw is null) return (null, ContentEndpoints.NotFound("Coursework"));
        if (cw.Status is not (CourseworkStatus.Published or CourseworkStatus.Closed)) return (null, Conflict("Only published or closed coursework can be graded."));
        // A "not handed in" grade blocks the student from handing in, so it waits for the due date
        // unless the instructor has already closed the work.
        if (cw.Status == CourseworkStatus.Published && cw.DueAt is { } due && now <= due)
            return (null, Conflict("Students can still hand in until the due date. Grade those who didn't hand in after it passes."));
        if (points is not { } p || p < 0 || p > cw.MaxPoints)
        {
            var errors = new Errors();
            errors.Add("points", $"Give a score from 0 to {cw.MaxPoints}.");
            return (null, errors.Result());
        }
        return (cw, null);
    }

    // ----------------------------------------------------------------- helpers

    private static IResult Conflict(string title) => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title);

    private static void Audit(LmsDbContext db, CurrentUser user, string category, string action, string target, long id) =>
        db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = category, Action = action, Target = target, TargetId = id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = $"{target} {action}" });

    /// <summary>Coursework a student can see: published or closed, and available. Closed work refuses changes.</summary>
    private static Task<CourseworkRow?> VisibleAsync(LmsDbContext db, string classId, long id, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        return db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId
            && (c.Status == CourseworkStatus.Published || c.Status == CourseworkStatus.Closed) && (c.AvailableFrom == null || c.AvailableFrom <= now), ct);
    }

    private static async Task<(CourseworkRow? Coursework, Submission? Attempt)> OwnAttemptAsync(LmsDbContext db, string classId, long courseworkId, long id, CurrentUser user, CancellationToken ct, bool track = false)
    {
        var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId && c.Type == CourseworkType.Exam, ct);
        if (cw is null) return (null, null);
        var query = track ? db.Submissions : db.Submissions.AsNoTracking();
        var attempt = await query.SingleOrDefaultAsync(s => s.Id == id && s.CourseworkId == cw.Id && s.StudentId == user.Id, ct);
        return (cw, attempt);
    }

    private static async Task<(CourseworkRow? Coursework, Submission? Row)> SubmissionOfClassAsync(LmsDbContext db, string classId, long courseworkId, long id, CancellationToken ct, bool track = false)
    {
        var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId, ct);
        if (cw is null) return (null, null);
        var query = track ? db.Submissions : db.Submissions.AsNoTracking();
        return (cw, await query.SingleOrDefaultAsync(s => s.Id == id && s.CourseworkId == cw.Id, ct));
    }

    /// <summary>When saving stops: the time limit, or the due date when late work is not allowed.</summary>
    public static DateTime? Deadline(CourseworkRow cw, Submission attempt)
    {
        DateTime? deadline = cw.TimeLimitMinutes is { } minutes && attempt.StartedAt is { } started ? started.AddMinutes(minutes) : null;
        if (!cw.AllowLate && cw.DueAt is { } due && (deadline is null || due < deadline)) deadline = due;
        return deadline;
    }

    internal static async Task<List<ScoringKey>> KeysAsync(LmsDbContext db, long questionnaireId, CancellationToken ct)
    {
        var questions = await db.Questions.AsNoTracking().Where(q => q.QuestionnaireId == questionnaireId).OrderBy(q => q.SortOrder).ToListAsync(ct);
        var ids = questions.Select(q => q.Id).ToList();
        var options = await db.QuestionOptions.AsNoTracking().Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.SortOrder).ToListAsync(ct);
        var expected = await db.QuestionExpectedAnswers.AsNoTracking().Where(e => ids.Contains(e.QuestionId)).OrderBy(e => e.SortOrder).ToListAsync(ct);
        return questions.Select(q => new ScoringKey(q, options.Where(o => o.QuestionId == q.Id).ToList(), expected.Where(e => e.QuestionId == q.Id).ToList())).ToList();
    }

    private static async Task<IResult?> SaveAnswersAsync(LmsDbContext db, long submissionId, List<ScoringKey> keys, IReadOnlyList<AnswerInput> answers, CancellationToken ct)
    {
        var errors = new Errors();
        var existing = await db.SubmissionAnswers.Where(a => a.SubmissionId == submissionId).ToListAsync(ct);
        for (var i = 0; i < answers.Count; i++)
        {
            var input = answers[i];
            var at = $"answers[{i}]";
            var key = keys.FirstOrDefault(k => k.Question.Id == input.QuestionId);
            if (key is null) { errors.Add($"{at}.questionId", "This question is not part of the exam."); continue; }
            var row = existing.FirstOrDefault(a => a.QuestionId == key.Question.Id);
            if (row is null) { row = new SubmissionAnswer { SubmissionId = submissionId, QuestionId = key.Question.Id }; db.SubmissionAnswers.Add(row); existing.Add(row); }
            ApplyAnswer(errors, at, key, input, row);
        }
        if (errors.Any)
        {
            foreach (var entry in db.ChangeTracker.Entries<SubmissionAnswer>().Where(e => e.State is EntityState.Added or EntityState.Modified).ToList())
                if (entry.State == EntityState.Added) entry.State = EntityState.Detached; else entry.Reload();
            return errors.Result();
        }
        await db.SaveChangesAsync(ct);
        return null;
    }

    /// <summary>Copies one answer onto its row, checking it fits the question's type and the length limits.</summary>
    internal static void ApplyAnswer(Errors errors, string at, ScoringKey key, AnswerInput input, SubmissionAnswer row)
    {
        switch (key.Question.Type)
        {
            case QuestionType.MultipleChoice:
            case QuestionType.TrueFalse:
                if (input.OptionId is { } option && key.Options.All(o => o.Id != option)) errors.Add($"{at}.optionId", "Choose one of this question's options.");
                else row.SelectedOptionId = input.OptionId;
                break;
            case QuestionType.ModifiedTrueFalse:
                if (input.OptionId is { } choice && key.Options.All(o => o.Id != choice)) errors.Add($"{at}.optionId", "Choose True or False.");
                else row.SelectedOptionId = input.OptionId;
                row.AnswerText = errors.Optional($"{at}.text", input.Text, TypedMax);
                break;
            case QuestionType.Essay:
                row.AnswerText = errors.Optional($"{at}.text", input.Text, EssayMax);
                break;
            case QuestionType.Identification:
                row.AnswerText = errors.Optional($"{at}.text", input.Text, TypedMax);
                break;
            case QuestionType.Enumeration:
                var items = (input.Items ?? []).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!).ToList();
                if (items.Count > ItemsMax || items.Any(s => s.Trim().Length > TypedMax)) errors.Add($"{at}.items", $"Give at most {ItemsMax} items of at most {TypedMax} characters.");
                else row.AnswerText = Scoring.WriteItems(items);
                break;
            case QuestionType.Matching:
                var matches = (input.Matches ?? new Dictionary<long, string?>()).Where(m => !string.IsNullOrWhiteSpace(m.Value)).ToDictionary(m => m.Key, m => m.Value!);
                if (matches.Keys.Any(left => key.Options.All(o => o.Id != left)) || matches.Values.Any(v => v.Length > 1_000)) errors.Add($"{at}.matches", "Match only this question's items.");
                else row.AnswerText = Scoring.WriteMatches(matches);
                break;
        }
    }

    internal static async Task<List<SubmissionDto>> ToDtoAsync(LmsDbContext db, CourseworkRow cw, IReadOnlyList<Submission> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var grades = await db.Grades.AsNoTracking().Where(g => ids.Contains(g.SubmissionId)).ToDictionaryAsync(g => g.SubmissionId, ct);
        var students = rows.Select(r => r.StudentId).Distinct().ToList();
        var names = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == cw.ClassId && students.Contains(s.StudentId))
            .ToDictionaryAsync(s => s.StudentId, s => $"{s.FirstName} {s.LastName}".Trim(), ct);
        return rows.Select(r =>
        {
            grades.TryGetValue(r.Id, out var g);
            return new SubmissionDto(r.Id, r.StudentId, names.GetValueOrDefault(r.StudentId), r.AttemptNumber, r.Status, r.StartedAt, r.SubmittedAt,
                cw.DueAt is { } due && r.SubmittedAt > due, r.Text, r.FileName, g?.Points, cw.MaxPoints, g?.Feedback, g?.GradedAt, GradingRules.IsNotHandedIn(r));
        }).ToList();
    }
}
