using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Contract §3–§4: exam settings, what students see, order, spelling, and waiting answers.</summary>
public sealed class AttemptTests : AssessmentTestBase
{
    private static void NoKeys(JsonElement attempt)
    {
        foreach (var q in attempt.GetProperty("questions").EnumerateArray())
            Assert.Equal(JsonValueKind.Null, q.GetProperty("key").ValueKind);
    }

    [Fact]
    public async Task Exam_settings_default_to_todays_behavior_and_can_be_changed()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync();
        var dto = await Json(await Instructor.GetAsync($"{Base}/{exam}"));
        Assert.Equal("results", dto.GetProperty("answerReview").GetString());
        Assert.Equal("strict", dto.GetProperty("spellingMode").GetString());
        Assert.False(dto.GetProperty("shuffleQuestions").GetBoolean());
        Assert.False(dto.GetProperty("shuffleChoices").GetBoolean());

        var bad = await Instructor.PatchAsJsonAsync($"{Base}/{exam}", new { answerReview = "always", spellingMode = "loose" });
        var errors = (await Problem(bad)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("answerReview", out _));
        Assert.True(errors.TryGetProperty("spellingMode", out _));

        var changed = await Json(await Instructor.PatchAsJsonAsync($"{Base}/{exam}", new { answerReview = "answers_after_submit", spellingMode = "typos", shuffleQuestions = true, shuffleChoices = true }));
        Assert.Equal("answers_after_submit", changed.GetProperty("answerReview").GetString());
        // Students get the settings too, for the notices.
        var seen = await Json(await StudentA.GetAsync($"{Base}/{exam}"));
        Assert.Equal("typos", seen.GetProperty("spellingMode").GetString());
        Assert.True(seen.GetProperty("shuffleQuestions").GetBoolean());
    }

    [Fact]
    public async Task An_exam_whose_set_has_an_incomplete_question_cannot_be_published()
    {
        await SeedAsync();
        var set = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Draft" }))).GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/questions", new
        {
            allowIncomplete = true,
            questions = new object[] { new { type = "essay", prompt = "Fine", points = 2 }, new { type = "identification", prompt = "No answers yet", points = 1 } },
        }));

        var published = await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = ModuleId, title = "Quiz", questionnaireId = set, status = "published" });
        Assert.Equal(HttpStatusCode.BadRequest, published.StatusCode);
        Assert.Equal("Finish the questions marked \"needs attention\" before publishing.",
            (await Problem(published)).GetProperty("errors").GetProperty("questionnaireId")[0].GetString());

        // A draft may use it; publishing later is refused the same way.
        var draft = await Json(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = ModuleId, title = "Quiz", questionnaireId = set, status = "draft" }));
        var id = draft.GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { status = "published" })).StatusCode);

        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/questions", new
        {
            questions = new object[] { new { type = "essay", prompt = "Fine", points = 2 }, new { type = "identification", prompt = "Capital of Japan?", points = 1, expectedAnswers = new[] { "Tokyo" } } },
        }));
        Assert.Equal("published", (await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { status = "published" }))).GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_set_used_by_a_published_exam_refuses_incomplete_questions_and_an_incomplete_set_cannot_be_started()
    {
        await SeedAsync();
        var (exam, set) = await ExamAsync();
        var saved = await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/questions", new
        {
            allowIncomplete = true,
            questions = new object[] { new { type = "essay", prompt = "Fine", points = 2 }, new { type = "identification", prompt = "No answers yet", points = 1 } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, saved.StatusCode);
        var errors = (await Problem(saved)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("questions[1].expectedAnswers", out _));
        Assert.Equal("This set is used by a published exam, so every question must be complete.", errors.GetProperty("questions")[0].GetString());
        Assert.False(await Factory.WithDbAsync(db => db.Questions.AnyAsync(q => q.QuestionnaireId == set && q.Incomplete)));

        // A set that is incomplete anyway (saved before this rule) cannot be started.
        await Factory.WithDbAsync(db => db.Questions.Where(q => q.QuestionnaireId == set && q.Type == QuestionType.Identification)
            .ExecuteUpdateAsync(s => s.SetProperty(q => q.Incomplete, true)));
        var start = await StudentA.PostAsync($"{Base}/{exam}/attempts", null);
        Assert.Equal(HttpStatusCode.Conflict, start.StatusCode);
        Assert.Contains("unfinished", (await Problem(start)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Keys_never_reach_a_student_before_submitting_and_follow_the_answer_review_after()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { answerReview = "answers_after_submit" });
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var raw = await (await StudentA.GetAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("Babbage", raw);
        Assert.DoesNotContain("storage", raw);
        Assert.DoesNotContain("isCorrect", raw);
        NoKeys(attempt);

        // Sections and the underlined phrase reach the student.
        Assert.Equal(["Test I. Choose", "Test II. Write"], attempt.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("title").GetString()!).ToArray());
        Assert.Equal("CPU", QuestionOfType(attempt, "modified_true_false").GetProperty("underlined").GetString());
        Assert.Equal("answers_after_submit", attempt.GetProperty("answerReview").GetString());

        var id = attempt.GetProperty("id").GetInt64();
        var done = await Json(await StudentA.PostAsJsonAsync($"{Base}/{exam}/attempts/{id}/submit", new { answers = Answers(attempt) }));
        Assert.Equal("graded", done.GetProperty("status").GetString());
        Assert.Equal(11m, done.GetProperty("score").GetDecimal());
        var mtf = QuestionOfType(done, "modified_true_false").GetProperty("key");
        Assert.False(mtf.GetProperty("correctAnswer").GetBoolean());
        Assert.Equal(["storage", "hard disk"], mtf.GetProperty("answers").EnumerateArray().Select(a => a.GetString()!).ToArray());
        Assert.False(mtf.TryGetProperty("pairs", out _));                 // only the fields the type uses
        Assert.Equal(2, QuestionOfType(done, "matching").GetProperty("key").GetProperty("pairs").GetArrayLength());
        Assert.Single(QuestionOfType(done, "multiple_choice").GetProperty("key").GetProperty("optionIds").EnumerateArray());
        Assert.All(done.GetProperty("answers").EnumerateArray(), a => Assert.NotEqual(JsonValueKind.Null, a.GetProperty("pointsAwarded").ValueKind));
        var identification = done.GetProperty("answers").EnumerateArray().Single(a => a.GetProperty("text").GetString() == "Babbage");
        Assert.Equal("exact", identification.GetProperty("matchNote").GetString());
    }

    [Fact]
    public async Task Score_only_hides_points_and_notes()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { answerReview = "score_only" });
        var done = await TakeAsync(StudentA, exam, a => Answers(a));
        Assert.Equal(11m, done.GetProperty("score").GetDecimal());
        NoKeys(done);
        Assert.All(done.GetProperty("answers").EnumerateArray(), a =>
        {
            Assert.Equal(JsonValueKind.Null, a.GetProperty("pointsAwarded").ValueKind);
            Assert.Equal(JsonValueKind.Null, a.GetProperty("matchNote").ValueKind);
        });
    }

    [Fact]
    public async Task Results_shows_points_but_no_keys_and_answers_after_due_waits_for_the_due_date()
    {
        await SeedAsync();
        var (results, _) = await ExamAsync();
        var done = await TakeAsync(StudentA, results, a => Answers(a));
        NoKeys(done);
        Assert.All(done.GetProperty("answers").EnumerateArray(), a => Assert.NotEqual(JsonValueKind.Null, a.GetProperty("pointsAwarded").ValueKind));

        var (afterDue, _) = await ExamAsync(new { answerReview = "answers_after_due", dueAt = Factory.Time.Now.AddDays(1), allowLate = true });
        var mine = await TakeAsync(StudentA, afterDue, a => Answers(a));
        NoKeys(mine);
        Factory.Time.Now = Factory.Time.Now.AddDays(2);
        var later = await Json(await StudentA.GetAsync($"{Base}/{afterDue}/attempts/{mine.GetProperty("id").GetInt64()}"));
        Assert.NotEqual(JsonValueKind.Null, QuestionOfType(later, "identification").GetProperty("key").ValueKind);
    }

    [Fact]
    public async Task Typos_mode_gives_full_points_with_a_note_and_review_mode_waits_for_the_instructor()
    {
        await SeedAsync();
        var (typos, _) = await ExamAsync(new { spellingMode = "typos" });
        var done = await TakeAsync(StudentA, typos, a => Answers(a, identification: "Babage"));
        Assert.Equal("graded", done.GetProperty("status").GetString());
        Assert.Equal(11m, done.GetProperty("score").GetDecimal());
        Assert.Contains(done.GetProperty("answers").EnumerateArray(), a => a.GetProperty("matchNote").GetString() == "typo");

        var (review, _) = await ExamAsync(new { spellingMode = "review" });
        var waiting = await TakeAsync(StudentA, review, a => Answers(a, identification: "Babage"));
        Assert.Equal("submitted", waiting.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, waiting.GetProperty("score").ValueKind);
        var pending = waiting.GetProperty("answers").EnumerateArray().Single(a => a.GetProperty("matchNote").GetString() == "review");
        Assert.Equal(JsonValueKind.Null, pending.GetProperty("pointsAwarded").ValueKind);

        // The grade action refuses to skip the spelling decision.
        var grade = await Instructor.PutAsJsonAsync($"{Base}/{review}/submissions/{waiting.GetProperty("id").GetInt64()}/grade", new { feedback = "ok" });
        Assert.Equal(HttpStatusCode.BadRequest, grade.StatusCode);
    }

    [Fact]
    public async Task Shuffled_order_is_stable_per_attempt_and_keeps_sections_together()
    {
        await SeedAsync();
        var many = new
        {
            sections = new object[] { new { title = "A" }, new { title = "B" } },
            questions = Enumerable.Range(1, 12).Select(i => (object)new
            {
                type = "multiple_choice", prompt = $"Question {i}", points = 1, section = i <= 6 ? 0 : 1,
                options = Enumerable.Range(1, 6).Select(k => new { text = $"Choice {k}", isCorrect = k == 1 }).ToArray(),
            }).ToArray(),
        };
        var (exam, _) = await ExamAsync(new { shuffleQuestions = true, shuffleChoices = true }, body: many);
        var first = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var again = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{first.GetProperty("id").GetInt64()}"));
        static string Order(JsonElement a) => string.Join("|", a.GetProperty("questions").EnumerateArray().Select(q =>
            q.GetProperty("prompt").GetString() + ":" + string.Join(",", q.GetProperty("options").EnumerateArray().Select(o => o.GetProperty("text").GetString()))));
        Assert.Equal(Order(first), Order(again));

        var prompts = first.GetProperty("questions").EnumerateArray().Select(q => int.Parse(q.GetProperty("prompt").GetString()!["Question ".Length..])).ToList();
        Assert.All(prompts.Take(6), n => Assert.InRange(n, 1, 6));
        Assert.All(prompts.Skip(6), n => Assert.InRange(n, 7, 12));
        Assert.NotEqual(Enumerable.Range(1, 12).ToList(), prompts);

        var other = await Json(await StudentB.PostAsync($"{Base}/{exam}/attempts", null));
        Assert.NotEqual(Order(first), Order(other));
    }

    [Fact]
    public async Task Typed_answers_have_length_limits()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(withEssay: true);
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var id = attempt.GetProperty("id").GetInt64();
        long Q(string type) => QuestionOfType(attempt, type).GetProperty("id").GetInt64();
        var tooLong = await StudentA.PutAsJsonAsync($"{Base}/{exam}/attempts/{id}/answers", new
        {
            answers = new object[]
            {
                new { questionId = Q("identification"), text = new string('a', 201) },
                new { questionId = Q("enumeration"), items = Enumerable.Range(0, 21).Select(i => $"item {i}").ToArray() },
                new { questionId = Q("essay"), text = new string('e', 10_001) },
                new { questionId = Q("modified_true_false"), text = new string('m', 201) },
            },
        });
        var errors = (await Problem(tooLong)).GetProperty("errors");
        foreach (var field in new[] { "answers[0].text", "answers[1].items", "answers[2].text", "answers[3].text" })
            Assert.True(errors.TryGetProperty(field, out _), field);
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{exam}/attempts/{id}/answers", new { answers = new object[] { new { questionId = Q("essay"), text = new string('e', 10_000) } } }));
    }

    [Fact]
    public async Task Changing_the_spelling_mode_after_submissions_rescores_them()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync();
        var done = await TakeAsync(StudentA, exam, a => Answers(a, identification: "Babage"));
        Assert.Equal(9m, done.GetProperty("score").GetDecimal());
        Assert.Equal(JsonValueKind.Null, done.GetProperty("scoreUpdatedAt").ValueKind);

        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{exam}", new { spellingMode = "typos" }));
        var after = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{done.GetProperty("id").GetInt64()}"));
        Assert.Equal(11m, after.GetProperty("score").GetDecimal());
        Assert.NotEqual(JsonValueKind.Null, after.GetProperty("scoreUpdatedAt").ValueKind);
        Assert.True(await Factory.WithDbAsync(db => db.AuditLog.AnyAsync(a => a.Action == "regraded")));

        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{exam}", new { spellingMode = "review" }));
        var waiting = await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{done.GetProperty("id").GetInt64()}"));
        Assert.Equal("submitted", waiting.GetProperty("status").GetString());
    }
}
