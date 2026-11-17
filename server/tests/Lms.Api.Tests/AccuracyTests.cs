using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Contract §6: spelling review, item analysis, preview, and fixing the key with a regrade.</summary>
public sealed class AccuracyTests : AssessmentTestBase
{
    [Fact]
    public async Task An_anonymized_attempt_leaves_the_spelling_review_list()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { spellingMode = "review" });
        var waiting = await TakeAsync(StudentA, exam, a => Answers(a, identification: "Babage"));
        var attemptId = waiting.GetProperty("id").GetInt64();
        Assert.Equal(1, (await Json(await Instructor.GetAsync($"{Base}/{exam}/spelling-review"))).GetArrayLength());

        await Factory.WithDbAsync(async db =>
        {
            var attempt = await db.Submissions.SingleAsync(s => s.Id == attemptId);
            attempt.AnonymizedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return 0;
        });
        Assert.Equal(0, (await Json(await Instructor.GetAsync($"{Base}/{exam}/spelling-review"))).GetArrayLength());
    }

    [Fact]
    public async Task The_instructor_decides_near_misses_and_the_attempt_is_graded()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { spellingMode = "review" });
        var waiting = await TakeAsync(StudentA, exam, a => Answers(a, identification: "Babage", colors: ["red", "gren", "blue"]));
        await TakeAsync(StudentB, exam, a => Answers(a));
        var attemptId = waiting.GetProperty("id").GetInt64();

        var list = await Json(await Instructor.GetAsync($"{Base}/{exam}/spelling-review"));
        Assert.Equal(2, list.GetArrayLength());
        var row = list[0];
        Assert.Equal(Lia, row.GetProperty("studentId").GetString());
        Assert.Equal("Lia Abad", row.GetProperty("studentName").GetString());
        Assert.Equal("Babage", row.GetProperty("given").GetString());
        Assert.Equal(["Charles Babbage", "Babbage"], row.GetProperty("accepted").EnumerateArray().Select(a => a.GetString()!).ToArray());
        Assert.Equal("review", row.GetProperty("matchNote").GetString());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("decision").ValueKind);
        Assert.Equal(4, row.GetProperty("number").GetInt32());
        Assert.Equal("red; gren; blue", list[1].GetProperty("given").GetString());

        // Students and other instructors cannot see the list.
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.GetAsync($"{Base}/{exam}/spelling-review")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, CurrentUser.Instructor).GetAsync($"{Base}/{exam}/spelling-review")).StatusCode);

        var questionId = row.GetProperty("questionId").GetInt64();
        var url = $"{Base}/{exam}/spelling-review/{attemptId}/{questionId}";
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PutAsJsonAsync(url, new { decision = "maybe" })).StatusCode);
        var accepted = await Json(await Instructor.PutAsJsonAsync(url, new { decision = "accepted" }));
        Assert.Equal("accepted", accepted.GetProperty("decision").GetString());
        Assert.Equal(2m, accepted.GetProperty("pointsAwarded").GetDecimal());
        var still = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{attemptId}"));
        Assert.Equal("submitted", still.GetProperty("status").GetString());   // the enumeration still waits

        var enumeration = list[1].GetProperty("questionId").GetInt64();
        var rejected = await Json(await Instructor.PutAsJsonAsync($"{Base}/{exam}/spelling-review/{attemptId}/{enumeration}", new { decision = "rejected" }));
        Assert.Equal(2m, rejected.GetProperty("pointsAwarded").GetDecimal());   // 2 of 3 colors
        var graded = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{attemptId}"));
        Assert.Equal("graded", graded.GetProperty("status").GetString());
        Assert.Equal(10m, graded.GetProperty("score").GetDecimal());
        Assert.Equal(2, await Factory.WithDbAsync(db => db.AuditLog.CountAsync(a => a.Action == "spelling_decided")));

        // An answer without a spelling note cannot be decided.
        var mc = (await Json(await Instructor.GetAsync($"/api/questionnaires/{(await Json(await Instructor.GetAsync($"{Base}/{exam}"))).GetProperty("questionnaireId").GetInt64()}")))
            .GetProperty("questions")[0].GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.PutAsJsonAsync($"{Base}/{exam}/spelling-review/{attemptId}/{mc}", new { decision = "accepted" })).StatusCode);

        // The instructor's submission detail shows the note and the decision.
        var detail = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{attemptId}"));
        var answer = detail.GetProperty("answers").EnumerateArray().Single(a => a.GetProperty("questionId").GetInt64() == questionId);
        Assert.Equal("review", answer.GetProperty("matchNote").GetString());
        Assert.Equal("accepted", answer.GetProperty("decision").GetString());
        Assert.Equal("CPU", detail.GetProperty("questions")[2].GetProperty("underlined").GetString());
    }

    [Fact]
    public async Task A_rescore_keeps_the_instructors_point_overrides()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { spellingMode = "review" });
        var waiting = await TakeAsync(StudentA, exam, a => Answers(a, identification: "Babage"));
        var attemptId = waiting.GetProperty("id").GetInt64();
        long Q(string type) => QuestionOfType(waiting, type).GetProperty("id").GetInt64();

        // Partial points settle the near miss; half a point overrides a right multiple-choice answer.
        var graded = await Json(await Instructor.PutAsJsonAsync($"{Base}/{exam}/submissions/{attemptId}/grade", new
        {
            answerPoints = new Dictionary<string, decimal> { [Q("identification").ToString()] = 1m, [Q("multiple_choice").ToString()] = 0.5m },
        }));
        Assert.Equal(9.5m, graded.GetProperty("score").GetDecimal());

        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{exam}", new { spellingMode = "typos" }));
        var after = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{attemptId}"));
        Assert.Equal(9.5m, after.GetProperty("score").GetDecimal());

        var detail = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{attemptId}"));
        var answer = detail.GetProperty("answers").EnumerateArray().Single(a => a.GetProperty("questionId").GetInt64() == Q("identification"));
        Assert.Equal(1m, answer.GetProperty("pointsAwarded").GetDecimal());
        Assert.Equal(1m, answer.GetProperty("manualPoints").GetDecimal());
    }

    [Fact]
    public async Task Item_analysis_flags_a_key_that_most_students_disagree_with()
    {
        await SeedAsync();
        var students = new[] { "STU-3", "STU-4", "STU-5" };
        await Factory.WithDbAsync(async db =>
        {
            foreach (var s in students) db.IsmsClassStudents.Add(new IsmsClassStudent { ClassId = "class-a", StudentId = s, EnrollmentId = $"E-{s}", FirstName = s, LastName = "Test", IsActive = true });
            return await db.SaveChangesAsync();
        });
        var (exam, _) = await ExamAsync();
        // Lia and the three extra students choose "Mouse"; Max chooses the key.
        foreach (var s in students.Append(Lia))
            await TakeAsync(As(s, CurrentUser.Student), exam, a =>
            {
                var answers = Answers(a);
                var mc = QuestionOfType(a, "multiple_choice");
                answers[0] = new { questionId = mc.GetProperty("id").GetInt64(), optionId = OptionId(mc, "Mouse") };
                return answers;
            });
        await TakeAsync(StudentB, exam, a => Answers(a, identification: "pascal"));

        var rows = (await Json(await Instructor.GetAsync($"{Base}/{exam}/item-analysis"))).EnumerateArray().ToList();
        var mcRow = rows[0];
        Assert.Equal(1, mcRow.GetProperty("number").GetInt32());
        Assert.Equal(5, mcRow.GetProperty("answered").GetInt32());
        Assert.Equal(0.2m, mcRow.GetProperty("correctRate").GetDecimal());
        Assert.Equal(0.2m, mcRow.GetProperty("averagePoints").GetDecimal());
        Assert.Equal("check_key", mcRow.GetProperty("flag").GetString());
        var top = mcRow.GetProperty("topAnswers")[0];
        Assert.Equal("Mouse", top.GetProperty("answer").GetString());
        Assert.Equal(4, top.GetProperty("count").GetInt32());
        Assert.False(top.GetProperty("isKey").GetBoolean());

        var identification = rows.Single(r => r.GetProperty("type").GetString() == "identification");
        Assert.Equal(0.8m, identification.GetProperty("correctRate").GetDecimal());
        Assert.Equal(JsonValueKind.Null, identification.GetProperty("flag").ValueKind);
        Assert.Equal("babbage", identification.GetProperty("topAnswers")[0].GetProperty("answer").GetString());
        Assert.True(identification.GetProperty("topAnswers")[0].GetProperty("isKey").GetBoolean());

        var colors = rows.Single(r => r.GetProperty("type").GetString() == "enumeration");
        Assert.Equal(3, colors.GetProperty("topAnswers").GetArrayLength());
        Assert.Equal(0, rows.Single(r => r.GetProperty("type").GetString() == "matching").GetProperty("topAnswers").GetArrayLength());
    }

    [Fact]
    public void Item_analysis_needs_three_answers_before_flagging()
    {
        var key = new ScoringKey(new Question { Id = 1, Type = QuestionType.TrueFalse, Points = 1, SortOrder = 1 },
            [new QuestionOption { Id = 1, Text = "True", IsCorrect = true }, new QuestionOption { Id = 2, Text = "False" }], []);
        var two = new[] { new SubmissionAnswer { QuestionId = 1, SelectedOptionId = 2, PointsAwarded = 0 }, new SubmissionAnswer { QuestionId = 1, SelectedOptionId = 2, PointsAwarded = 0 } };
        Assert.Null(ItemAnalysis.Compute([key], two, 2)[0].Flag);
        var three = two.Append(new SubmissionAnswer { QuestionId = 1, SelectedOptionId = 1, PointsAwarded = 1 }).ToList();
        var row = ItemAnalysis.Compute([key], three, 3)[0];
        Assert.Equal(ItemAnalysis.CheckKey, row.Flag);
        Assert.Equal(0.3333m, row.CorrectRate);
        Assert.Empty(ItemAnalysis.Compute([], [], 0));
    }

    [Fact]
    public async Task Preview_and_preview_scoring_save_nothing()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { spellingMode = "typos", shuffleQuestions = true });
        var before = await Factory.WithDbAsync(async db => (await db.Submissions.CountAsync(), await db.SubmissionAnswers.CountAsync(), await db.AuditLog.CountAsync()));

        var preview = await Json(await Instructor.GetAsync($"{Base}/{exam}/preview"));
        Assert.Equal(6, preview.GetProperty("questions").GetArrayLength());
        Assert.Equal(2, preview.GetProperty("sections").GetArrayLength());
        foreach (var q in preview.GetProperty("questions").EnumerateArray()) Assert.Equal(JsonValueKind.Null, q.GetProperty("key").ValueKind);
        Assert.DoesNotContain("Babbage", preview.GetRawText());

        var scored = await Json(await Instructor.PostAsJsonAsync($"{Base}/{exam}/preview/score", new { answers = Answers(preview, identification: "Babage") }));
        Assert.Equal(11m, scored.GetProperty("score").GetDecimal());
        Assert.Equal(11m, scored.GetProperty("maxPoints").GetDecimal());
        Assert.Contains(scored.GetProperty("answers").EnumerateArray(), a => a.GetProperty("matchNote").GetString() == "typo");
        Assert.Equal(6, scored.GetProperty("keys").GetArrayLength());
        Assert.Contains("Babbage", scored.GetRawText());

        var bad = await Instructor.PostAsJsonAsync($"{Base}/{exam}/preview/score", new { answers = new[] { new { questionId = 999999 } } });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.GetAsync($"{Base}/{exam}/preview")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PostAsJsonAsync($"{Base}/{exam}/preview/score", new { answers = Array.Empty<object>() })).StatusCode);

        var after = await Factory.WithDbAsync(async db => (await db.Submissions.CountAsync(), await db.SubmissionAnswers.CountAsync(), await db.AuditLog.CountAsync()));
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task Fixing_the_key_of_a_locked_set_regrades_every_attempt()
    {
        await SeedAsync();
        var (exam, set) = await ExamAsync();
        // Lia answers "Mouse" for the multiple-choice question and "Pascal" for identification; Max answers everything as keyed.
        var lia = await TakeAsync(StudentA, exam, a =>
        {
            var answers = Answers(a, identification: "Pascal");
            var mc = QuestionOfType(a, "multiple_choice");
            answers[0] = new { questionId = mc.GetProperty("id").GetInt64(), optionId = OptionId(mc, "Mouse") };
            return answers;
        });
        var max = await TakeAsync(StudentB, exam, a => Answers(a));
        Assert.Equal(8m, lia.GetProperty("score").GetDecimal());
        Assert.Equal(11m, max.GetProperty("score").GetDecimal());

        var loaded = await Json(await Instructor.GetAsync($"/api/questionnaires/{set}"));
        Assert.True(loaded.GetProperty("locked").GetBoolean());
        var q = loaded.GetProperty("questions").EnumerateArray().ToList();
        long Id(int i) => q[i].GetProperty("id").GetInt64();
        var mouse = q[0].GetProperty("options").EnumerateArray().Single(o => o.GetProperty("text").GetString() == "Mouse").GetProperty("id").GetInt64();
        // A locked set still refuses a normal edit.
        Assert.Equal(HttpStatusCode.Conflict, (await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/questions", EveryType())).StatusCode);

        var bad = await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new
        {
            questions = new object[]
            {
                new { questionId = 999999, correctOptionId = 1 },
                new { questionId = Id(0), correctOptionId = 999999 },
                new { questionId = Id(5), pairs = new[] { new { left = "Mouse", right = "input" }, new { left = "Monitor", right = "output" } } },
                new { questionId = Id(3), correctAnswer = true },
            },
        });
        var errors = (await Problem(bad)).GetProperty("errors");
        foreach (var field in new[] { "questions[0].questionId", "questions[1].correctOptionId", "questions[2].pairs", "questions[3].correctAnswer" })
            Assert.True(errors.TryGetProperty(field, out _), field);

        var fixedKey = await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new
        {
            questions = new object[]
            {
                new { questionId = Id(0), correctOptionId = mouse },
                new { questionId = Id(3), expectedAnswers = new[] { "Charles Babbage", "Babbage", "Pascal" } },
                new { questionId = Id(5), pairs = new[] { new { left = "Keyboard", right = "input device" }, new { left = "Monitor", right = "output" } } },
            },
        }));
        Assert.Equal(2, fixedKey.GetProperty("regraded").GetInt32());
        Assert.Equal(2, fixedKey.GetProperty("changed").GetInt32());
        var after = fixedKey.GetProperty("questionnaire").GetProperty("questions").EnumerateArray().ToList();
        Assert.True(after[0].GetProperty("options").EnumerateArray().Single(o => o.GetProperty("id").GetInt64() == mouse).GetProperty("isCorrect").GetBoolean());
        Assert.Equal("Which part runs programs?", after[0].GetProperty("prompt").GetString());   // prompts never change
        Assert.Equal(new PairText("Keyboard", "input device"), new PairText(after[5].GetProperty("pairs")[0].GetProperty("left").GetString()!, after[5].GetProperty("pairs")[0].GetProperty("right").GetString()!));

        var liaNow = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{lia.GetProperty("id").GetInt64()}"));
        Assert.Equal(10m, liaNow.GetProperty("score").GetDecimal());   // MC now right, Pascal accepted, matching 1 of 2
        Assert.NotEqual(JsonValueKind.Null, liaNow.GetProperty("scoreUpdatedAt").ValueKind);
        var maxNow = await Json(await StudentB.GetAsync($"{Base}/{exam}/attempts/{max.GetProperty("id").GetInt64()}"));
        Assert.Equal(9m, maxNow.GetProperty("score").GetDecimal());   // MC now wrong, matching 1 of 2
        var audit = await Factory.WithDbAsync(db => db.AuditLog.Where(a => a.Action == "key_fixed").ToListAsync());
        Assert.Equal("Answer key", Assert.Single(audit).Target);
        Assert.DoesNotContain("Pascal", audit[0].Summary);
    }

    [Fact]
    public async Task Anonymized_attempts_are_never_rescored_and_leave_item_analysis_top_answers()
    {
        await SeedAsync();
        var (exam, set) = await ExamAsync();
        var done = await TakeAsync(StudentA, exam, a => Answers(a));
        Assert.Equal(11m, done.GetProperty("score").GetDecimal());

        // class-a's term (1, 1) ends and is more than 2 terms behind the current one, so retention anonymizes it.
        await Factory.WithDbAsync(async db =>
        {
            (await db.IsmsClasses.SingleAsync(c => c.Id == "class-a")).IsActive = false;
            db.IsmsClasses.AddRange(
                new IsmsClass { Id = "class-b", ScheduleId = "SCH-2", SubjectName = "Computing 2", InstructorId = Teacher, InstructorName = "Ana Reyes", SchoolYearId = 2, SemesterId = 1 },
                new IsmsClass { Id = "class-c", ScheduleId = "SCH-3", SubjectName = "Computing 3", InstructorId = Teacher, InstructorName = "Ana Reyes", SchoolYearId = 2, SemesterId = 2 },
                new IsmsClass { Id = "class-d", ScheduleId = "SCH-4", SubjectName = "Computing 4", InstructorId = Teacher, InstructorName = "Ana Reyes", SchoolYearId = 3, SemesterId = 1, IsActive = true });
            return await db.SaveChangesAsync();
        });
        await Factory.WithServiceAsync<AttemptRetention, RetentionResult>(r => r.RunAsync(CancellationToken.None));

        var q = (await Json(await Instructor.GetAsync($"/api/questionnaires/{set}"))).GetProperty("questions").EnumerateArray().ToList();
        var fixedKey = await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new
        {
            questions = new object[] { new { questionId = q[3].GetProperty("id").GetInt64(), expectedAnswers = new[] { "Charles Babbage", "Babbage", "Pascal" } } },
        }));
        Assert.Equal(0, fixedKey.GetProperty("regraded").GetInt32());
        var detail = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{done.GetProperty("id").GetInt64()}"));
        Assert.Equal(11m, detail.GetProperty("submission").GetProperty("score").GetDecimal());

        // Typed answers are gone, so the modified true or false question lists none (not a bare "False").
        var rows = (await Json(await Instructor.GetAsync($"{Base}/{exam}/item-analysis"))).EnumerateArray().ToList();
        Assert.Equal(0, rows.Single(r => r.GetProperty("type").GetString() == "modified_true_false").GetProperty("topAnswers").GetArrayLength());
        Assert.Equal("CPU", rows[0].GetProperty("topAnswers")[0].GetProperty("answer").GetString());   // choices keep theirs
    }

    [Fact]
    public async Task Only_the_owner_can_fix_a_key_and_essays_have_none()
    {
        await SeedAsync();
        var set = await SetAsync(EveryType(withEssay: true));
        var q = (await Json(await Instructor.GetAsync($"/api/questionnaires/{set}"))).GetProperty("questions").EnumerateArray().ToList();
        var body = new { questions = new object[] { new { questionId = q[1].GetProperty("id").GetInt64(), correctAnswer = false } } };
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, CurrentUser.Instructor).PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", body)).StatusCode);
        var essay = await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new { questions = new object[] { new { questionId = q[6].GetProperty("id").GetInt64(), expectedAnswers = new[] { "x" } } } });
        Assert.Equal(HttpStatusCode.BadRequest, essay.StatusCode);

        var tf = await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", body));
        Assert.Equal(0, tf.GetProperty("regraded").GetInt32());
        Assert.True(tf.GetProperty("questionnaire").GetProperty("questions")[1].GetProperty("options")[1].GetProperty("isCorrect").GetBoolean());

        // A modified true or false question made true keeps its corrections; made false again it needs them.
        var mtf = q[2].GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new { questions = new object[] { new { questionId = mtf, correctAnswer = true } } }));
        var empty = await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new { questions = new object[] { new { questionId = mtf, correctAnswer = false, expectedAnswers = Array.Empty<string>() } } });
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
    }

    private sealed record PairText(string Left, string Right);
}
