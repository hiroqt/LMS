using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Assignment turn-in through the API: closeAt, turnIn, grade release, drafts (D-044, contract §1–§4).</summary>
public sealed class AssignmentTests : IDisposable
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

    private static async Task<string> Refusal(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.Conflict)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"{(int)response.StatusCode}: {text}");
        return text;
    }

    private DateTimeOffset Now => _factory.Time.Now;

    private async Task<long> AssignmentAsync(object? extra = null)
    {
        var body = new Dictionary<string, object?> { ["type"] = "assignment", ["moduleId"] = _moduleId, ["title"] = "ER diagram", ["maxPoints"] = 20, ["status"] = "published" };
        foreach (var p in (extra ?? new { }).GetType().GetProperties()) body[p.Name] = p.GetValue(extra);
        return (await Json(await Instructor.PostAsJsonAsync(Base, body))).GetProperty("id").GetInt64();
    }

    private Task<HttpResponseMessage> TurnIn(HttpClient client, long id, string fileName = "er.pdf") =>
        client.PostAsJsonAsync($"{Base}/{id}/submissions", new { fileName });

    private async Task<JsonElement> TurnInStatusAsync(HttpClient client, long id) => (await Json(await client.GetAsync($"{Base}/{id}"))).GetProperty("turnIn");

    private async Task GradeAsync(long id, long submissionId, decimal points) =>
        await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/submissions/{submissionId}/grade", new { points, feedback = "Clear diagram" }));

    // ------------------------------------------------------------------------- §1 closeAt and gradeRelease

    [Fact]
    public async Task CloseAt_needs_late_work_and_a_due_date_before_it()
    {
        await SeedAsync();
        var due = Now.AddDays(2);
        await Refusal(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "A", maxPoints = 10, closeAt = due.AddDays(1) }), HttpStatusCode.BadRequest);
        Assert.Contains("Accept late work", await Refusal(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "A", maxPoints = 10, dueAt = due, closeAt = due.AddDays(1) }), HttpStatusCode.BadRequest));
        Assert.Contains("after the due date", await Refusal(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "A", maxPoints = 10, dueAt = due, allowLate = true, closeAt = due }), HttpStatusCode.BadRequest));

        var id = await AssignmentAsync(new { dueAt = due, allowLate = true, closeAt = due.AddDays(1), gradeRelease = "returned" });
        var dto = await Json(await Instructor.GetAsync($"{Base}/{id}"));
        Assert.Equal(due.AddDays(1).UtcDateTime, dto.GetProperty("closeAt").GetDateTime());
        Assert.Equal("returned", dto.GetProperty("gradeRelease").GetString());
        Assert.Equal(JsonValueKind.Null, dto.GetProperty("turnIn").ValueKind);

        // Turning late work off while a last day is set is refused; clearing the last day first works.
        await Refusal(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { allowLate = false }), HttpStatusCode.BadRequest);
        var cleared = await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { allowLate = false, clearCloseAt = true }));
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("closeAt").ValueKind);
        await Refusal(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { gradeRelease = "later" }), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Exams_refuse_assignment_only_settings()
    {
        await SeedAsync();
        var q = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Quiz" }))).GetProperty("id").GetInt64();
        var text = await Refusal(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = _moduleId, title = "Quiz", questionnaireId = q, gradeRelease = "returned", closeAt = Now.AddDays(3) }), HttpStatusCode.BadRequest);
        Assert.Contains("gradeRelease", text);
        Assert.Contains("closeAt", text);
    }

    // ------------------------------------------------------------------------- §2 turnIn

    [Fact]
    public async Task Students_get_the_servers_verdict_and_the_endpoint_follows_it()
    {
        await SeedAsync();
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due, allowLate = true, closeAt = due.AddDays(1) });

        var before = await TurnInStatusAsync(StudentA, id);
        Assert.Equal("assigned", before.GetProperty("state").GetString());
        Assert.True(before.GetProperty("canTurnIn").GetBoolean());

        _factory.Time.Now = due.AddHours(1);
        var late = await TurnInStatusAsync(StudentA, id);
        Assert.Equal(("missing", true, true), (late.GetProperty("state").GetString(), late.GetProperty("canTurnIn").GetBoolean(), late.GetProperty("late").GetBoolean()));
        var handedIn = await Json(await TurnIn(StudentA, id));
        Assert.True(handedIn.GetProperty("late").GetBoolean());
        var after = await TurnInStatusAsync(StudentA, id);
        Assert.Equal(("turned_in", "already_turned_in"), (after.GetProperty("state").GetString(), after.GetProperty("reason").GetString()));

        // Past the last day: refused with the reason's sentence, and the overview says the same.
        _factory.Time.Now = due.AddDays(1).AddMinutes(1);
        Assert.Contains("no longer accepts late work", await Refusal(await TurnIn(StudentB, id)));
        var overview = await Json(await StudentB.GetAsync("/api/me/overview"));
        var mine = overview.GetProperty("coursework").EnumerateArray().Single(c => c.GetProperty("coursework").GetProperty("id").GetInt64() == id);
        Assert.Equal("past_close", mine.GetProperty("coursework").GetProperty("turnIn").GetProperty("reason").GetString());
    }

    [Fact]
    public async Task Instructors_and_exams_get_no_verdict()
    {
        await SeedAsync();
        var id = await AssignmentAsync();
        var list = await Json(await Instructor.GetAsync(Base));
        Assert.Equal(JsonValueKind.Null, list.GetProperty("items")[0].GetProperty("turnIn").ValueKind);
        var studentList = await Json(await StudentA.GetAsync(Base));
        Assert.Equal("assigned", studentList.GetProperty("items").EnumerateArray().Single(c => c.GetProperty("id").GetInt64() == id).GetProperty("turnIn").GetProperty("state").GetString());
    }

    // ------------------------------------------------------------------------- §3 grade release

    [Fact]
    public async Task A_held_grade_reaches_the_student_only_when_returned()
    {
        await SeedAsync();
        var id = await AssignmentAsync(new { gradeRelease = "returned", allowResubmission = true });
        var submissionId = (await Json(await TurnIn(StudentA, id))).GetProperty("id").GetInt64();
        await Json(await TurnIn(StudentB, id));
        await GradeAsync(id, submissionId, 18);

        // Held: the student sees work waiting for a grade, everywhere they can read it.
        var mine = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal(("submitted", JsonValueKind.Null, JsonValueKind.Null), (mine.GetProperty("status").GetString(), mine.GetProperty("score").ValueKind, mine.GetProperty("feedback").ValueKind));
        var overview = await Json(await StudentA.GetAsync("/api/me/overview"));
        var fromOverview = overview.GetProperty("submissions").EnumerateArray().Single(s => s.GetProperty("courseworkId").GetInt64() == id).GetProperty("submission");
        Assert.Equal(JsonValueKind.Null, fromOverview.GetProperty("score").ValueKind);
        Assert.Equal("turned_in", (await TurnInStatusAsync(StudentA, id)).GetProperty("state").GetString());
        // The instructor still sees the grade, and grading progress counts it.
        var list = await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"));
        Assert.Equal(18m, list.GetProperty("items").EnumerateArray().Single(s => s.GetProperty("id").GetInt64() == submissionId).GetProperty("score").GetDecimal());
        Assert.Equal(1, (await Json(await Instructor.GetAsync($"{Base}/{id}"))).GetProperty("gradedCount").GetInt32());

        // Return to everyone graded: only Lia's work is graded, so one is returned.
        Assert.Equal(1, (await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/return", new { }))).GetProperty("returned").GetInt32());
        mine = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal(("returned", 18m, "Clear diagram"), (mine.GetProperty("status").GetString(), mine.GetProperty("score").GetDecimal(), mine.GetProperty("feedback").GetString()));
        Assert.Equal("returned", (await TurnInStatusAsync(StudentA, id)).GetProperty("state").GetString());

        // A correction keeps it returned, so the student sees it at once.
        await GradeAsync(id, submissionId, 19);
        mine = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal(("returned", 19m), (mine.GetProperty("status").GetString(), mine.GetProperty("score").GetDecimal()));
        Assert.Equal(0, (await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/return", new { studentIds = new[] { Max } }))).GetProperty("returned").GetInt32());

        var audit = await _factory.WithDbAsync(db => db.AuditLog.Where(a => a.Action == "returned").ToListAsync());
        Assert.Equal("Grades returned to 1 students", Assert.Single(audit).Summary);
    }

    [Fact]
    public async Task Immediate_release_shows_grades_as_before()
    {
        await SeedAsync();
        var id = await AssignmentAsync();
        var submissionId = (await Json(await TurnIn(StudentA, id))).GetProperty("id").GetInt64();
        await GradeAsync(id, submissionId, 15);
        var mine = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal(("graded", 15m), (mine.GetProperty("status").GetString(), mine.GetProperty("score").GetDecimal()));
    }

    [Fact]
    public async Task Return_is_for_the_class_instructor_and_assignments_only()
    {
        await SeedAsync();
        var id = await AssignmentAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PostAsJsonAsync($"{Base}/{id}/return", new { })).StatusCode);
        var q = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Quiz" }))).GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{q}/questions", new { questions = new object[] { new { type = "true_false", prompt = "SQL is a language.", points = 1, correctAnswer = true } } }));
        var exam = (await Json(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = _moduleId, title = "Quiz", questionnaireId = q, status = "published" }))).GetProperty("id").GetInt64();
        await Refusal(await Instructor.PostAsJsonAsync($"{Base}/{exam}/return", new { }));
    }

    // ------------------------------------------------------------------------- §4 drafts and the last day

    private Task<long> DraftAsync(long courseworkId, string studentId, int attemptNumber = 1) => _factory.WithDbAsync(async db =>
    {
        var draft = new Submission { CourseworkId = courseworkId, StudentId = studentId, AttemptNumber = attemptNumber, Status = SubmissionStatus.InProgress, StartedAt = Now.UtcDateTime, Text = "half done" };
        db.Submissions.Add(draft);
        await db.SaveChangesAsync();
        return draft.Id;
    });

    [Fact]
    public async Task A_draft_is_private_and_turning_in_uses_it()
    {
        await SeedAsync();
        var id = await AssignmentAsync();
        var draftId = await DraftAsync(id, Lia);

        Assert.Equal("draft", (await TurnInStatusAsync(StudentA, id)).GetProperty("state").GetString());
        var list = await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"));
        Assert.Empty(list.GetProperty("items").EnumerateArray());
        Assert.Contains(list.GetProperty("missing").EnumerateArray(), s => s.GetProperty("studentId").GetString() == Lia);
        var overview = await Json(await Instructor.GetAsync("/api/me/overview"));
        Assert.DoesNotContain(overview.GetProperty("submissions").EnumerateArray(), s => s.GetProperty("courseworkId").GetInt64() == id);

        var turnedIn = await Json(await TurnIn(StudentA, id));
        Assert.Equal((draftId, "submitted", 1), (turnedIn.GetProperty("id").GetInt64(), turnedIn.GetProperty("status").GetString(), turnedIn.GetProperty("attemptNumber").GetInt32()));
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Submissions.CountAsync(s => s.CourseworkId == id && s.StudentId == Lia)));
    }

    [Fact]
    public async Task A_draft_after_graded_work_doesnt_undo_grading_progress()
    {
        await SeedAsync();
        var id = await AssignmentAsync(new { allowResubmission = true });
        var first = (await Json(await TurnIn(StudentA, id))).GetProperty("id").GetInt64();
        await GradeAsync(id, first, 20);
        await DraftAsync(id, Lia, attemptNumber: 2);
        Assert.Equal(1, (await Json(await Instructor.GetAsync($"{Base}/{id}"))).GetProperty("gradedCount").GetInt32());
    }

    [Fact]
    public async Task Not_handed_in_grades_wait_for_the_last_day_and_skip_drafts()
    {
        await SeedAsync();
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due, allowLate = true, closeAt = due.AddDays(1) });
        await DraftAsync(id, Lia);

        _factory.Time.Now = due.AddHours(1);
        Assert.Contains("until the last day", await Refusal(await Instructor.PostAsJsonAsync($"{Base}/{id}/grade-missing", new { points = 0 })));

        _factory.Time.Now = due.AddDays(1).AddMinutes(1);
        Assert.Equal(2, (await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/grade-missing", new { points = 0 }))).GetProperty("graded").GetInt32());
        var lia = await _factory.WithDbAsync(db => db.Submissions.Where(s => s.CourseworkId == id && s.StudentId == Lia).OrderBy(s => s.AttemptNumber).Select(s => s.Status).ToListAsync());
        Assert.Equal([SubmissionStatus.InProgress, SubmissionStatus.Graded], lia);
        Assert.Equal("not_handed_in", (await TurnInStatusAsync(StudentA, id)).GetProperty("state").GetString());
    }

    [Fact]
    public async Task One_student_with_only_a_draft_can_be_graded_as_not_handed_in()
    {
        await SeedAsync();
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due });
        await DraftAsync(id, Max);
        _factory.Time.Now = due.AddHours(1);
        var graded = await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Max}/grade", new { points = 0, feedback = "Nothing handed in" }));
        Assert.Equal((true, 2), (graded.GetProperty("notHandedIn").GetBoolean(), graded.GetProperty("attemptNumber").GetInt32()));
    }
}
