using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Demo;
using Lms.Api.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Lms.Api.Tests;

/// <summary>The API in Demo mode: no MySQL, no ISMS API, the fictional seed, one database per sandbox.</summary>
public sealed class DemoModeTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), $"lms-demo-test-{Guid.NewGuid():N}");
    private readonly WebApplicationFactory<Program> _factory;

    public DemoModeTests() => _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b
        .UseEnvironment("Demo")
        .UseSetting("Lms:Demo:DataDirectory", _dir)
        .UseSetting("Lms:Demo:Now", "2026-10-23T09:00:00+08:00"));

    public void Dispose()
    {
        _factory.Dispose();
        try { Directory.Delete(_dir, recursive: true); } catch (IOException) { }
    }

    private HttpClient As(string id, string role, string sandbox = "t1")
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        client.DefaultRequestHeaders.Add(DemoOptions.SandboxHeader, sandbox);
        return client;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) => JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Runs_without_MySQL_or_ISMS_and_serves_the_fictional_seed()
    {
        var people = await Json(await _factory.CreateClient().GetAsync("/api/people"));
        Assert.Equal(["Angela Reyes", "Daniel Cruz", "Sofia Lim", "Miguel Santos"], people.GetProperty("instructors").EnumerateArray().Select(p => p.GetProperty("name").GetString()!).ToArray());
        Assert.Equal("Alex Rivera", people.GetProperty("students")[0].GetProperty("name").GetString());

        var status = await Json(await _factory.CreateClient().GetAsync("/api/isms/status"));
        Assert.True(status.GetProperty("authorized").GetBoolean());
        var lms = await Json(await _factory.CreateClient().GetAsync("/api/lms/status"));
        Assert.Equal(0, lms.GetProperty("database").GetProperty("pendingMigrations").GetInt32());
    }

    [Fact]
    public async Task A_student_overview_has_every_class_and_published_quiz_but_no_answers()
    {
        var response = await As("s0", CurrentUser.Student).GetAsync("/api/me/overview");
        var text = await response.Content.ReadAsStringAsync();
        var overview = JsonDocument.Parse(text).RootElement;
        Assert.Equal("Alex", overview.GetProperty("me").GetProperty("firstName").GetString());
        Assert.Equal(["biology", "math", "english", "history"], overview.GetProperty("classes").EnumerateArray().Select(c => c.GetProperty("id").GetString()!).ToArray());
        Assert.Equal(12, overview.GetProperty("classes")[0].GetProperty("studentCount").GetInt32());
        Assert.Equal(12, overview.GetProperty("coursework").GetArrayLength());
        var quiz = overview.GetProperty("coursework")[0].GetProperty("coursework");
        Assert.Equal("Quiz", quiz.GetProperty("category").GetString());
        // 2026-10-22 16:00 in Manila.
        Assert.Equal(new DateTime(2026, 10, 22, 8, 0, 0), quiz.GetProperty("dueAt").GetDateTime());
        Assert.DoesNotContain("isCorrect", text);
        Assert.DoesNotContain("questionnaireId\":1", text);
    }

    [Fact]
    public async Task An_instructor_sees_only_the_class_they_teach()
    {
        var overview = await Json(await As("instructor-2", CurrentUser.Instructor).GetAsync("/api/me/overview"));
        Assert.Equal(["math"], overview.GetProperty("classes").EnumerateArray().Select(c => c.GetProperty("id").GetString()!).ToArray());
        Assert.All(overview.GetProperty("coursework").EnumerateArray(), c => Assert.Equal("math", c.GetProperty("classId").GetString()));
        Assert.Equal(12, overview.GetProperty("students").GetArrayLength());
    }

    [Fact]
    public async Task Each_sandbox_has_its_own_data()
    {
        var a = As("instructor-1", CurrentUser.Instructor, "sandbox-a");
        var posted = await a.PostAsJsonAsync("/api/classes/biology/announcements", new { title = "Lab moved", message = "Room 204 on Friday." });
        Assert.Equal(HttpStatusCode.Created, posted.StatusCode);

        Assert.Equal(1, (await Json(await As("s0", CurrentUser.Student, "sandbox-a").GetAsync("/api/me/overview"))).GetProperty("announcements").GetArrayLength());
        Assert.Equal(0, (await Json(await As("s0", CurrentUser.Student, "sandbox-b").GetAsync("/api/me/overview"))).GetProperty("announcements").GetArrayLength());
    }

    [Fact]
    public async Task Each_sandbox_keeps_its_own_files_and_only_the_test_file_is_refused()
    {
        var teacher = As("instructor-1", CurrentUser.Instructor, "sandbox-a");
        var module = (await Json(await teacher.GetAsync("/api/classes/biology/modules")))[0].GetProperty("id").GetInt64();
        var created = await Json(await teacher.PostAsJsonAsync("/api/classes/biology/coursework", new { type = "assignment", moduleId = module, title = "Cell diagram", maxPoints = 10, status = "published" }));
        var id = created.GetProperty("id").GetInt64();
        var student = As("s0", CurrentUser.Student, "sandbox-a");

        using var flagged = TestFiles.Form(System.Text.Encoding.ASCII.GetBytes(Lms.Api.Files.NoScanner.TestMarker), "notes.txt");
        var refused = await student.PostAsync($"/api/classes/biology/coursework/{id}/draft/files", flagged);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Contains("virus scan flagged", await refused.Content.ReadAsStringAsync());

        using var form = TestFiles.Form(TestFiles.Pdf(), "cell.pdf");
        var uploaded = await student.PostAsync($"/api/classes/biology/coursework/{id}/draft/files", form);
        Assert.Equal(HttpStatusCode.Created, uploaded.StatusCode);
        var fileId = (await Json(uploaded)).GetProperty("files")[0].GetProperty("id").GetInt64();
        Assert.Equal(TestFiles.Pdf(), await (await student.GetAsync($"/api/files/{fileId}")).Content.ReadAsByteArrayAsync());

        // The bytes are in this sandbox's folder, and another sandbox has neither the row nor the file.
        Assert.Single(Directory.GetFiles(Path.Combine(_dir, "files", "sandbox-a"), "*", SearchOption.AllDirectories));
        Assert.Equal(HttpStatusCode.NotFound, (await As("s0", CurrentUser.Student, "sandbox-b").GetAsync($"/api/files/{fileId}")).StatusCode);
    }

    [Fact]
    public async Task The_demo_database_has_the_attendance_tables()
    {
        var saved = await As("instructor-1", CurrentUser.Instructor).PutAsJsonAsync("/api/classes/biology/attendance/2026/10", new { schoolDays = 20, entries = new[] { new { studentId = "s0", daysPresent = 18 } } });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var overview = await Json(await As("s0", CurrentUser.Student).GetAsync("/api/me/overview"));
        Assert.Equal(18, overview.GetProperty("attendance")[0].GetProperty("month").GetProperty("entries")[0].GetProperty("daysPresent").GetInt32());
    }

    [Fact]
    public async Task The_clock_starts_at_the_configured_time_so_seeded_due_dates_behave_as_in_the_tests()
    {
        var overview = await Json(await As("s0", CurrentUser.Student).GetAsync("/api/me/overview"));
        var quiz = overview.GetProperty("coursework").EnumerateArray().Select(c => c.GetProperty("coursework")).First(c => c.GetProperty("title").GetString()!.StartsWith("Quiz 02"));
        var attempt = await Json(await As("s0", CurrentUser.Student).PostAsync($"/api/classes/math/coursework/{quiz.GetProperty("id").GetInt64()}/attempts", null));
        var started = attempt.GetProperty("startedAt").GetDateTime();
        Assert.InRange(started, new DateTime(2026, 10, 23, 1, 0, 0), new DateTime(2026, 10, 23, 1, 5, 0));
    }
}
