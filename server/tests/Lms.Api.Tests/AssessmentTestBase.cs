using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;

namespace Lms.Api.Tests;

/// <summary>Shared setup for the assessment builder tests: one class, one instructor, two students. Fictional records only.</summary>
public abstract class AssessmentTestBase : IDisposable
{
    protected readonly LmsApiFactory Factory = new();
    public void Dispose() => Factory.Dispose();

    protected const string Teacher = "EMP-1";
    protected const string OtherTeacher = "EMP-2";
    protected const string Lia = "STU-1";
    protected const string Max = "STU-2";
    protected const string Base = "/api/classes/class-a/coursework";
    protected long ModuleId;

    protected async Task SeedAsync() => ModuleId = await Factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.Add(new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Computing 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true, SchoolYearId = 1, SemesterId = 1 });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Lia, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Max, EnrollmentId = "E-2", FirstName = "Max", LastName = "Bautista", IsActive = true });
        var module = new Module { ClassId = "class-a", Title = "Unit 1", SortOrder = 1 };
        db.Modules.Add(module);
        await db.SaveChangesAsync();
        return module.Id;
    });

    protected HttpClient As(string id, string role)
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    protected HttpClient Instructor => As(Teacher, CurrentUser.Instructor);
    protected HttpClient StudentA => As(Lia, CurrentUser.Student);
    protected HttpClient StudentB => As(Max, CurrentUser.Student);

    protected static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement;
    }

    protected static async Task<JsonElement> Problem(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    /// <summary>One question of every type, in two sections.</summary>
    protected static object EveryType(bool withEssay = false) => new
    {
        sections = new object[]
        {
            new { title = "Test I. Choose", directions = "Choose the best answer.", defaultPoints = 1 },
            new { title = "Test II. Write", directions = "Write your answer.", defaultPoints = (int?)null },
        },
        questions = (object[])
        [
            new { type = "multiple_choice", prompt = "Which part runs programs?", points = 1, section = 0, options = new[] { new { text = "CPU", isCorrect = true }, new { text = "Mouse", isCorrect = false }, new { text = "Monitor", isCorrect = false } } },
            new { type = "true_false", prompt = "A byte has 8 bits.", points = 1, section = 0, correctAnswer = true },
            new { type = "modified_true_false", prompt = "The CPU stores data permanently.", points = 2, section = 0, underlined = "CPU", correctAnswer = false, expectedAnswers = new[] { "storage", "hard disk" } },
            new { type = "identification", prompt = "The father of computers.", points = 2, section = 1, expectedAnswers = new[] { "Charles Babbage", "Babbage" } },
            new { type = "enumeration", prompt = "The primary colors of light.", points = 3, section = 1, expectedAnswers = new[] { "red", "green", "blue" } },
            new { type = "matching", prompt = "Match the device.", points = 2, section = 1, pairs = new[] { new { left = "Keyboard", right = "input" }, new { left = "Monitor", right = "output" } } },
            .. (withEssay ? new object[] { new { type = "essay", prompt = "Why do backups matter?", points = 5, section = 1 } } : []),
        ],
    };

    protected async Task<long> SetAsync(object body)
    {
        var id = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Midterm" }))).GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", body));
        return id;
    }

    /// <summary>A published exam using a set with every type; returns (exam id, set id).</summary>
    protected async Task<(long Exam, long Set)> ExamAsync(object? settings = null, bool withEssay = false, object? body = null)
    {
        var set = await SetAsync(body ?? EveryType(withEssay));
        var exam = await Json(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = ModuleId, title = "Midterm exam", questionnaireId = set, status = "published", maxAttempts = 3 }));
        var id = exam.GetProperty("id").GetInt64();
        if (settings is not null) await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", settings));
        return (id, set);
    }

    protected static long OptionId(JsonElement question, string text) =>
        question.GetProperty("options").EnumerateArray().First(o => o.GetProperty("text").GetString() == text).GetProperty("id").GetInt64();

    protected static JsonElement QuestionOfType(JsonElement attempt, string type) =>
        attempt.GetProperty("questions").EnumerateArray().First(q => q.GetProperty("type").GetString() == type);

    /// <summary>Starts an attempt as the student, answers with the given builder, and submits.</summary>
    protected async Task<JsonElement> TakeAsync(HttpClient student, long exam, Func<JsonElement, object[]> answers)
    {
        var attempt = await Json(await student.PostAsync($"{Base}/{exam}/attempts", null));
        var id = attempt.GetProperty("id").GetInt64();
        return await Json(await student.PostAsJsonAsync($"{Base}/{exam}/attempts/{id}/submit", new { answers = answers(attempt) }));
    }

    /// <summary>Right answers to <see cref="EveryType"/>, with the identification answer given as <paramref name="identification"/>.</summary>
    protected static object[] Answers(JsonElement attempt, string identification = "Babbage", string correction = "storage", string[]? colors = null)
    {
        var mc = QuestionOfType(attempt, "multiple_choice");
        var tf = QuestionOfType(attempt, "true_false");
        var mtf = QuestionOfType(attempt, "modified_true_false");
        var match = QuestionOfType(attempt, "matching");
        var lefts = match.GetProperty("lefts").EnumerateArray().ToDictionary(l => l.GetProperty("text").GetString()!, l => l.GetProperty("id").GetInt64().ToString());
        return
        [
            new { questionId = mc.GetProperty("id").GetInt64(), optionId = OptionId(mc, "CPU") },
            new { questionId = tf.GetProperty("id").GetInt64(), optionId = OptionId(tf, "True") },
            new { questionId = mtf.GetProperty("id").GetInt64(), optionId = OptionId(mtf, "False"), text = correction },
            new { questionId = QuestionOfType(attempt, "identification").GetProperty("id").GetInt64(), text = identification },
            new { questionId = QuestionOfType(attempt, "enumeration").GetProperty("id").GetInt64(), items = colors ?? ["Blue", "red", "green"] },
            new { questionId = match.GetProperty("id").GetInt64(), matches = new Dictionary<string, string> { [lefts["Keyboard"]] = "input", [lefts["Monitor"]] = "output" } },
        ];
    }
}
