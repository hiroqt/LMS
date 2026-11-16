using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Lms.Api.Sync;
using Microsoft.EntityFrameworkCore;
using static Lms.Api.Tests.IsmsFixtures;

namespace Lms.Api.Tests;

public sealed class ContentTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string OtherTeacher = "EMP-2";
    private const string Enrolled = "STU-1";
    private const string Dropped = "STU-2";
    private const string Outsider = "STU-9";

    private async Task SeedAsync(bool active = true) => await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.AddRange(
            new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = active, MeetingsJson = "[{\"day\":\"MW\",\"timeFrom\":\"08:00\",\"timeTo\":\"09:30\",\"roomId\":1,\"modality\":1}]" },
            new IsmsClass { Id = "class-b", ScheduleId = "SCH-2", SubjectName = "Web Development 1", InstructorId = OtherTeacher, InstructorName = "Ben Cruz", IsActive = true });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Enrolled, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Dropped, EnrollmentId = "E-2", FirstName = "Mia", LastName = "Bas", IsActive = false });
        db.Modules.Add(new Module { ClassId = "class-a", Title = "Unit 1", SortOrder = 1 });
        return await db.SaveChangesAsync();
    });

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient AsInstructor(string id = Teacher) => As(id, CurrentUser.Instructor);
    private HttpClient AsStudent(string id = Enrolled) => As(id, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private async Task<long> ModuleIdAsync() => await _factory.WithDbAsync(db => db.Modules.Where(m => m.ClassId == "class-a").Select(m => m.Id).FirstAsync());

    private async Task<long> CreateMaterialAsync(string title = "Week 1 slides") =>
        (await Json(await AsInstructor().PostAsJsonAsync("/api/classes/class-a/materials", new { moduleId = await ModuleIdAsync(), title, kind = "Lecture Slides", fileName = "week1.pdf" })))
        .GetProperty("id").GetInt64();

    [Fact]
    public async Task Without_a_demo_identity_every_content_route_is_401()
    {
        await SeedAsync();
        var anonymous = _factory.CreateClient();
        foreach (var path in new[] { "/api/me/classes", "/api/classes/class-a/modules", "/api/classes/class-a/materials", "/api/classes/class-a/announcements" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await As(Teacher, "admin").GetAsync("/api/classes/class-a/modules")).StatusCode);
    }

    [Fact]
    public async Task With_the_demo_identity_turned_off_requests_are_refused()
    {
        using var factory = new LmsApiFactory().With(DemoIdentity.EnabledSetting, "false");
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, Teacher);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, CurrentUser.Instructor);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me/classes")).StatusCode);
    }

    [Fact]
    public async Task Each_person_sees_only_their_own_classes()
    {
        await SeedAsync();
        var mine = await Json(await AsInstructor().GetAsync("/api/me/classes"));
        Assert.Equal("instructor", mine.GetProperty("role").GetString());
        Assert.Equal(["class-a"], mine.GetProperty("items").EnumerateArray().Select(c => c.GetProperty("id").GetString()!).ToArray());
        Assert.Equal("MW", mine.GetProperty("items")[0].GetProperty("meetings")[0].GetProperty("day").GetString());

        Assert.Equal(1, (await Json(await AsStudent().GetAsync("/api/me/classes"))).GetProperty("items").GetArrayLength());
        Assert.Equal(0, (await Json(await AsStudent(Dropped).GetAsync("/api/me/classes"))).GetProperty("items").GetArrayLength());
        Assert.Equal(0, (await Json(await AsStudent(Outsider).GetAsync("/api/me/classes"))).GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task People_outside_a_class_get_404_and_students_cannot_change_content()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await AsInstructor(OtherTeacher).GetAsync("/api/classes/class-a/modules")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AsStudent(Outsider).GetAsync("/api/classes/class-a/modules")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AsStudent(Dropped).GetAsync("/api/classes/class-a/modules")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AsInstructor().GetAsync("/api/classes/no-such-class/modules")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await AsStudent().GetAsync("/api/classes/class-a/modules")).StatusCode);

        var write = await AsStudent().PostAsJsonAsync("/api/classes/class-a/announcements", new { title = "Hi", message = "Hello" });
        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
        var other = await AsInstructor(OtherTeacher).PostAsJsonAsync("/api/classes/class-a/announcements", new { title = "Hi", message = "Hello" });
        Assert.Equal(HttpStatusCode.NotFound, other.StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Announcements.CountAsync()));
    }

    [Fact]
    public async Task A_class_ISMS_no_longer_offers_is_read_only()
    {
        await SeedAsync(active: false);
        Assert.Equal(HttpStatusCode.OK, (await AsInstructor().GetAsync("/api/classes/class-a/modules")).StatusCode);
        var write = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/modules", new { title = "Unit 2" });
        Assert.Equal(HttpStatusCode.Conflict, write.StatusCode);
    }

    [Fact]
    public async Task Modules_nest_one_level_and_number_themselves()
    {
        await SeedAsync();
        var unit2 = await Json(await AsInstructor().PostAsJsonAsync("/api/classes/class-a/modules", new { title = "Unit 2" }));
        Assert.Equal(2, unit2.GetProperty("sortOrder").GetInt32());

        var sub = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/modules", new { title = "2.1 Joins", parentModuleId = unit2.GetProperty("id").GetInt64() });
        Assert.Equal(HttpStatusCode.Created, sub.StatusCode);
        var subId = (await Json(sub)).GetProperty("id").GetInt64();
        Assert.Equal($"/api/classes/class-a/modules/{subId}", sub.Headers.Location?.ToString());

        var tooDeep = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/modules", new { title = "2.1.1", parentModuleId = subId });
        Assert.Equal(HttpStatusCode.BadRequest, tooDeep.StatusCode);
        Assert.True((await Json(tooDeep)).GetProperty("errors").TryGetProperty("parentModuleId", out _));

        var renamed = await Json(await AsInstructor().PatchAsJsonAsync($"/api/classes/class-a/modules/{subId}", new { title = "2.1 SQL joins" }));
        Assert.Equal("2.1 SQL joins", renamed.GetProperty("title").GetString());
        Assert.Equal(unit2.GetProperty("id").GetInt64(), renamed.GetProperty("parentModuleId").GetInt64());
    }

    [Fact]
    public async Task Materials_are_validated_and_archived_ones_are_hidden_from_students()
    {
        await SeedAsync();
        var bad = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/materials", new { moduleId = 9999, title = " ", kind = "Poster", fileName = "../etc/passwd" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var errors = (await Json(bad)).GetProperty("errors");
        foreach (var field in new[] { "moduleId", "title", "kind", "fileName" })
            Assert.True(errors.TryGetProperty(field, out _), field);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Materials.CountAsync()));

        var id = await CreateMaterialAsync();
        var archived = await AsInstructor().PatchAsJsonAsync($"/api/classes/class-a/materials/{id}", new { status = "archived" });
        Assert.Equal("archived", (await Json(archived)).GetProperty("status").GetString());

        Assert.Equal(1, (await Json(await AsInstructor().GetAsync("/api/classes/class-a/materials"))).GetProperty("total").GetInt32());
        Assert.Equal(0, (await Json(await AsStudent().GetAsync("/api/classes/class-a/materials"))).GetProperty("total").GetInt32());

        await AsInstructor().PatchAsJsonAsync($"/api/classes/class-a/materials/{id}", new { status = "active" });
        Assert.Equal(1, (await Json(await AsStudent().GetAsync("/api/classes/class-a/materials"))).GetProperty("total").GetInt32());

        Assert.Equal(HttpStatusCode.NoContent, (await AsInstructor().DeleteAsync($"/api/classes/class-a/materials/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AsInstructor().DeleteAsync($"/api/classes/class-a/materials/{id}")).StatusCode);
    }

    [Fact]
    public async Task A_material_of_one_class_cannot_be_changed_through_another()
    {
        await SeedAsync();
        var id = await CreateMaterialAsync();
        await _factory.WithDbAsync(async db => { db.IsmsClasses.Single(c => c.Id == "class-b").InstructorId = Teacher; return await db.SaveChangesAsync(); });

        Assert.Equal(HttpStatusCode.NotFound, (await AsInstructor().PatchAsJsonAsync($"/api/classes/class-b/materials/{id}", new { status = "archived" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AsInstructor().DeleteAsync($"/api/classes/class-b/materials/{id}")).StatusCode);
    }

    [Fact]
    public async Task Announcements_are_newest_first_and_paged()
    {
        await SeedAsync();
        for (var i = 1; i <= 3; i++)
        {
            await AsInstructor().PostAsJsonAsync("/api/classes/class-a/announcements", new { title = $"Notice {i}", message = "Bring laptops." });
            _factory.Time.Now += TimeSpan.FromMinutes(1);
        }
        var page = await Json(await AsStudent().GetAsync("/api/classes/class-a/announcements?pageSize=2"));
        Assert.Equal(3, page.GetProperty("total").GetInt32());
        Assert.Equal(["Notice 3", "Notice 2"], page.GetProperty("items").EnumerateArray().Select(a => a.GetProperty("title").GetString()!).ToArray());
        Assert.Equal(Teacher, page.GetProperty("items")[0].GetProperty("postedBy").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await AsStudent().GetAsync("/api/classes/class-a/announcements?pageSize=500")).StatusCode);
        var tooLong = await AsInstructor().PostAsJsonAsync("/api/classes/class-a/announcements", new { title = new string('x', 121), message = "m" });
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }

    [Fact]
    public async Task Every_change_writes_a_metadata_only_audit_row_stamped_with_the_instructor()
    {
        await SeedAsync();
        await AsInstructor().PostAsJsonAsync("/api/classes/class-a/announcements", new { title = "Quiz moved", message = "Secret details here" });
        var id = await CreateMaterialAsync();
        await AsInstructor().PatchAsJsonAsync($"/api/classes/class-a/materials/{id}", new { status = "archived" });

        var audit = await _factory.WithDbAsync(db => db.AuditLog.OrderBy(a => a.Id).ToListAsync());
        Assert.Equal(["published", "created", "archived"], audit.Select(a => a.Action).ToArray());
        Assert.All(audit, a => Assert.Equal(Teacher, a.ActorId));
        Assert.All(audit, a => Assert.DoesNotContain("Secret", a.Summary));
        Assert.All(audit, a => Assert.Equal(_factory.Time.Now.UtcDateTime, a.CreatedAt));
        var material = await _factory.WithDbAsync(db => db.Materials.SingleAsync(m => m.Id == id));
        Assert.Equal(Teacher, material.CreatedBy);
        Assert.Equal(Teacher, material.UpdatedBy);
    }

    [Fact]
    public async Task Browsers_may_send_content_changes_from_the_allowed_origin_only()
    {
        var client = _factory.CreateClient();
        HttpRequestMessage Preflight(string origin)
        {
            var request = new HttpRequestMessage(HttpMethod.Options, "/api/classes/class-a/materials/1");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "PATCH");
            request.Headers.Add("Access-Control-Request-Headers", $"content-type,{DemoIdentity.UserHeader},{DemoIdentity.RoleHeader}");
            return request;
        }
        var allowed = await client.SendAsync(Preflight(LmsApiFactory.AllowedOrigin));
        Assert.Contains("PATCH", string.Join(",", allowed.Headers.GetValues("Access-Control-Allow-Methods")));
        var blocked = await client.SendAsync(Preflight("https://evil.example"));
        Assert.False(blocked.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task The_sync_gives_each_class_a_starter_module_and_default_weights_once()
    {
        _factory.Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/school-years"] = _ => StubIsmsHandler.Page(new { id = 2026, name = "2026-2027", status = "1", isCurrent = true }),
            ["/v1/semesters"] = _ => StubIsmsHandler.Page(new { id = 1, name = "1st Semester", status = "1", isCurrent = true }),
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(Schedule("SCH-1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))),
            ["/v1/schedules/SCH-1/students"] = _ => StubIsmsHandler.Page(IsmsFixtures.Student("S-1"), new { studentId = (string?)null, enrollmentId = "E-x" }),
        });
        Task Sync() => _factory.WithServiceAsync<IsmsReferenceSync, SyncResult>(s => s.SyncAsync(CancellationToken.None));
        await Sync();
        _factory.Time.Now += TimeSpan.FromHours(1);
        await Sync();

        var modules = await _factory.WithDbAsync(db => db.Modules.ToListAsync());
        Assert.Equal([IsmsReferenceSync.StarterModuleTitle], modules.Select(m => m.Title).ToArray());
        var weights = await _factory.WithDbAsync(db => db.GradebookSettings.SingleAsync());
        Assert.Equal((40, 60, 60), (weights.ActivityWeight, weights.ExamWeight, weights.PassingScore));
    }
}
