using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;

namespace Lms.Api.Tests;

public sealed class OverviewTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    [Fact]
    public async Task Students_see_only_published_active_content_and_their_own_work()
    {
        var module = await _factory.WithDbAsync(async db =>
        {
            db.IsmsClasses.Add(new IsmsClass { Id = "class-a", ScheduleId = "S", SubjectName = "Databases", InstructorId = "EMP-1", InstructorName = "Ana Reyes", IsActive = true });
            db.IsmsClassStudents.AddRange(
                new IsmsClassStudent { ClassId = "class-a", StudentId = "STU-1", EnrollmentId = "E1", FirstName = "Lia", LastName = "Abad", IsActive = true },
                new IsmsClassStudent { ClassId = "class-a", StudentId = "STU-2", EnrollmentId = "E2", FirstName = "Max", LastName = "Bas", IsActive = true });
            var m = new Module { ClassId = "class-a", Title = "Unit 1" };
            db.Modules.Add(m);
            await db.SaveChangesAsync();
            return m.Id;
        });
        var teacher = As("EMP-1", CurrentUser.Instructor);
        await teacher.PostAsJsonAsync("/api/classes/class-a/coursework", new { type = "assignment", moduleId = module, title = "Draft work", maxPoints = 10 });
        var published = await (await teacher.PostAsJsonAsync("/api/classes/class-a/coursework", new { type = "assignment", moduleId = module, title = "ERD", maxPoints = 10, status = "published" })).Content.ReadFromJsonAsync<JsonElement>();
        var material = await (await teacher.PostAsJsonAsync("/api/classes/class-a/materials", new { moduleId = module, title = "Old notes", kind = "Reading" })).Content.ReadFromJsonAsync<JsonElement>();
        await teacher.PatchAsJsonAsync($"/api/classes/class-a/materials/{material.GetProperty("id").GetInt64()}", new { status = "archived" });
        await As("STU-2", CurrentUser.Student).PostAsJsonAsync($"/api/classes/class-a/coursework/{published.GetProperty("id").GetInt64()}/submissions", new { text = "Max's work" });
        await As("STU-1", CurrentUser.Student).PostAsJsonAsync($"/api/classes/class-a/coursework/{published.GetProperty("id").GetInt64()}/submissions", new { text = "Lia's work" });

        var lia = await As("STU-1", CurrentUser.Student).GetFromJsonAsync<JsonElement>("/api/me/overview");
        Assert.Equal(["ERD"], lia.GetProperty("coursework").EnumerateArray().Select(c => c.GetProperty("coursework").GetProperty("title").GetString()!).ToArray());
        Assert.Equal(0, lia.GetProperty("materials").GetArrayLength());
        Assert.Equal(["STU-1"], lia.GetProperty("submissions").EnumerateArray().Select(s => s.GetProperty("submission").GetProperty("studentId").GetString()!).ToArray());

        var ana = await teacher.GetFromJsonAsync<JsonElement>("/api/me/overview");
        Assert.Equal(2, ana.GetProperty("coursework").GetArrayLength());
        Assert.Equal(1, ana.GetProperty("materials").GetArrayLength());
        Assert.Equal(2, ana.GetProperty("submissions").GetArrayLength());
        Assert.Equal(40, ana.GetProperty("gradebooks")[0].GetProperty("activityWeight").GetInt32());
    }

    [Fact]
    public async Task An_instructor_with_several_classes_and_their_shared_student_both_load()
    {
        await _factory.WithDbAsync(async db =>
        {
            foreach (var id in new[] { "class-a", "class-b" })
            {
                db.IsmsClasses.Add(new IsmsClass { Id = id, ScheduleId = id, SubjectName = "Databases", InstructorId = "EMP-1", InstructorName = "Ana Reyes", IsActive = true });
                db.IsmsClassStudents.Add(new IsmsClassStudent { ClassId = id, StudentId = "STU-1", EnrollmentId = "E-" + id, FirstName = "Lia", LastName = "Abad", IsActive = true });
            }
            await db.SaveChangesAsync();
            return 0;
        });

        var ana = await As("EMP-1", CurrentUser.Instructor).GetFromJsonAsync<JsonElement>("/api/me/overview");
        Assert.Equal(2, ana.GetProperty("classes").GetArrayLength());
        Assert.Equal("Ana", ana.GetProperty("me").GetProperty("firstName").GetString());
        var lia = await As("STU-1", CurrentUser.Student).GetFromJsonAsync<JsonElement>("/api/me/overview");
        Assert.Equal(2, lia.GetProperty("classes").GetArrayLength());
    }

    [Fact]
    public async Task The_people_list_is_unavailable_when_the_demo_identity_is_off()
    {
        using var factory = new LmsApiFactory().With(DemoIdentity.EnabledSetting, "false");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync("/api/people")).StatusCode);
    }
}
