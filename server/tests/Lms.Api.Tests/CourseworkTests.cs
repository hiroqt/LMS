using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

public sealed class CourseworkTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string OtherTeacher = "EMP-2";
    private const string Enrolled = "STU-1";
    private long _moduleId;

    private async Task SeedAsync() => _moduleId = await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.Add(new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true });
        db.IsmsClassStudents.Add(new IsmsClassStudent { ClassId = "class-a", StudentId = Enrolled, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true });
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

    private HttpClient AsInstructor(string id = Teacher) => As(id, CurrentUser.Instructor);
    private HttpClient AsStudent() => As(Enrolled, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static readonly object[] AllTypes =
    [
        new { type = "multiple_choice", prompt = "Which key identifies a row?", points = 2, options = new[] { new { text = "Primary key", isCorrect = true }, new { text = "Foreign key", isCorrect = false } } },
        new { type = "true_false", prompt = "SQL is case-sensitive for keywords.", points = 1, correctAnswer = false },
        new { type = "essay", prompt = "Explain normalisation.", points = 5 },
        new { type = "enumeration", prompt = "Name two join types.", points = 2, expectedAnswers = new[] { "inner", "left", "right" } },
        new { type = "matching", prompt = "Match the command.", points = 2, pairs = new[] { new { left = "SELECT", right = "read" }, new { left = "DELETE", right = "remove" } } },
    ];

    private async Task<long> QuestionnaireAsync(object[]? questions = null)
    {
        var created = await Json(await AsInstructor().PostAsJsonAsync("/api/questionnaires", new { title = "Midterm" }));
        var id = created.GetProperty("id").GetInt64();
        if (questions is not null)
        {
            var put = await AsInstructor().PutAsJsonAsync($"/api/questionnaires/{id}/questions", new { questions });
            Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        }
        return id;
    }

    private async Task<HttpResponseMessage> CreateExamAsync(long questionnaireId, string status = "draft") =>
        await AsInstructor().PostAsJsonAsync("/api/classes/class-a/coursework", new { type = "exam", moduleId = _moduleId, title = "Midterm exam", questionnaireId, status });

    [Fact]
    public async Task A_questionnaire_stores_all_five_question_types_for_its_owner_only()
    {
        await SeedAsync();
        var id = await QuestionnaireAsync(AllTypes);

        var full = await Json(await AsInstructor().GetAsync($"/api/questionnaires/{id}"));
        var q = full.GetProperty("questions");
        Assert.Equal(5, q.GetArrayLength());
        Assert.True(q[0].GetProperty("options")[0].GetProperty("isCorrect").GetBoolean());
        Assert.Equal(["True", "False"], q[1].GetProperty("options").EnumerateArray().Select(o => o.GetProperty("text").GetString()!).ToArray());
        Assert.True(q[1].GetProperty("options")[1].GetProperty("isCorrect").GetBoolean());
        Assert.Equal(0, q[2].GetProperty("options").GetArrayLength());
        Assert.Equal(3, q[3].GetProperty("expectedAnswers").GetArrayLength());
        Assert.Equal("remove", q[4].GetProperty("pairs")[1].GetProperty("right").GetString());

        Assert.Equal(HttpStatusCode.NotFound, (await AsInstructor(OtherTeacher).GetAsync($"/api/questionnaires/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await AsStudent().GetAsync($"/api/questionnaires/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await AsStudent().GetAsync("/api/questionnaires")).StatusCode);
    }

    [Fact]
    public async Task Invalid_questions_are_rejected_with_their_position_and_nothing_is_saved()
    {
        await SeedAsync();
        var id = await QuestionnaireAsync(AllTypes);
        var bad = await AsInstructor().PutAsJsonAsync($"/api/questionnaires/{id}/questions", new
        {
            questions = new object[]
            {
                new { type = "multiple_choice", prompt = "Two right answers?", points = 1, options = new[] { new { text = "a", isCorrect = true }, new { text = "b", isCorrect = true } } },
                new { type = "riddle", prompt = "?", points = 1 },
                new { type = "matching", prompt = "Only one pair", points = 1, pairs = new[] { new { left = "a", right = "b" } } },
                new { type = "essay", prompt = " ", points = 0 },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var errors = (await Json(bad)).GetProperty("errors");
        foreach (var field in new[] { "questions[0].options", "questions[1].type", "questions[2].pairs", "questions[3].prompt", "questions[3].points" })
            Assert.True(errors.TryGetProperty(field, out _), field);
        Assert.Equal(5, await _factory.WithDbAsync(db => db.Questions.CountAsync()));
    }

    [Fact]
    public async Task An_exam_is_worth_its_questions_and_cannot_be_published_empty()
    {
        await SeedAsync();
        var empty = await QuestionnaireAsync();
        var publishEmpty = await CreateExamAsync(empty, "published");
        Assert.Equal(HttpStatusCode.BadRequest, publishEmpty.StatusCode);

        var draft = await Json(await CreateExamAsync(empty));
        Assert.Equal(0m, draft.GetProperty("maxPoints").GetDecimal());

        await AsInstructor().PutAsJsonAsync($"/api/questionnaires/{empty}/questions", new { questions = AllTypes });
        var exam = await Json(await AsInstructor().GetAsync($"/api/classes/class-a/coursework/{draft.GetProperty("id").GetInt64()}"));
        Assert.Equal(12m, exam.GetProperty("maxPoints").GetDecimal());
        Assert.Equal(5, exam.GetProperty("questionCount").GetInt32());

        var published = await AsInstructor().PatchAsJsonAsync($"/api/classes/class-a/coursework/{draft.GetProperty("id").GetInt64()}", new { status = "published" });
        Assert.Equal("published", (await Json(published)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Assignments_need_points_and_no_questions_and_dates_must_make_sense()
    {
        await SeedAsync();
        var q = await QuestionnaireAsync(AllTypes);
        var bad = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/coursework", new
        {
            type = "assignment", moduleId = _moduleId, title = "ER diagram", questionnaireId = q,
            availableFrom = "2026-11-20T00:00:00Z", dueAt = "2026-11-19T00:00:00Z", maxAttempts = 50,
        });
        var errors = (await Json(bad)).GetProperty("errors");
        foreach (var field in new[] { "questionnaireId", "maxPoints", "dueAt", "maxAttempts" })
            Assert.True(errors.TryGetProperty(field, out _), field);

        var ok = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/coursework", new { type = "assignment", moduleId = _moduleId, title = "ER diagram", maxPoints = 20, dueAt = "2026-11-30T15:00:00+08:00" });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        Assert.Equal(new DateTime(2026, 11, 30, 7, 0, 0), (await Json(ok)).GetProperty("dueAt").GetDateTime());
    }

    [Fact]
    public async Task Another_instructors_questionnaire_cannot_be_used()
    {
        await SeedAsync();
        var theirs = await Json(await AsInstructor(OtherTeacher).PostAsJsonAsync("/api/questionnaires", new { title = "Theirs" }));
        var exam = await CreateExamAsync(theirs.GetProperty("id").GetInt64());
        Assert.Equal(HttpStatusCode.BadRequest, exam.StatusCode);
    }

    [Fact]
    public async Task Students_see_published_available_work_without_any_answers()
    {
        await SeedAsync();
        var q = await QuestionnaireAsync(AllTypes);
        await CreateExamAsync(q);                                    // draft
        var published = await Json(await CreateExamAsync(q, "published"));
        await AsInstructor().PostAsJsonAsync("/api/classes/class-a/coursework", new { type = "assignment", moduleId = _moduleId, title = "Later", maxPoints = 10, status = "published", availableFrom = _factory.Time.Now.AddDays(3) });

        var list = await AsStudent().GetAsync("/api/classes/class-a/coursework");
        var text = await list.Content.ReadAsStringAsync();
        var items = JsonDocument.Parse(text).RootElement.GetProperty("items");
        Assert.Equal(1, items.GetArrayLength());
        Assert.Equal(JsonValueKind.Null, items[0].GetProperty("questionnaireId").ValueKind);
        Assert.DoesNotContain("isCorrect", text);
        Assert.DoesNotContain("Primary key", text);

        Assert.Equal(3, (await Json(await AsInstructor().GetAsync("/api/classes/class-a/coursework"))).GetProperty("total").GetInt32());
        var draftId = published.GetProperty("id").GetInt64() - 1;
        Assert.Equal(HttpStatusCode.NotFound, (await AsStudent().GetAsync($"/api/classes/class-a/coursework/{draftId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await AsStudent().PostAsJsonAsync("/api/classes/class-a/coursework", new { type = "assignment" })).StatusCode);
    }

    [Fact]
    public async Task Questions_lock_once_a_student_has_started_an_exam_using_them()
    {
        await SeedAsync();
        var q = await QuestionnaireAsync(AllTypes);
        var exam = await Json(await CreateExamAsync(q, "published"));
        await _factory.WithDbAsync(async db =>
        {
            db.Submissions.Add(new Submission { CourseworkId = exam.GetProperty("id").GetInt64(), StudentId = Enrolled, StartedAt = DateTime.UtcNow });
            return await db.SaveChangesAsync();
        });

        var change = await AsInstructor().PutAsJsonAsync($"/api/questionnaires/{q}/questions", new { questions = AllTypes.Take(1) });
        Assert.Equal(HttpStatusCode.Conflict, change.StatusCode);
        Assert.True((await Json(await AsInstructor().GetAsync($"/api/questionnaires/{q}"))).GetProperty("locked").GetBoolean());
        Assert.Equal(5, await _factory.WithDbAsync(db => db.Questions.CountAsync()));
    }

    [Fact]
    public async Task Coursework_changes_are_audited_without_their_text()
    {
        await SeedAsync();
        var q = await QuestionnaireAsync(AllTypes);
        await CreateExamAsync(q, "published");
        var audit = await _factory.WithDbAsync(db => db.AuditLog.OrderBy(a => a.Id).ToListAsync());
        Assert.Equal(["created", "updated", "published"], audit.Select(a => a.Action).ToArray());
        Assert.All(audit, a => Assert.Equal("coursework", a.Category));
        Assert.All(audit, a => Assert.DoesNotContain("normalisation", a.Summary));
    }
}
