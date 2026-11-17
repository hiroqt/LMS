using System.Net.Http.Json;
using System.Text.Json;

namespace Lms.Api.Tests;

/// <summary>Additions requested by the grading client (PR #48) and the student client (PR #49).</summary>
public sealed class GradingContractTests : AssessmentTestBase
{
    [Fact]
    public async Task Submission_detail_answers_carry_typed_text_items_and_matches()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync();
        var done = await TakeAsync(StudentA, exam, a => Answers(a, identification: "Babbage", correction: "hard disk"));
        var detail = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{done.GetProperty("id").GetInt64()}"));
        var questions = detail.GetProperty("questions").EnumerateArray().ToList();
        JsonElement AnswerTo(string type) => detail.GetProperty("answers").EnumerateArray()
            .Single(a => a.GetProperty("questionId").GetInt64() == questions.Single(q => q.GetProperty("type").GetString() == type).GetProperty("id").GetInt64());

        Assert.Equal("Babbage", AnswerTo("identification").GetProperty("text").GetString());
        Assert.Equal("hard disk", AnswerTo("modified_true_false").GetProperty("text").GetString());
        Assert.NotEqual(JsonValueKind.Null, AnswerTo("modified_true_false").GetProperty("optionId").ValueKind);
        Assert.Equal(3, AnswerTo("enumeration").GetProperty("items").GetArrayLength());
        Assert.Equal(2, AnswerTo("matching").GetProperty("matches").EnumerateObject().Count());
    }

    [Fact]
    public async Task Matching_pairs_carry_the_left_id_students_match_with()
    {
        await SeedAsync();
        var (exam, set) = await ExamAsync();
        var pairs = (await Json(await Instructor.GetAsync($"/api/questionnaires/{set}"))).GetProperty("questions")[5].GetProperty("pairs").EnumerateArray().ToList();
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var lefts = QuestionOfType(attempt, "matching").GetProperty("lefts").EnumerateArray()
            .ToDictionary(l => l.GetProperty("text").GetString()!, l => l.GetProperty("id").GetInt64());
        Assert.All(pairs, p => Assert.Equal(lefts[p.GetProperty("left").GetString()!], p.GetProperty("leftId").GetInt64()));

        var done = await Json(await StudentA.PostAsJsonAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}/submit", new { answers = Answers(attempt) }));
        var detail = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{done.GetProperty("id").GetInt64()}"));
        Assert.Equal(pairs[0].GetProperty("leftId").GetInt64(), detail.GetProperty("questions")[5].GetProperty("pairs")[0].GetProperty("leftId").GetInt64());
    }

    [Fact]
    public async Task A_modified_true_or_false_key_fix_may_send_the_answer_and_corrections_together()
    {
        await SeedAsync();
        var (exam, set) = await ExamAsync();
        var done = await TakeAsync(StudentA, exam, a => Answers(a, correction: "memory"));
        Assert.Equal(9m, done.GetProperty("score").GetDecimal());
        var mtf = (await Json(await Instructor.GetAsync($"/api/questionnaires/{set}"))).GetProperty("questions")[2].GetProperty("id").GetInt64();

        var result = await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{set}/answer-key", new
        {
            questions = new object[] { new { questionId = mtf, correctAnswer = false, expectedAnswers = new[] { "memory", "storage" } } },
        }));
        var q = result.GetProperty("questionnaire").GetProperty("questions")[2];
        Assert.Equal(["memory", "storage"], q.GetProperty("expectedAnswers").EnumerateArray().Select(a => a.GetString()!).ToArray());
        Assert.True(q.GetProperty("options")[1].GetProperty("isCorrect").GetBoolean());
        Assert.Equal(1, result.GetProperty("changed").GetInt32());
        Assert.Equal(11m, (await Json(await StudentA.GetAsync($"{Base}/{exam}/attempts/{done.GetProperty("id").GetInt64()}"))).GetProperty("score").GetDecimal());
    }

    [Fact]
    public async Task Answer_points_settle_a_near_miss_waiting_for_review()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { spellingMode = "review" });
        var waiting = await TakeAsync(StudentA, exam, a => Answers(a, identification: "Babage"));
        Assert.Equal("submitted", waiting.GetProperty("status").GetString());
        var id = waiting.GetProperty("id").GetInt64();
        var pending = waiting.GetProperty("answers").EnumerateArray().Single(a => a.GetProperty("matchNote").GetString() == "review").GetProperty("questionId").GetInt64();

        var graded = await Json(await Instructor.PutAsJsonAsync($"{Base}/{exam}/submissions/{id}/grade", new { answerPoints = new Dictionary<string, decimal> { [pending.ToString()] = 1.5m } }));
        Assert.Equal("graded", graded.GetProperty("status").GetString());
        Assert.Equal(10.5m, graded.GetProperty("score").GetDecimal());
        var answer = (await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{id}"))).GetProperty("answers").EnumerateArray()
            .Single(a => a.GetProperty("questionId").GetInt64() == pending);
        Assert.Equal(1.5m, answer.GetProperty("pointsAwarded").GetDecimal());
        Assert.Equal("accepted", answer.GetProperty("decision").GetString());
    }

    // ------------------------------------------------------------ student client (PR #49)

    [Fact]
    public async Task The_overview_carries_the_exam_settings()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync(new { answerReview = "score_only", spellingMode = "typos", shuffleChoices = true });
        JsonElement Item(JsonElement overview) => overview.GetProperty("coursework").EnumerateArray()
            .Single(c => c.GetProperty("coursework").GetProperty("id").GetInt64() == exam).GetProperty("coursework");

        var student = Item(await Json(await StudentA.GetAsync("/api/me/overview")));
        Assert.Equal("score_only", student.GetProperty("answerReview").GetString());
        Assert.Equal("typos", student.GetProperty("spellingMode").GetString());

        var instructor = Item(await Json(await Instructor.GetAsync("/api/me/overview")));
        Assert.Equal("typos", instructor.GetProperty("spellingMode").GetString());
        Assert.False(instructor.GetProperty("shuffleQuestions").GetBoolean());
        Assert.True(instructor.GetProperty("shuffleChoices").GetBoolean());
    }

    [Fact]
    public async Task The_preview_carries_the_exam_title_and_attempts_do_not()
    {
        await SeedAsync();
        var (exam, _) = await ExamAsync();
        Assert.Equal("Midterm exam", (await Json(await Instructor.GetAsync($"{Base}/{exam}/preview"))).GetProperty("title").GetString());
        Assert.False((await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null))).TryGetProperty("title", out _));
    }
}
