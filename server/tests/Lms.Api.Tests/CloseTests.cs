using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Closing coursework once every student is graded, and grades for students who handed in nothing (D-036).</summary>
public sealed class CloseTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string Lia = "STU-1";
    private const string Max = "STU-2";
    private const string Noa = "STU-3";
    private const string Dropped = "STU-9";
    private const string Base = "/api/classes/class-a/coursework";
    private long _moduleId;

    private async Task SeedAsync(bool classActive = true) => _moduleId = await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.Add(new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = classActive });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Lia, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Max, EnrollmentId = "E-2", FirstName = "Max", LastName = "Bautista", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Noa, EnrollmentId = "E-3", FirstName = "Noa", LastName = "Cruz", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Dropped, EnrollmentId = "E-9", FirstName = "Mia", LastName = "Dela", IsActive = false });
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
    private HttpClient Student(string id) => As(id, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement;
    }

    private static async Task<JsonElement> Problem(HttpResponseMessage response, HttpStatusCode status)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == status, $"expected {(int)status}, got {(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement;
    }

    private async Task<long> AssignmentAsync(bool allowResubmission = false) =>
        (await Json(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "ER diagram", maxPoints = 20, status = "published", allowResubmission })))
        .GetProperty("id").GetInt64();

    private async Task<long> ExamAsync(bool withEssay, int maxAttempts = 1)
    {
        var questions = new List<object> { new { type = "true_false", prompt = "SQL keywords are case-sensitive.", points = 2, correctAnswer = false } };
        if (withEssay) questions.Add(new { type = "essay", prompt = "Explain normalisation.", points = 8 });
        var q = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Quiz" }))).GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{q}/questions", new { questions }));
        return (await Json(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = _moduleId, title = "SQL quiz", questionnaireId = q, status = "published", maxAttempts })))
            .GetProperty("id").GetInt64();
    }

    private async Task<long> HandInAsync(string student, long assignment) =>
        (await Json(await Student(student).PostAsJsonAsync($"{Base}/{assignment}/submissions", new { fileName = "erd.png" }))).GetProperty("id").GetInt64();

    private Task<HttpResponseMessage> GradeAsync(long coursework, long submission, decimal points) =>
        Instructor.PutAsJsonAsync($"{Base}/{coursework}/submissions/{submission}/grade", new { points });

    private Task<HttpResponseMessage> GradeMissingAsync(long coursework, string student, decimal points, string? feedback = null) =>
        Instructor.PutAsJsonAsync($"{Base}/{coursework}/students/{student}/grade", new { points, feedback });

    private Task<HttpResponseMessage> CloseAsync(long coursework) => Instructor.PostAsync($"{Base}/{coursework}/close", null);

    private static string[] Ids(JsonElement list) => list.EnumerateArray().Select(s => s.GetProperty("studentId").GetString()!).ToArray();

    [Fact]
    public async Task Closing_is_refused_with_the_students_still_to_grade_and_succeeds_once_everyone_is_graded()
    {
        await SeedAsync();
        var work = await AssignmentAsync();
        var lia = await HandInAsync(Lia, work);
        await HandInAsync(Max, work);
        await Json(await GradeAsync(work, lia, 18));

        var refused = await Problem(await CloseAsync(work), HttpStatusCode.Conflict);
        Assert.Equal([Max, Noa], Ids(refused.GetProperty("ungraded")));   // handed in but ungraded, and never handed in; not the dropped student
        Assert.Equal("Max Bautista", refused.GetProperty("ungraded")[0].GetProperty("name").GetString());
        Assert.Equal("2 of 3 students still need a grade.", refused.GetProperty("detail").GetString());

        var dto = await Json(await Instructor.GetAsync($"{Base}/{work}"));
        Assert.Equal(1, dto.GetProperty("gradedCount").GetInt32());
        Assert.Equal(3, dto.GetProperty("rosterCount").GetInt32());
        Assert.Equal("published", dto.GetProperty("status").GetString());

        var max = (await Json(await Instructor.GetAsync($"{Base}/{work}/submissions"))).GetProperty("items").EnumerateArray().Single(s => s.GetProperty("studentId").GetString() == Max).GetProperty("id").GetInt64();
        await Json(await GradeAsync(work, max, 15));
        await Json(await GradeMissingAsync(work, Noa, 0));

        var closed = await Json(await CloseAsync(work));
        Assert.Equal("closed", closed.GetProperty("status").GetString());
        Assert.Equal(3, closed.GetProperty("gradedCount").GetInt32());
        await Problem(await CloseAsync(work), HttpStatusCode.Conflict);   // already closed

        var audit = await _factory.WithDbAsync(db => db.AuditLog.Where(a => a.Category == "coursework" && a.Action == "closed").ToListAsync());
        var entry = Assert.Single(audit);
        Assert.Equal(work.ToString(), entry.TargetId);
        Assert.Equal("Assignment closed", entry.Summary);
    }

    [Fact]
    public async Task An_exam_attempt_with_an_essay_still_to_score_is_not_graded()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: true);
        var attempt = await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts", null));
        await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}/submit", null));
        await Json(await Instructor.PostAsJsonAsync($"{Base}/{exam}/grade-missing", new { points = 0 }));   // Max and Noa

        var refused = await Problem(await CloseAsync(exam), HttpStatusCode.Conflict);
        Assert.Equal([Lia], Ids(refused.GetProperty("ungraded")));
        Assert.Equal(2, (await Json(await Instructor.GetAsync($"{Base}/{exam}"))).GetProperty("gradedCount").GetInt32());
    }

    [Fact]
    public async Task For_an_assignment_the_latest_submission_must_be_graded()
    {
        await SeedAsync();
        var work = await AssignmentAsync(allowResubmission: true);
        await Json(await GradeAsync(work, await HandInAsync(Lia, work), 18));
        await HandInAsync(Lia, work);   // a new version waits for a grade
        await Json(await Instructor.PostAsJsonAsync($"{Base}/{work}/grade-missing", new { points = 0 }));

        Assert.Equal([Lia], Ids((await Problem(await CloseAsync(work), HttpStatusCode.Conflict)).GetProperty("ungraded")));
    }

    [Fact]
    public async Task Reopening_returns_closed_work_to_published_and_is_audited()
    {
        await SeedAsync();
        var work = await AssignmentAsync();
        await Json(await Instructor.PostAsJsonAsync($"{Base}/{work}/grade-missing", new { points = 0 }));
        await Json(await CloseAsync(work));

        var reopened = await Json(await Instructor.PostAsync($"{Base}/{work}/reopen", null));
        Assert.Equal("published", reopened.GetProperty("status").GetString());
        await Problem(await Instructor.PostAsync($"{Base}/{work}/reopen", null), HttpStatusCode.Conflict);   // only closed work
        Assert.Equal(1, await _factory.WithDbAsync(db => db.AuditLog.CountAsync(a => a.Action == "reopened" && a.TargetId == work.ToString())));
    }

    [Fact]
    public async Task Only_published_coursework_can_be_closed()
    {
        await SeedAsync();
        var draft = (await Json(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "Draft", maxPoints = 10 }))).GetProperty("id").GetInt64();
        var problem = await Problem(await CloseAsync(draft), HttpStatusCode.Conflict);
        Assert.Equal("Only published coursework can be closed.", problem.GetProperty("title").GetString());
        await Problem(await CloseAsync(999999), HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task The_plain_update_cannot_close_or_leave_closed()
    {
        await SeedAsync();
        var work = await AssignmentAsync();
        var refused = await Problem(await Instructor.PatchAsJsonAsync($"{Base}/{work}", new { status = "closed" }), HttpStatusCode.BadRequest);
        Assert.Contains("Close action", refused.GetProperty("errors").GetProperty("status")[0].GetString());
        Assert.Equal("published", (await Json(await Instructor.GetAsync($"{Base}/{work}"))).GetProperty("status").GetString());

        await Json(await Instructor.PostAsJsonAsync($"{Base}/{work}/grade-missing", new { points = 0 }));
        await Json(await CloseAsync(work));
        foreach (var status in new[] { "published", "draft", "archived" })
        {
            var stuck = await Problem(await Instructor.PatchAsJsonAsync($"{Base}/{work}", new { status }), HttpStatusCode.BadRequest);
            Assert.Contains("Reopen action", stuck.GetProperty("errors").GetProperty("status")[0].GetString());
        }
        Assert.Equal("closed", (await Json(await Instructor.GetAsync($"{Base}/{work}"))).GetProperty("status").GetString());
        // Other fields can still change while closed.
        Assert.Equal("ER diagram (final)", (await Json(await Instructor.PatchAsJsonAsync($"{Base}/{work}", new { title = "ER diagram (final)" }))).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Closed_work_refuses_hand_ins_and_attempts_but_stays_visible_and_grades_can_be_corrected()
    {
        await SeedAsync();
        var work = await AssignmentAsync(allowResubmission: true);
        var lia = await HandInAsync(Lia, work);
        await Json(await GradeAsync(work, lia, 18));
        var exam = await ExamAsync(withEssay: false, maxAttempts: 3);
        var attempt = await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts", null));
        await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}/submit", null));
        var open = (await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts", null))).GetProperty("id").GetInt64();   // a second attempt, left open
        foreach (var id in new[] { work, exam }) await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/grade-missing", new { points = 0 }));
        await Json(await CloseAsync(work));
        await Json(await CloseAsync(exam));

        var handIn = await Problem(await Student(Lia).PostAsJsonAsync($"{Base}/{work}/submissions", new { fileName = "v2.png" }), HttpStatusCode.Conflict);
        Assert.Equal("This assignment is closed and no longer accepts work.", handIn.GetProperty("title").GetString());
        Assert.Contains("closed", (await Problem(await Student(Lia).PostAsync($"{Base}/{exam}/attempts", null), HttpStatusCode.Conflict)).GetProperty("title").GetString());
        await Problem(await Student(Lia).PutAsJsonAsync($"{Base}/{exam}/attempts/{open}/answers", new { answers = Array.Empty<object>() }), HttpStatusCode.Conflict);
        await Problem(await Student(Lia).PostAsync($"{Base}/{exam}/attempts/{open}/submit", null), HttpStatusCode.Conflict);
        Assert.Equal(2, await _factory.WithDbAsync(db => db.Submissions.CountAsync(s => s.StudentId == Lia && s.CourseworkId == exam)));

        // Students still see closed work and their grade.
        var list = await Json(await Student(Lia).GetAsync(Base));
        Assert.Equal(["closed", "closed"], list.GetProperty("items").EnumerateArray().Select(c => c.GetProperty("status").GetString()!).ToArray());
        Assert.Equal(JsonValueKind.Null, list.GetProperty("items")[0].GetProperty("gradedCount").ValueKind);   // instructors only
        Assert.Equal(18m, (await Json(await Student(Lia).GetAsync($"{Base}/{work}/my-submissions")))[0].GetProperty("score").GetDecimal());
        var overview = await Json(await Student(Lia).GetAsync("/api/me/overview"));
        Assert.Equal(2, overview.GetProperty("coursework").GetArrayLength());

        // A correction after closing is still allowed, and audited like any grade.
        Assert.Equal(19m, (await Json(await GradeAsync(work, lia, 19))).GetProperty("score").GetDecimal());
        Assert.Equal(2, await _factory.WithDbAsync(db => db.AuditLog.CountAsync(a => a.Category == "grading" && a.Target == "Assignment" && a.TargetId == lia.ToString())));
        Assert.Equal(19m, (await Json(await Student(Lia).GetAsync($"{Base}/{work}/my-submissions")))[0].GetProperty("score").GetDecimal());
    }

    [Fact]
    public async Task The_instructor_can_grade_a_student_who_handed_in_nothing()
    {
        await SeedAsync();
        var work = await AssignmentAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await GradeMissingAsync(work, Noa, 25)).StatusCode);
        var graded = await Json(await GradeMissingAsync(work, Noa, 0, "No work received"));
        Assert.True(graded.GetProperty("notHandedIn").GetBoolean());
        Assert.Equal("graded", graded.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, graded.GetProperty("submittedAt").ValueKind);
        Assert.Equal(0m, graded.GetProperty("score").GetDecimal());

        // A correction updates the same record.
        var corrected = await Json(await GradeMissingAsync(work, Noa, 5));
        Assert.Equal(graded.GetProperty("id").GetInt64(), corrected.GetProperty("id").GetInt64());
        Assert.Equal(5m, corrected.GetProperty("score").GetDecimal());
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Submissions.CountAsync(s => s.StudentId == Noa)));

        // The student sees it as not handed in, and can no longer hand in.
        var mine = await Json(await Student(Noa).GetAsync($"{Base}/{work}/my-submissions"));
        Assert.True(mine[0].GetProperty("notHandedIn").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await Student(Noa).PostAsJsonAsync($"{Base}/{work}/submissions", new { fileName = "late.png" })).StatusCode);

        // It is no longer in the missing list; the instructor's list carries the flag.
        var list = await Json(await Instructor.GetAsync($"{Base}/{work}/submissions"));
        Assert.Equal([Lia, Max], Ids(list.GetProperty("missing")));
        Assert.True(list.GetProperty("items")[0].GetProperty("notHandedIn").GetBoolean());

        // Metadata-only audit: never the feedback.
        var audit = await _factory.WithDbAsync(db => db.AuditLog.Where(a => a.Category == "grading").ToListAsync());
        Assert.Equal(2, audit.Count);
        Assert.All(audit, a => Assert.Equal("Not handed in", a.Target));
        Assert.DoesNotContain(audit, a => a.Summary.Contains("No work received"));
    }

    [Fact]
    public async Task A_student_who_handed_in_or_started_cannot_get_a_not_handed_in_grade()
    {
        await SeedAsync();
        var work = await AssignmentAsync();
        await HandInAsync(Lia, work);
        Assert.Contains("handed in work", (await Problem(await GradeMissingAsync(work, Lia, 0), HttpStatusCode.Conflict)).GetProperty("title").GetString());

        var exam = await ExamAsync(withEssay: false);
        await Json(await Student(Max).PostAsync($"{Base}/{exam}/attempts", null));
        Assert.Contains("in progress", (await Problem(await GradeMissingAsync(exam, Max, 0), HttpStatusCode.Conflict)).GetProperty("title").GetString());

        await Problem(await GradeMissingAsync(work, Dropped, 0), HttpStatusCode.NotFound);
        await Problem(await GradeMissingAsync(work, "STU-404", 0), HttpStatusCode.NotFound);
        var draft = (await Json(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = _moduleId, title = "Draft", maxPoints = 10 }))).GetProperty("id").GetInt64();
        await Problem(await GradeMissingAsync(draft, Noa, 0), HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task A_not_handed_in_exam_grade_blocks_a_later_attempt_and_takes_plain_points()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: true, maxAttempts: 3);
        var graded = await Json(await GradeMissingAsync(exam, Noa, 0));
        var problem = await Problem(await Student(Noa).PostAsync($"{Base}/{exam}/attempts", null), HttpStatusCode.Conflict);
        Assert.Contains("without an attempt", problem.GetProperty("title").GetString());

        // Correcting through the submission's own grade action uses the points sent, not answer totals.
        var fixedUp = await Json(await Instructor.PutAsJsonAsync($"{Base}/{exam}/submissions/{graded.GetProperty("id").GetInt64()}/grade", new { points = 4 }));
        Assert.Equal(4m, fixedUp.GetProperty("score").GetDecimal());
        Assert.True(fixedUp.GetProperty("notHandedIn").GetBoolean());
    }

    [Fact]
    public async Task Giving_everyone_who_did_not_hand_in_a_grade_skips_all_other_work_and_never_overwrites()
    {
        await SeedAsync();
        var exam = await ExamAsync(withEssay: true);
        var lia = await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts", null));
        await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts/{lia.GetProperty("id").GetInt64()}/submit", null));   // waiting for the essay score
        await Json(await Student(Max).PostAsync($"{Base}/{exam}/attempts", null));                                             // in progress

        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PostAsJsonAsync($"{Base}/{exam}/grade-missing", new { points = -1 })).StatusCode);
        var result = await Json(await Instructor.PostAsJsonAsync($"{Base}/{exam}/grade-missing", new { points = 0 }));
        Assert.Equal(1, result.GetProperty("graded").GetInt32());   // only Noa; never the dropped student

        await Json(await GradeMissingAsync(exam, Noa, 3));   // the instructor corrects Noa
        var again = await Json(await Instructor.PostAsJsonAsync($"{Base}/{exam}/grade-missing", new { points = 0 }));
        Assert.Equal(0, again.GetProperty("graded").GetInt32());

        var rows = await _factory.WithDbAsync(db => db.Submissions.ToListAsync());
        Assert.Equal(SubmissionStatus.Submitted, rows.Single(s => s.StudentId == Lia).Status);
        Assert.Equal(SubmissionStatus.InProgress, rows.Single(s => s.StudentId == Max).Status);
        Assert.DoesNotContain(rows, s => s.StudentId == Dropped);
        var noa = rows.Single(s => s.StudentId == Noa);
        Assert.Equal(3m, await _factory.WithDbAsync(db => db.Grades.Where(g => g.SubmissionId == noa.Id).Select(g => g.Points).SingleAsync()));

        // One audit row for the bulk action, with the count and no student data.
        var bulk = await _factory.WithDbAsync(db => db.AuditLog.Where(a => a.Category == "grading" && a.Summary.EndsWith(" students")).ToListAsync());
        var entry = Assert.Single(bulk);
        Assert.Equal("Not handed in graded for 1 students", entry.Summary);
    }

    [Fact]
    public async Task Not_handed_in_grades_count_in_the_gradebook_like_any_graded_work()
    {
        await SeedAsync();
        await Json(await Instructor.PutAsJsonAsync("/api/classes/class-a/gradebook", new { activityWeight = 50, examWeight = 50, passingScore = 60 }));
        var work = await AssignmentAsync();
        await Json(await GradeAsync(work, await HandInAsync(Lia, work), 20));
        var exam = await ExamAsync(withEssay: false);
        var attempt = await Json(await Student(Lia).PostAsync($"{Base}/{exam}/attempts", null));
        var tf = attempt.GetProperty("questions")[0];
        var right = tf.GetProperty("options").EnumerateArray().First(o => o.GetProperty("text").GetString() == "False").GetProperty("id").GetInt64();
        await Json(await Student(Lia).PostAsJsonAsync($"{Base}/{exam}/attempts/{attempt.GetProperty("id").GetInt64()}/submit",
            new { answers = new[] { new { questionId = tf.GetProperty("id").GetInt64(), optionId = right } } }));
        await Json(await Instructor.PostAsJsonAsync($"{Base}/{work}/grade-missing", new { points = 10 }));
        await Json(await Instructor.PostAsJsonAsync($"{Base}/{exam}/grade-missing", new { points = 0 }));

        var book = await Json(await Instructor.GetAsync("/api/classes/class-a/gradebook"));
        var rows = book.GetProperty("students").EnumerateArray().ToDictionary(s => s.GetProperty("studentId").GetString()!);
        Assert.Equal(100m, rows[Lia].GetProperty("overall").GetDecimal());
        Assert.Equal(50m, rows[Noa].GetProperty("activities").GetProperty("average").GetDecimal());
        Assert.Equal(0m, rows[Noa].GetProperty("exams").GetProperty("average").GetDecimal());
        Assert.Equal(1, rows[Noa].GetProperty("exams").GetProperty("graded").GetInt32());
        Assert.Equal(25m, rows[Noa].GetProperty("overall").GetDecimal());
        Assert.False(rows[Noa].GetProperty("passed").GetBoolean());
    }

    [Fact]
    public async Task Only_the_class_instructor_can_close_reopen_or_grade_missing_work()
    {
        await SeedAsync();
        var work = await AssignmentAsync();
        var other = As("EMP-9", CurrentUser.Instructor);
        foreach (var path in new[] { "close", "reopen" })
        {
            await Problem(await Student(Lia).PostAsync($"{Base}/{work}/{path}", null), HttpStatusCode.Forbidden);
            await Problem(await other.PostAsync($"{Base}/{work}/{path}", null), HttpStatusCode.NotFound);
        }
        await Problem(await Student(Lia).PutAsJsonAsync($"{Base}/{work}/students/{Noa}/grade", new { points = 0 }), HttpStatusCode.Forbidden);
        await Problem(await Student(Lia).PostAsJsonAsync($"{Base}/{work}/grade-missing", new { points = 0 }), HttpStatusCode.Forbidden);
        await Problem(await other.PostAsJsonAsync($"{Base}/{work}/grade-missing", new { points = 0 }), HttpStatusCode.NotFound);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Submissions.CountAsync()));
    }

    [Fact]
    public async Task A_class_no_longer_offered_cannot_be_closed_or_reopened()
    {
        await SeedAsync(classActive: false);
        var id = await _factory.WithDbAsync(async db =>
        {
            var row = new Lms.Api.Data.Coursework { ClassId = "class-a", ModuleId = _moduleId, Title = "Old", Status = CourseworkStatus.Published, MaxPoints = 10 };
            db.Coursework.Add(row);
            await db.SaveChangesAsync();
            return row.Id;
        });
        await Problem(await CloseAsync(id), HttpStatusCode.Conflict);
        Assert.Equal("published", await _factory.WithDbAsync(db => db.Coursework.Where(c => c.Id == id).Select(c => c.Status).SingleAsync()));
    }
}
