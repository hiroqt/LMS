using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Class and private comments on materials and coursework.</summary>
public sealed class DiscussionTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string OtherTeacher = "EMP-2";
    private const string Lia = "STU-1";
    private const string Noel = "STU-3";
    private const string Dropped = "STU-2";
    private const string Outsider = "STU-9";

    private long _materialId;
    private long _archivedId;
    private long _assignmentId;
    private long _draftId;

    private async Task SeedAsync(bool active = true) => await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.AddRange(
            new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = active },
            new IsmsClass { Id = "class-b", ScheduleId = "SCH-2", SubjectName = "Web Development 1", InstructorId = OtherTeacher, InstructorName = "Ben Cruz", IsActive = true });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Lia, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Noel, EnrollmentId = "E-3", FirstName = "Noel", LastName = "Cruz", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Dropped, EnrollmentId = "E-2", FirstName = "Mia", LastName = "Bas", IsActive = false });
        var module = new Module { ClassId = "class-a", Title = "Unit 1", SortOrder = 1 };
        db.Modules.Add(module);
        await db.SaveChangesAsync();
        var material = new Material { ClassId = "class-a", ModuleId = module.Id, Title = "Week 1 slides", Kind = "Lecture Slides" };
        var archived = new Material { ClassId = "class-a", ModuleId = module.Id, Title = "Old slides", Kind = "Lecture Slides", Status = ContentStatus.Archived };
        var assignment = new Lms.Api.Data.Coursework { ClassId = "class-a", ModuleId = module.Id, Title = "ER diagram", Status = CourseworkStatus.Published };
        var draft = new Lms.Api.Data.Coursework { ClassId = "class-a", ModuleId = module.Id, Title = "Unfinished quiz", Type = CourseworkType.Exam, Status = CourseworkStatus.Draft };
        db.AddRange(material, archived, assignment, draft);
        await db.SaveChangesAsync();
        (_materialId, _archivedId, _assignmentId, _draftId) = (material.Id, archived.Id, assignment.Id, draft.Id);
        return 0;
    });

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient Instructor(string id = Teacher) => As(id, CurrentUser.Instructor);
    private HttpClient Student(string id = Lia) => As(id, CurrentUser.Student);

    private string Material(long? id = null) => $"/api/classes/class-a/materials/{id ?? _materialId}/comments";
    private string Work(long? id = null) => $"/api/classes/class-a/coursework/{id ?? _assignmentId}/comments";

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<HttpResponseMessage> Post(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        return response;
    }

    [Fact]
    public async Task Class_comments_are_shared_by_every_enrolled_student_and_the_instructor()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.Created, (await Post(Student(Lia), Material(), new { body = "Is slide 4 on the quiz?" })).StatusCode);
        var reply = await Post(Instructor(), Material(), new { body = "Yes, slides 1 to 6." });
        Assert.Equal(HttpStatusCode.Created, reply.StatusCode);
        Assert.Equal("Ana Reyes", (await Json(reply)).GetProperty("authorName").GetString());

        foreach (var reader in new[] { Student(Noel), Student(Lia), Instructor() })
        {
            var threads = await Json(await reader.GetAsync(Material()));
            var comments = threads.GetProperty("class").EnumerateArray().ToList();
            Assert.Equal(["Is slide 4 on the quiz?", "Yes, slides 1 to 6."], comments.Select(c => c.GetProperty("body").GetString()));
            Assert.Equal(["Lia Abad", "Ana Reyes"], comments.Select(c => c.GetProperty("authorName").GetString()));
        }
    }

    [Fact]
    public async Task A_private_comment_is_seen_only_by_its_student_and_the_instructor()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.Created, (await Post(Student(Lia), Work(), new { body = "I was absent on Monday.", visibility = "private" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Post(Instructor(), Work(), new { body = "Noted, take two more days.", visibility = "private", studentId = Lia })).StatusCode);

        var lia = await Json(await Student(Lia).GetAsync(Work()));
        Assert.Empty(lia.GetProperty("class").EnumerateArray());
        var liaThread = Assert.Single(lia.GetProperty("private").EnumerateArray());
        Assert.Equal(["I was absent on Monday.", "Noted, take two more days."], liaThread.GetProperty("comments").EnumerateArray().Select(c => c.GetProperty("body").GetString()));

        // Another student sees no trace of it: only their own, empty thread.
        var noel = await Json(await Student(Noel).GetAsync(Work()));
        var noelThread = Assert.Single(noel.GetProperty("private").EnumerateArray());
        Assert.Equal(Noel, noelThread.GetProperty("studentId").GetString());
        Assert.Empty(noelThread.GetProperty("comments").EnumerateArray());

        var teacher = await Json(await Instructor().GetAsync(Work()));
        var thread = Assert.Single(teacher.GetProperty("private").EnumerateArray());
        Assert.Equal("Lia Abad", thread.GetProperty("studentName").GetString());
        Assert.Equal(2, thread.GetProperty("comments").GetArrayLength());
    }

    [Fact]
    public async Task A_student_cannot_write_in_another_students_private_thread()
    {
        await SeedAsync();
        var sent = await Post(Student(Noel), Work(), new { body = "Psst", visibility = "private", studentId = Lia });
        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        // The student id is ignored for students: it lands in Noel's own thread.
        var stored = await _factory.WithDbAsync(db => db.Comments.SingleAsync());
        Assert.Equal(Noel, stored.StudentId);

        // A private reply needs an enrolled student.
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Instructor(), Work(), new { body = "Hi", visibility = "private" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Instructor(), Work(), new { body = "Hi", visibility = "private", studentId = Dropped })).StatusCode);
    }

    [Fact]
    public async Task Only_the_class_can_read_or_write_its_comments()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Outsider).GetAsync(Material())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Dropped).GetAsync(Material())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor(OtherTeacher).GetAsync(Material())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post(Student(Outsider), Material(), new { body = "Hello" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync(Material())).StatusCode);
    }

    [Fact]
    public async Task Students_cannot_comment_on_what_they_cannot_open()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await Student().GetAsync(Material(_archivedId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post(Student(), Work(_draftId), new { body = "Hello" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Student().GetAsync(Material(999_999))).StatusCode);
        // The instructor still can.
        Assert.Equal(HttpStatusCode.OK, (await Instructor().GetAsync(Work(_draftId))).StatusCode);
    }

    [Fact]
    public async Task Comments_are_checked_and_never_copied_into_the_audit_log()
    {
        await SeedAsync();
        var empty = await Post(Student(), Material(), new { body = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Student(), Material(), new { body = new string('a', 2001) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Student(), Material(), new { body = "Hi", visibility = "everyone" })).StatusCode);

        Assert.Equal(HttpStatusCode.Created, (await Post(Student(), Material(), new { body = "My secret remark" })).StatusCode);
        var audit = await _factory.WithDbAsync(db => db.AuditLog.Where(a => a.Category == "discussion").ToListAsync());
        var entry = Assert.Single(audit);
        Assert.Equal("posted", entry.Action);
        Assert.DoesNotContain("secret", entry.Summary);
    }

    [Fact]
    public async Task Authors_delete_their_own_comments_and_the_instructor_can_delete_any()
    {
        await SeedAsync();
        var lia = (await Json(await Post(Student(Lia), Material(), new { body = "First" }))).GetProperty("id").GetInt64();
        var noel = (await Json(await Post(Student(Noel), Material(), new { body = "Second" }))).GetProperty("id").GetInt64();

        var seenByLia = (await Json(await Student(Lia).GetAsync(Material()))).GetProperty("class").EnumerateArray().ToList();
        Assert.Equal([true, false], seenByLia.Select(c => c.GetProperty("canDelete").GetBoolean()));

        Assert.Equal(HttpStatusCode.Forbidden, (await Student(Lia).DeleteAsync($"{Material()}/{noel}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Student(Lia).DeleteAsync($"{Material()}/{lia}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor().DeleteAsync($"{Material()}/{noel}")).StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Comments.CountAsync()));
    }

    [Fact]
    public async Task A_student_cannot_learn_that_another_students_private_comment_exists()
    {
        await SeedAsync();
        var id = (await Json(await Post(Student(Lia), Work(), new { body = "Private", visibility = "private" }))).GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Noel).DeleteAsync($"{Work()}/{id}")).StatusCode);
    }

    [Fact]
    public async Task Comments_are_read_only_once_ISMS_stops_offering_the_class()
    {
        await SeedAsync(active: false);
        Assert.Equal(HttpStatusCode.OK, (await Student().GetAsync(Material())).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Post(Student(), Material(), new { body = "Hello" })).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_material_deletes_its_discussion()
    {
        await SeedAsync();
        await Post(Student(), Material(), new { body = "Hello" });
        await Post(Student(), Work(), new { body = "Hi" });
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor().DeleteAsync($"/api/classes/class-a/materials/{_materialId}")).StatusCode);
        var left = await _factory.WithDbAsync(db => db.Comments.ToListAsync());
        Assert.Equal(CommentTarget.Coursework, Assert.Single(left).TargetType);
    }
}
