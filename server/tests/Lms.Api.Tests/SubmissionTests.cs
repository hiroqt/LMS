using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

public sealed class SubmissionTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string Lia = "STU-1";
    private const string Max = "STU-2";
    private const string Base = "/api/classes/class-a/coursework";
    private long _moduleId;

    private async Task SeedAsync() => _moduleId = await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.Add(new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Lia, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Max, EnrollmentId = "E-2", FirstName = "Max", LastName = "Bautista", IsActive = true });
        var module = new Module { ClassId = "class-a", Title = "Unit 1", SortOrder = 1 };
        db.Modules.Add(module);
        await db.SaveChangesAsync();
        return module.Id;
    });

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient Instructor => As(Teacher, CurrentUser.Instructor);
    private HttpClient StudentA => As(Lia, CurrentUser.Student);
    private HttpClient StudentB => As(Max, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement;
    }

    private static object[] Questions(bool withEssay = true) =>
    [
        new { type = "multiple_choice", prompt = "Which key identifies a row?", points = 2, options = new[] { new { text = "Primary key", isCorrect = true }, new { text = "Foreign key", isCorrect = false } } },
        new { type = "true_false", prompt = "SQL keywords are case-sensitive.", points = 1, correctAnswer = false },
        new { type = "enumeration", prompt = "List the three outer-join flavours.", points = 2, expectedAnswers = new[] { "inner", "left", "right" } },
        new { type = "matching", prompt = "Match the command.", points = 2, pairs = new[] { new { left = "SELECT", right = "read" }, new { left = "DELETE", right = "remove" } } },
        .. (withEssay ? new object[] { new { type = "essay", prompt = "Explain normalisation.", points = 5 } } : []),
    ];

    /// <summary>A published exam; returns its coursework id.</summary>
    private async Task<long> ExamAsync(bool withEssay = true, int? maxAttempts = null, int? timeLimit = null, DateTimeOffset? dueAt = null, bool allowLate = false)
    {
        var q = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Quiz" }))).GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{q}/questions", new { questions = Questions(withEssay) }));
        var exam = await Json(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = _moduleId, title = "SQL quiz", questionnaireId = q, status = "published", maxAttempts, timeLimitMinutes = timeLimit, dueAt, allowLate }));
        return exam.GetProperty("id").GetInt64();
    }

    private async Task<long> AssignmentAsync(bool allowResubmission = false, DateTimeOffset? dueAt = null, bool allowLate = false) =>
        (await Json(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "ER diagram", maxPoints = 20, status = "published", allowResubmission, dueAt, allowLate })))
        .GetProperty("id").GetInt64();

    /// <summary>Answers: MC right, TF right, enumeration 2 of 3, matching 1 of 2, and an essay.</summary>
    private static object AnswersFor(JsonElement attempt)
    {
        var qs = attempt.GetProperty("questions").EnumerateArray().ToList();
        long Option(int q, string text) => qs[q].GetProperty("options").EnumerateArray().First(o => o.GetProperty("text").GetString() == text).GetProperty("id").GetInt64();
        var lefts = qs[3].GetProperty("lefts").EnumerateArray().ToList();
        var answers = new List<object>
        {
            new { questionId = qs[0].GetProperty("id").GetInt64(), optionId = Option(0, "Primary key") },
            new { questionId = qs[1].GetProperty("id").GetInt64(), optionId = Option(1, "False") },
            new { questionId = qs[2].GetProperty("id").GetInt64(), items = new[] { "Left", "INNER" } },
            new { questionId = qs[3].GetProperty("id").GetInt64(), matches = new Dictionary<string, string> { [lefts[0].GetProperty("id").GetInt64().ToString()] = "read", [lefts[1].GetProperty("id").GetInt64().ToString()] = "read" } },
        };
        if (qs.Count > 4) answers.Add(new { questionId = qs[4].GetProperty("id").GetInt64(), text = "Removing duplication by splitting tables." });
        return new { answers };
    }

    [Fact]
    public async Task A_student_takes_an_exam_the_server_scores_it_and_the_instructor_grades_the_essay()
    {
        await SeedAsync();
        var exam = await ExamAsync();

        var start = await StudentA.PostAsync($"{Base}/{exam}/attempts", null);
        Assert.Equal(HttpStatusCode.Created, start.StatusCode);
        var raw = await start.Content.ReadAsStringAsync();
        Assert.DoesNotContain("isCorrect", raw);
        Assert.DoesNotContain("\"inner\"", raw);           // enumeration answers stay on the server
        var attempt = JsonDocument.Parse(raw).RootElement;
        Assert.Equal(3, attempt.GetProperty("questions")[2].GetProperty("itemCount").GetInt32());
        Assert.Equal(["read", "remove"], attempt.GetProperty("questions")[3].GetProperty("rights").EnumerateArray().Select(r => r.GetString()!).ToArray());
        var id = attempt.GetProperty("id").GetInt64();

        var saved = await Json(await StudentA.PutAsJsonAsync($"{Base}/{exam}/attempts/{id}/answers", AnswersFor(attempt)));
        Assert.All(saved.GetProperty("answers").EnumerateArray(), a => Assert.Equal(JsonValueKind.Null, a.GetProperty("pointsAwarded").ValueKind));

        var submitted = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts/{id}/submit", null));
        Assert.Equal("submitted", submitted.GetProperty("status").GetString());
        var points = submitted.GetProperty("answers").EnumerateArray().ToDictionary(a => a.GetProperty("questionId").GetInt64(), a => a.GetProperty("pointsAwarded"));
        var qs = attempt.GetProperty("questions").EnumerateArray().Select(q => q.GetProperty("id").GetInt64()).ToList();
        Assert.Equal(2m, points[qs[0]].GetDecimal());
        Assert.Equal(1m, points[qs[1]].GetDecimal());
        Assert.Equal(1.33m, points[qs[2]].GetDecimal());
        Assert.Equal(1m, points[qs[3]].GetDecimal());
        Assert.Equal(JsonValueKind.Null, points[qs[4]].ValueKind);

        var list = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions"));
        Assert.Equal("submitted", list.GetProperty("items")[0].GetProperty("status").GetString());
        Assert.Equal([Max], list.GetProperty("missing").EnumerateArray().Select(m => m.GetProperty("studentId").GetString()!).ToArray());
        var detail = await Json(await Instructor.GetAsync($"{Base}/{exam}/submissions/{id}"));
        Assert.True(detail.GetProperty("questions")[0].GetProperty("options")[0].GetProperty("isCorrect").GetBoolean());

        var missingEssay = await Instructor.PutAsJsonAsync($"{Base}/{exam}/submissions/{id}/grade", new { feedback = "Good" });
        Assert.Equal(HttpStatusCode.BadRequest, missingEssay.StatusCode);
        var graded = await Json(await Instructor.PutAsJsonAsync($"{Base}/{exam}/submissions/{id}/grade", new { feedback = "Good work", answerPoints = new Dictionary<string, decimal> { [qs[4].ToString()] = 4 } }));
        Assert.Equal(9.33m, graded.GetProperty("score").GetDecimal());

        var mine = await Json(await StudentA.GetAsync($"{Base}/{exam}/my-submissions"));
        Assert.Equal("graded", mine[0].GetProperty("status").GetString());
        Assert.Equal("Good work", mine[0].GetProperty("feedback").GetString());
    }

    [Fact]
    public async Task An_exam_without_essays_is_graded_on_submit()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: false);
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var done = await Json(await StudentA.PostAsJsonAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}/submit", AnswersFor(attempt)));
        Assert.Equal("graded", done.GetProperty("status").GetString());
        Assert.Equal(5.33m, done.GetProperty("score").GetDecimal());
        Assert.Equal("auto", (await _factory.WithDbAsync(db => db.Grades.SingleAsync())).GradedBy);
    }

    [Fact]
    public async Task Starting_again_resumes_the_open_attempt_and_attempts_are_limited()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: false, maxAttempts: 2);
        var first = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var again = await StudentA.PostAsync($"{Base}/{exam}/attempts", null);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(first.GetProperty("id").GetInt64(), (await Json(again)).GetProperty("id").GetInt64());

        await StudentA.PostAsync($"{Base}/{exam}/attempts/{first.GetProperty("id").GetInt64()}/submit", null);
        var second = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        Assert.Equal(2, second.GetProperty("attemptNumber").GetInt32());
        await StudentA.PostAsync($"{Base}/{exam}/attempts/{second.GetProperty("id").GetInt64()}/submit", null);
        Assert.Equal(HttpStatusCode.Conflict, (await StudentA.PostAsync($"{Base}/{exam}/attempts", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await StudentA.PostAsync($"{Base}/{exam}/attempts/{second.GetProperty("id").GetInt64()}/submit", null)).StatusCode);
    }

    [Fact]
    public async Task After_the_time_limit_answers_stop_saving_and_the_saved_ones_are_submitted()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: false, timeLimit: 10);
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var id = attempt.GetProperty("id").GetInt64();
        Assert.Equal(_factory.Time.Now.UtcDateTime.AddMinutes(10), attempt.GetProperty("deadline").GetDateTime());

        _factory.Time.Now += TimeSpan.FromMinutes(10) + SubmissionEndpoints.Grace + TimeSpan.FromSeconds(1);
        Assert.Equal(HttpStatusCode.Conflict, (await StudentA.PutAsJsonAsync($"{Base}/{exam}/attempts/{id}/answers", AnswersFor(attempt))).StatusCode);
        var late = await Json(await StudentA.PostAsJsonAsync($"{Base}/{exam}/attempts/{id}/submit", AnswersFor(attempt)));
        Assert.Equal(0m, late.GetProperty("score").GetDecimal());
    }

    [Fact]
    public async Task Due_dates_and_late_work_are_enforced()
    {
        await SeedAsync();
        var due = _factory.Time.Now.AddHours(1);
        var strictExam = await ExamAsync(withEssay: false, dueAt: due);
        var strictAssignment = await AssignmentAsync(dueAt: due);
        var lenient = await AssignmentAsync(dueAt: due, allowLate: true);
        _factory.Time.Now += TimeSpan.FromHours(2);

        Assert.Equal(HttpStatusCode.Conflict, (await StudentA.PostAsync($"{Base}/{strictExam}/attempts", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await StudentA.PostAsJsonAsync($"{Base}/{strictAssignment}/submissions", new { text = "Here" })).StatusCode);
        var late = await StudentA.PostAsJsonAsync($"{Base}/{lenient}/submissions", new { text = "My ER diagram" });
        Assert.Equal(HttpStatusCode.Created, late.StatusCode);
        Assert.True((await Json(late)).GetProperty("late").GetBoolean());
    }

    [Fact]
    public async Task Assignments_follow_the_resubmission_setting_and_scores_stay_within_the_points()
    {
        await SeedAsync();
        var once = await AssignmentAsync();
        // A typed file name is no longer work: the file itself is uploaded to the draft (D-055).
        Assert.Equal(HttpStatusCode.BadRequest, (await StudentA.PostAsJsonAsync($"{Base}/{once}/submissions", new { fileName = "erd.png" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await StudentA.PostAsJsonAsync($"{Base}/{once}/submissions", new { text = "My diagram", fileName = "erd.png" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await StudentA.PostAsJsonAsync($"{Base}/{once}/submissions", new { })).StatusCode);
        var first = await Json(await StudentA.PostAsJsonAsync($"{Base}/{once}/submissions", new { text = "My diagram" }));
        Assert.Equal(HttpStatusCode.Conflict, (await StudentA.PostAsJsonAsync($"{Base}/{once}/submissions", new { text = "Again" })).StatusCode);

        var sid = first.GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PutAsJsonAsync($"{Base}/{once}/submissions/{sid}/grade", new { points = 25 })).StatusCode);
        var graded = await Json(await Instructor.PutAsJsonAsync($"{Base}/{once}/submissions/{sid}/grade", new { points = 18, feedback = "Clear" }));
        Assert.Equal(18m, graded.GetProperty("score").GetDecimal());

        var repeatable = await AssignmentAsync(allowResubmission: true);
        await StudentA.PostAsJsonAsync($"{Base}/{repeatable}/submissions", new { text = "v1" });
        var v2 = await Json(await StudentA.PostAsJsonAsync($"{Base}/{repeatable}/submissions", new { text = "v2" }));
        Assert.Equal(2, v2.GetProperty("attemptNumber").GetInt32());
    }

    [Fact]
    public async Task Work_is_private_to_its_student_and_grading_to_the_instructor()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: false);
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var id = attempt.GetProperty("id").GetInt64();

        Assert.Equal(HttpStatusCode.NotFound, (await StudentB.GetAsync($"{Base}/{exam}/attempts/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await StudentB.PostAsync($"{Base}/{exam}/attempts/{id}/submit", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.GetAsync($"{Base}/{exam}/submissions")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PutAsJsonAsync($"{Base}/{exam}/submissions/{id}/grade", new { points = 100 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As("EMP-9", CurrentUser.Instructor).GetAsync($"{Base}/{exam}/submissions")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Instructor.PostAsync($"{Base}/{exam}/attempts", null)).StatusCode);
    }

    [Fact]
    public async Task An_answer_for_another_question_is_rejected_and_nothing_is_saved()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: false);
        var attempt = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        var qs = attempt.GetProperty("questions");
        var wrongOption = qs[1].GetProperty("options")[0].GetProperty("id").GetInt64();
        var bad = await StudentA.PutAsJsonAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}/answers", new
        {
            answers = new object[] { new { questionId = qs[0].GetProperty("id").GetInt64(), optionId = wrongOption }, new { questionId = 999999, text = "x" } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.SubmissionAnswers.CountAsync()));
    }

    [Fact]
    public async Task The_gradebook_uses_graded_work_and_weights_that_add_up_to_100()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PutAsJsonAsync("/api/classes/class-a/gradebook", new { activityWeight = 50, examWeight = 60, passingScore = 75 })).StatusCode);
        await Json(await Instructor.PutAsJsonAsync("/api/classes/class-a/gradebook", new { activityWeight = 50, examWeight = 50, passingScore = 75 }));

        var assignment = await AssignmentAsync(allowResubmission: true);
        var v1 = (await Json(await StudentA.PostAsJsonAsync($"{Base}/{assignment}/submissions", new { text = "v1" }))).GetProperty("id").GetInt64();
        await Instructor.PutAsJsonAsync($"{Base}/{assignment}/submissions/{v1}/grade", new { points = 20 });
        var v2 = (await Json(await StudentA.PostAsJsonAsync($"{Base}/{assignment}/submissions", new { text = "v2" }))).GetProperty("id").GetInt64();
        await Instructor.PutAsJsonAsync($"{Base}/{assignment}/submissions/{v2}/grade", new { points = 10 });   // latest counts: 50%

        var before = await Json(await Instructor.GetAsync("/api/classes/class-a/gradebook"));
        var lia = before.GetProperty("students").EnumerateArray().Single(s => s.GetProperty("studentId").GetString() == Lia);
        Assert.Equal(50m, lia.GetProperty("activities").GetProperty("average").GetDecimal());
        Assert.Equal(JsonValueKind.Null, lia.GetProperty("overall").ValueKind);   // no exam graded yet

        var exam = await ExamAsync(withEssay: false, maxAttempts: 2);
        var a1 = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        await StudentA.PostAsJsonAsync($"{Base}/{exam}/attempts/{a1.GetProperty("id").GetInt64()}/submit", AnswersFor(a1));   // 5.33 of 7
        var a2 = await Json(await StudentA.PostAsync($"{Base}/{exam}/attempts", null));
        await StudentA.PostAsync($"{Base}/{exam}/attempts/{a2.GetProperty("id").GetInt64()}/submit", null);                   // 0 of 7

        var own = await Json(await StudentA.GetAsync("/api/classes/class-a/gradebook"));
        var row = Assert.Single(own.GetProperty("students").EnumerateArray());
        Assert.Equal(76.14m, row.GetProperty("exams").GetProperty("average").GetDecimal());   // highest attempt
        Assert.Equal(63.07m, row.GetProperty("overall").GetDecimal());
        Assert.False(row.GetProperty("passed").GetBoolean());
    }
}
