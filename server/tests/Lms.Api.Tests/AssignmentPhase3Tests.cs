using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Assignments Phase 3 through the API: late penalties, a student's own dates, excused work, rubrics, the comment bank, the zip (D-062; contract §10–§13).</summary>
public sealed class AssignmentPhase3Tests : AssessmentTestBase
{
    private DateTimeOffset Now => Factory.Time.Now;

    private async Task<long> AssignmentAsync(object? extra = null)
    {
        if (ModuleId == 0) await SeedAsync();
        var body = new Dictionary<string, object?> { ["type"] = "assignment", ["moduleId"] = ModuleId, ["title"] = "ER diagram", ["maxPoints"] = 20, ["status"] = "published" };
        foreach (var p in (extra ?? new { }).GetType().GetProperties()) body[p.Name] = p.GetValue(extra);
        return (await Json(await Instructor.PostAsJsonAsync(Base, body))).GetProperty("id").GetInt64();
    }

    private static async Task<string> Refused(HttpResponseMessage response, HttpStatusCode expected)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"{(int)response.StatusCode}: {text}");
        return text;
    }

    /// <summary>Hands text in as the student and answers the submission id.</summary>
    private static async Task<long> HandInAsync(HttpClient student, long id, string text = "My answer")
    {
        await Json(await student.PutAsJsonAsync($"{Base}/{id}/draft", new { text }));
        return (await Json(await student.PostAsJsonAsync($"{Base}/{id}/draft/turn-in", new { }))).GetProperty("submission").GetProperty("id").GetInt64();
    }

    private Task<HttpResponseMessage> Grade(long id, long submissionId, object body) => Instructor.PutAsJsonAsync($"{Base}/{id}/submissions/{submissionId}/grade", body);

    private async Task<JsonElement> VerdictAsync(HttpClient client, long id) => (await Json(await client.GetAsync($"{Base}/{id}"))).GetProperty("turnIn");

    private async Task<JsonElement> RowAsync(long id, string student) =>
        (await Json(await Instructor.GetAsync("/api/classes/class-a/gradebook"))).GetProperty("students").EnumerateArray().Single(s => s.GetProperty("studentId").GetString() == student);

    // ------------------------------------------------------------------------- §10 late penalties

    [Fact]
    public async Task Penalty_settings_are_checked_and_are_for_assignments_only()
    {
        await SeedAsync();
        var due = Now.AddDays(1);
        Assert.Contains("Set a due date", await Refused(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = ModuleId, title = "A", maxPoints = 10, latePenaltyPercentPerDay = 10 }), HttpStatusCode.BadRequest));
        Assert.Contains("Accept late work", await Refused(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = ModuleId, title = "A", maxPoints = 10, dueAt = due, latePenaltyPercentPerDay = 10 }), HttpStatusCode.BadRequest));
        var bad = await Refused(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = ModuleId, title = "A", maxPoints = 10, dueAt = due, allowLate = true, latePenaltyPercentPerDay = 101, latePenaltyMaxPercent = 0 }), HttpStatusCode.BadRequest);
        Assert.Contains("0 to 100 percent a day", bad);
        Assert.Contains("1 to 100 percent", bad);

        var id = await AssignmentAsync(new { dueAt = due, allowLate = true, latePenaltyPercentPerDay = 10, latePenaltyMaxPercent = 30 });
        var dto = await Json(await StudentA.GetAsync($"{Base}/{id}"));
        Assert.Equal((10, 30), (dto.GetProperty("latePenaltyPercentPerDay").GetInt32(), dto.GetProperty("latePenaltyMaxPercent").GetInt32()));
        // Turning late work off while a penalty is set is refused.
        Assert.Contains("Accept late work", await Refused(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { allowLate = false }), HttpStatusCode.BadRequest));
        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { allowLate = false, latePenaltyPercentPerDay = 0 }));

        var set = await SetAsync(EveryType());
        var exam = await Refused(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = ModuleId, title = "Quiz", questionnaireId = set, latePenaltyPercentPerDay = 5, latePenaltyMaxPercent = 50, rubricId = 1 }), HttpStatusCode.BadRequest);
        foreach (var field in new[] { "latePenaltyPercentPerDay", "latePenaltyMaxPercent", "rubricId" }) Assert.Contains(field, exam);
    }

    [Fact]
    public async Task Late_work_loses_a_percent_per_day_and_the_grade_keeps_the_raw_points()
    {
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due, allowLate = true, latePenaltyPercentPerDay = 10, latePenaltyMaxPercent = 25 });
        var onTime = await HandInAsync(StudentA, id);
        Factory.Time.Now = due.AddDays(1).AddHours(1);     // the day after the due date in Manila: 2 days late (due 17:00, now 18:00 next day)
        var late = await HandInAsync(StudentB, id);

        var a = await Json(await Grade(id, onTime, new { points = 18 }));
        Assert.Equal((0, 0m, 18m, 18m, false), (a.GetProperty("daysLate").GetInt32(), a.GetProperty("penaltyPercent").GetDecimal(), a.GetProperty("rawScore").GetDecimal(), a.GetProperty("score").GetDecimal(), a.GetProperty("late").GetBoolean()));
        var b = await Json(await Grade(id, late, new { points = 18 }));
        Assert.Equal((1, 10m, 18m, 16.2m, true), (b.GetProperty("daysLate").GetInt32(), b.GetProperty("penaltyPercent").GetDecimal(), b.GetProperty("rawScore").GetDecimal(), b.GetProperty("score").GetDecimal(), b.GetProperty("late").GetBoolean()));
        Assert.Equal(18m, await Factory.WithDbAsync(db => db.Grades.Where(g => g.SubmissionId == late).Select(g => g.Points).SingleAsync()));

        // The student sees the same, and the gradebook counts the score after the penalty.
        var mine = (await Json(await StudentB.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal((16.2m, 18m, 10m), (mine.GetProperty("score").GetDecimal(), mine.GetProperty("rawScore").GetDecimal(), mine.GetProperty("penaltyPercent").GetDecimal()));
        Assert.Equal(81m, (await RowAsync(id, Max)).GetProperty("activities").GetProperty("average").GetDecimal());
        Assert.Equal(90m, (await RowAsync(id, Lia)).GetProperty("activities").GetProperty("average").GetDecimal());

        // Waiving it restores the raw score; un-waiving brings the penalty back. Other fields don't touch it.
        var waived = await Json(await Grade(id, late, new { points = 18, waivePenalty = true }));
        Assert.Equal((true, 0m, 18m), (waived.GetProperty("penaltyWaived").GetBoolean(), waived.GetProperty("penaltyPercent").GetDecimal(), waived.GetProperty("score").GetDecimal()));
        Assert.Equal(90m, (await RowAsync(id, Max)).GetProperty("activities").GetProperty("average").GetDecimal());
        Assert.True((await Json(await Grade(id, late, new { points = 17 }))).GetProperty("penaltyWaived").GetBoolean());
        Assert.Equal(15.3m, (await Json(await Grade(id, late, new { points = 17, waivePenalty = false }))).GetProperty("score").GetDecimal());

        // The penalty follows the settings: changing them changes every unwaived late grade, up to the cap.
        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { latePenaltyPercentPerDay = 40 }));
        var capped = (await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").EnumerateArray().Single(s => s.GetProperty("studentId").GetString() == Max);
        Assert.Equal((25m, 12.75m), (capped.GetProperty("penaltyPercent").GetDecimal(), capped.GetProperty("score").GetDecimal()));
    }

    [Fact]
    public async Task A_held_grade_hides_the_raw_score_too()
    {
        var id = await AssignmentAsync(new { gradeRelease = "returned" });
        var submission = await HandInAsync(StudentA, id);
        await Json(await Grade(id, submission, new { points = 15 }));
        var mine = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal((JsonValueKind.Null, JsonValueKind.Null), (mine.GetProperty("score").ValueKind, mine.GetProperty("rawScore").ValueKind));
    }

    // ------------------------------------------------------------------------- §11 a student's own dates

    private Task<HttpResponseMessage> Extend(long id, string student, object body) => Instructor.PutAsJsonAsync($"{Base}/{id}/students/{student}/extension", body);

    [Fact]
    public async Task An_extension_is_checked_and_only_the_class_instructor_sets_it()
    {
        var due = Now.AddDays(1);
        var id = await AssignmentAsync(new { dueAt = due });
        Assert.Contains("Choose this student's due date", await Refused(await Extend(id, Lia, new { }), HttpStatusCode.BadRequest));
        Assert.Contains("after the assignment's due date", await Refused(await Extend(id, Lia, new { dueAt = due }), HttpStatusCode.BadRequest));
        Assert.Contains("doesn't accept late work", await Refused(await Extend(id, Lia, new { dueAt = due.AddDays(2), closeAt = due.AddDays(3) }), HttpStatusCode.BadRequest));
        Assert.Equal(HttpStatusCode.NotFound, (await Extend(id, "STU-9", new { dueAt = due.AddDays(2) })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PutAsJsonAsync($"{Base}/{id}/students/{Lia}/extension", new { dueAt = due.AddDays(2) })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, "instructor").PutAsJsonAsync($"{Base}/{id}/students/{Lia}/extension", new { dueAt = due.AddDays(2) })).StatusCode);

        var late = await AssignmentAsync(new { dueAt = due, allowLate = true, closeAt = due.AddDays(1) });
        Assert.Contains("after this student's due date", await Refused(await Extend(late, Lia, new { dueAt = due.AddDays(2), closeAt = due.AddDays(2) }), HttpStatusCode.BadRequest));
        var openEnded = await AssignmentAsync(new { dueAt = due, allowLate = true });
        Assert.Contains("no last day, so this student needs none", await Refused(await Extend(openEnded, Lia, new { dueAt = due.AddDays(2), closeAt = due.AddDays(3) }), HttpStatusCode.BadRequest));
        var undated = await AssignmentAsync();
        Assert.Contains("no due date to extend", await Refused(await Extend(undated, Lia, new { dueAt = due.AddDays(2) }), HttpStatusCode.Conflict));
        var (exam, _) = await ExamAsync();
        Assert.Contains("Only assignments", await Refused(await Extend(exam, Lia, new { dueAt = due.AddDays(2) }), HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task A_students_own_due_date_decides_turn_in_late_and_the_penalty()
    {
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due, allowResubmission = true });
        var set = await Json(await Extend(id, Lia, new { dueAt = due.AddDays(3) }));
        Assert.Equal((Lia, due.AddDays(3).UtcDateTime, false), (set.GetProperty("studentId").GetString(), set.GetProperty("dueAt").GetDateTime(), set.GetProperty("excused").GetBoolean()));

        // After the class's due date: Max is refused, Lia still has time and is not late.
        Factory.Time.Now = due.AddDays(1);
        var lia = await VerdictAsync(StudentA, id);
        Assert.Equal(("assigned", true, false, true, due.AddDays(3).UtcDateTime), (lia.GetProperty("state").GetString(), lia.GetProperty("canTurnIn").GetBoolean(), lia.GetProperty("late").GetBoolean(), lia.GetProperty("extended").GetBoolean(), lia.GetProperty("dueAt").GetDateTime()));
        var max = await VerdictAsync(StudentB, id);
        Assert.Equal(("missing", "past_due", false, due.UtcDateTime), (max.GetProperty("state").GetString(), max.GetProperty("reason").GetString(), max.GetProperty("extended").GetBoolean(), max.GetProperty("dueAt").GetDateTime()));
        Assert.Contains("past its due date", await Refused(await StudentB.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Late" }), HttpStatusCode.Conflict));

        var submission = await HandInAsync(StudentA, id);
        var list = await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"));
        var item = list.GetProperty("items").EnumerateArray().Single();
        Assert.Equal((false, 0), (item.GetProperty("late").GetBoolean(), item.GetProperty("daysLate").GetInt32()));
        Assert.Equal(Lia, list.GetProperty("exceptions").EnumerateArray().Single().GetProperty("studentId").GetString());
        // Work can be taken back until the student's own due date.
        Assert.True((await VerdictAsync(StudentA, id)).GetProperty("canUnsubmit").GetBoolean());
        Assert.Equal(submission, await Factory.WithDbAsync(db => db.Submissions.Where(s => s.StudentId == Lia && s.Status == SubmissionStatus.Submitted).Select(s => s.Id).SingleAsync()));

        // The class's "not handed in" grades skip her until her own last day; hers alone is refused until then.
        await Json(await StudentA.PostAsync($"{Base}/{id}/unsubmit", null));
        Assert.Contains("their own dates", await Refused(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Lia}/grade", new { points = 0 }), HttpStatusCode.Conflict));
        var everyone = await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/grade-missing", new { points = 0 }));
        Assert.Equal((1, 1), (everyone.GetProperty("graded").GetInt32(), everyone.GetProperty("waiting").GetInt32()));

        // Removing the extension puts her back on the class's dates.
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{Base}/{id}/students/{Lia}/extension")).StatusCode);
        Assert.Equal(("past_due", false), ((await VerdictAsync(StudentA, id)).GetProperty("reason").GetString(), (await VerdictAsync(StudentA, id)).GetProperty("extended").GetBoolean()));
        Assert.Equal(0, await Factory.WithDbAsync(db => db.CourseworkExceptions.CountAsync()));
        Assert.Equal(["extended", "extension removed"], await Factory.WithDbAsync(db => db.AuditLog.Where(a => a.Target == "Assignment for one student").OrderBy(a => a.Id).Select(a => a.Action).ToListAsync()));
    }

    [Fact]
    public async Task The_penalty_counts_days_from_the_students_own_due_date()
    {
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due, allowLate = true, latePenaltyPercentPerDay = 10 });
        await Json(await Extend(id, Lia, new { dueAt = due.AddDays(2) }));
        Factory.Time.Now = due.AddDays(3);
        var lia = await HandInAsync(StudentA, id);   // 1 day after her own due date
        var max = await HandInAsync(StudentB, id);   // 3 days after the class's
        Assert.Equal((1, 9m), ((await Json(await Grade(id, lia, new { points = 10 }))).GetProperty("daysLate").GetInt32(), (await Json(await Grade(id, lia, new { points = 10 }))).GetProperty("score").GetDecimal()));
        Assert.Equal((3, 7m), ((await Json(await Grade(id, max, new { points = 10 }))).GetProperty("daysLate").GetInt32(), (await Json(await Grade(id, max, new { points = 10 }))).GetProperty("score").GetDecimal()));
    }

    // ------------------------------------------------------------------------- §11 excused

    [Fact]
    public async Task An_excused_student_is_out_of_the_count()
    {
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due });
        var other = await AssignmentAsync(new { title = "Normal forms" });
        var graded = await HandInAsync(StudentA, id);
        await Json(await Grade(id, graded, new { points = 10 }));          // 50%
        await Json(await Grade(other, await HandInAsync(StudentA, other), new { points = 20 }));   // 100%
        Assert.Equal(75m, (await RowAsync(id, Lia)).GetProperty("activities").GetProperty("average").GetDecimal());

        var excused = await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Lia}/excuse", new { }));
        Assert.True(excused.GetProperty("excused").GetBoolean());
        // Her graded work no longer counts, and she is off this assignment's roster.
        var row = await RowAsync(id, Lia);
        Assert.Equal((1, 100m), (row.GetProperty("activities").GetProperty("graded").GetInt32(), row.GetProperty("activities").GetProperty("average").GetDecimal()));
        var dto = await Json(await Instructor.GetAsync($"{Base}/{id}"));
        Assert.Equal((0, 1), (dto.GetProperty("gradedCount").GetInt32(), dto.GetProperty("rosterCount").GetInt32()));
        var verdict = await VerdictAsync(StudentA, id);
        Assert.Equal(("excused", false, "excused"), (verdict.GetProperty("state").GetString(), verdict.GetProperty("canTurnIn").GetBoolean(), verdict.GetProperty("reason").GetString()));

        // Max is excused too: nothing to hand in, nothing to grade, and the assignment can close with nobody graded.
        await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Max}/excuse", new { }));
        Assert.Contains("excused you", await Refused(await StudentB.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Mine" }), HttpStatusCode.Conflict));
        Factory.Time.Now = due.AddMinutes(1);
        Assert.Contains("is excused", await Refused(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Max}/grade", new { points = 0 }), HttpStatusCode.Conflict));
        Assert.Equal(0, (await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/grade-missing", new { points = 0 }))).GetProperty("graded").GetInt32());
        Assert.Equal("closed", (await Json(await Instructor.PostAsync($"{Base}/{id}/close", null))).GetProperty("status").GetString());
        await Json(await Instructor.PostAsync($"{Base}/{id}/reopen", null));

        // No longer excused: back in the count.
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{Base}/{id}/students/{Lia}/excuse")).StatusCode);
        Assert.Equal(75m, (await RowAsync(id, Lia)).GetProperty("activities").GetProperty("average").GetDecimal());
        Assert.Equal(1, await Factory.WithDbAsync(db => db.CourseworkExceptions.CountAsync()));
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PutAsJsonAsync($"{Base}/{id}/students/{Lia}/excuse", new { })).StatusCode);
    }

    [Fact]
    public async Task An_extension_and_an_excuse_live_in_one_row()
    {
        var due = Now.AddDays(1);
        var id = await AssignmentAsync(new { dueAt = due });
        await Json(await Extend(id, Lia, new { dueAt = due.AddDays(2) }));
        var both = await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Lia}/excuse", new { }));
        Assert.Equal((true, due.AddDays(2).UtcDateTime), (both.GetProperty("excused").GetBoolean(), both.GetProperty("dueAt").GetDateTime()));
        await Instructor.DeleteAsync($"{Base}/{id}/students/{Lia}/extension");
        Assert.Equal((true, (DateTime?)null), await Factory.WithDbAsync(async db => { var e = await db.CourseworkExceptions.SingleAsync(); return (e.Excused, e.DueAt); }));
        await Instructor.DeleteAsync($"{Base}/{id}/students/{Lia}/excuse");
        Assert.Equal(0, await Factory.WithDbAsync(db => db.CourseworkExceptions.CountAsync()));
    }

    // ------------------------------------------------------------------------- §12 rubrics

    private const string Rubrics = "/api/classes/class-a/rubrics";

    private static object LabReport(string title = "Lab report") => new
    {
        title,
        criteria = new object[]
        {
            new { title = "Analysis", description = "How well the data is explained.", levels = new object[] { new { title = "Complete", points = 10 }, new { title = "Partial", points = 5 }, new { title = "Missing", points = 0 } } },
            new { title = "Presentation", levels = new object[] { new { title = "Clear", points = 5 }, new { title = "Unclear", points = 2 } } },
        },
    };

    private async Task<JsonElement> RubricAsync(object? body = null)
    {
        if (ModuleId == 0) await SeedAsync();
        return await Json(await Instructor.PostAsJsonAsync(Rubrics, body ?? LabReport()));
    }

    private static long LevelId(JsonElement rubric, string criterion, string level) =>
        rubric.GetProperty("criteria").EnumerateArray().Single(c => c.GetProperty("title").GetString() == criterion)
            .GetProperty("levels").EnumerateArray().Single(l => l.GetProperty("title").GetString() == level).GetProperty("id").GetInt64();

    private static string CriterionId(JsonElement rubric, string criterion) =>
        rubric.GetProperty("criteria").EnumerateArray().Single(c => c.GetProperty("title").GetString() == criterion).GetProperty("id").GetInt64().ToString();

    [Fact]
    public async Task A_rubric_is_checked_and_belongs_to_the_class_instructor()
    {
        var rubric = await RubricAsync();
        Assert.Equal(("Lab report", 15m, false, 0), (rubric.GetProperty("title").GetString(), rubric.GetProperty("totalPoints").GetDecimal(), rubric.GetProperty("locked").GetBoolean(), rubric.GetProperty("usedBy").GetInt32()));
        Assert.Equal(["Complete", "Partial", "Missing"], rubric.GetProperty("criteria")[0].GetProperty("levels").EnumerateArray().Select(l => l.GetProperty("title").GetString()!).ToArray());
        Assert.Single((await Json(await Instructor.GetAsync(Rubrics))).EnumerateArray());

        Assert.Contains("at least one criterion", await Refused(await Instructor.PostAsJsonAsync(Rubrics, new { title = "Empty" }), HttpStatusCode.BadRequest));
        var bad = await Refused(await Instructor.PostAsJsonAsync(Rubrics, new { title = "", criteria = new object[] { new { title = "One level", levels = new object[] { new { title = "Only", points = 5 } } }, new { title = "", levels = new object[] { new { title = "A", points = -1 }, new { title = "", points = 2 } } } } }), HttpStatusCode.BadRequest);
        foreach (var field in new[] { "\"title\"", "criteria[0].levels", "criteria[1].title", "criteria[1].levels[0].points", "criteria[1].levels[1].title" }) Assert.Contains(field, bad);
        Assert.Contains("more than 0 points", await Refused(await Instructor.PostAsJsonAsync(Rubrics, new { title = "Zero", criteria = new object[] { new { title = "C", levels = new object[] { new { title = "A", points = 0 }, new { title = "B", points = 0 } } } } }), HttpStatusCode.BadRequest));

        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.GetAsync(Rubrics)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PostAsJsonAsync(Rubrics, LabReport())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, "instructor").GetAsync($"{Rubrics}/{rubric.GetProperty("id").GetInt64()}")).StatusCode);
    }

    [Fact]
    public async Task An_assignment_with_a_rubric_is_worth_its_total_and_is_graded_by_levels()
    {
        var rubric = await RubricAsync();
        var rubricId = rubric.GetProperty("id").GetInt64();
        Assert.Contains("this class's rubrics", await Refused(await Instructor.PostAsJsonAsync(Base, new { type = "assignment", moduleId = ModuleId, title = "A", maxPoints = 10, rubricId = 999 }), HttpStatusCode.BadRequest));
        var id = await AssignmentAsync(new { rubricId, maxPoints = 50 });
        var dto = await Json(await Instructor.GetAsync($"{Base}/{id}"));
        Assert.Equal((rubricId, 15m), (dto.GetProperty("rubricId").GetInt64(), dto.GetProperty("maxPoints").GetDecimal()));
        Assert.Equal(1, (await Json(await Instructor.GetAsync($"{Rubrics}/{rubricId}"))).GetProperty("usedBy").GetInt32());

        // Students read the rubric before they hand in, without how much it is used.
        var forStudent = await Json(await StudentA.GetAsync($"{Base}/{id}/rubric"));
        Assert.Equal((2, 0), (forStudent.GetProperty("criteria").GetArrayLength(), forStudent.GetProperty("usedBy").GetInt32()));
        var plain = await AssignmentAsync(new { title = "No rubric" });
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.GetAsync($"{Base}/{plain}/rubric")).StatusCode);

        var submission = await HandInAsync(StudentA, id);
        // Every criterion needs a level of its own, and plain points are not enough.
        Assert.Contains("Choose a level for Analysis.", await Refused(await Grade(id, submission, new { points = 12 }), HttpStatusCode.BadRequest));
        var wrong = await Refused(await Grade(id, submission, new { rubric = new Dictionary<string, long> { [CriterionId(rubric, "Analysis")] = LevelId(rubric, "Presentation", "Clear"), ["999"] = 1 } }), HttpStatusCode.BadRequest);
        Assert.Contains($"rubric[{CriterionId(rubric, "Analysis")}]", wrong);
        Assert.Contains("rubric[999]", wrong);

        var graded = await Json(await Grade(id, submission, new { points = 1, feedback = "Explain the outlier.", rubric = new Dictionary<string, long> { [CriterionId(rubric, "Analysis")] = LevelId(rubric, "Analysis", "Partial"), [CriterionId(rubric, "Presentation")] = LevelId(rubric, "Presentation", "Clear") } }));
        Assert.Equal(10m, graded.GetProperty("score").GetDecimal());
        Assert.Equal([5m, 5m], graded.GetProperty("rubricScores").EnumerateArray().Select(s => s.GetProperty("points").GetDecimal()).ToArray());
        var mine = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions")))[0];
        Assert.Equal(2, mine.GetProperty("rubricScores").GetArrayLength());

        // Regrading replaces the levels.
        var regraded = await Json(await Grade(id, submission, new { rubric = new Dictionary<string, long> { [CriterionId(rubric, "Analysis")] = LevelId(rubric, "Analysis", "Complete"), [CriterionId(rubric, "Presentation")] = LevelId(rubric, "Presentation", "Unclear") } }));
        Assert.Equal((12m, 2), (regraded.GetProperty("score").GetDecimal(), regraded.GetProperty("rubricScores").GetArrayLength()));
        Assert.Equal(2, await Factory.WithDbAsync(db => db.GradeRubricScores.CountAsync()));
    }

    [Fact]
    public async Task A_rubric_locks_once_a_grade_uses_it()
    {
        var rubric = await RubricAsync();
        var rubricId = rubric.GetProperty("id").GetInt64();
        var id = await AssignmentAsync(new { rubricId });

        // Unlocked: its criteria can change, and the assignment follows its total.
        var changed = await Json(await Instructor.PutAsJsonAsync($"{Rubrics}/{rubricId}", new { title = "Lab report v2", criteria = new object[] { new { title = "Analysis", levels = new object[] { new { title = "Complete", points = 8 }, new { title = "Missing", points = 0 } } } } }));
        Assert.Equal(("Lab report v2", 8m), (changed.GetProperty("title").GetString(), changed.GetProperty("totalPoints").GetDecimal()));
        Assert.Equal(8m, (await Json(await Instructor.GetAsync($"{Base}/{id}"))).GetProperty("maxPoints").GetDecimal());
        Assert.Contains("uses this rubric", await Refused(await Instructor.DeleteAsync($"{Rubrics}/{rubricId}"), HttpStatusCode.Conflict));

        var submission = await HandInAsync(StudentA, id);
        await Json(await Grade(id, submission, new { rubric = new Dictionary<string, long> { [CriterionId(changed, "Analysis")] = LevelId(changed, "Analysis", "Complete") } }));
        Assert.True((await Json(await Instructor.GetAsync($"{Rubrics}/{rubricId}"))).GetProperty("locked").GetBoolean());

        // Locked: a new title only; the assignment keeps it; a copy can change.
        Assert.Contains("Copy it to change its criteria", await Refused(await Instructor.PutAsJsonAsync($"{Rubrics}/{rubricId}", LabReport()), HttpStatusCode.Conflict));
        Assert.Equal("Lab report (final)", (await Json(await Instructor.PutAsJsonAsync($"{Rubrics}/{rubricId}", new { title = "Lab report (final)" }))).GetProperty("title").GetString());
        Assert.Contains("can't be added, changed, or removed", await Refused(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { clearRubric = true }), HttpStatusCode.BadRequest));
        var copy = await Json(await Instructor.PostAsync($"{Rubrics}/{rubricId}/copy", null));
        Assert.Equal(("Lab report (final) (copy)", false, 8m), (copy.GetProperty("title").GetString(), copy.GetProperty("locked").GetBoolean(), copy.GetProperty("totalPoints").GetDecimal()));
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{Rubrics}/{copy.GetProperty("id").GetInt64()}")).StatusCode);

        // A "not handed in" grade takes plain points, with or without a rubric.
        var due = Now.AddHours(1);
        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { dueAt = due }));
        Factory.Time.Now = due.AddMinutes(1);
        var notHandedIn = await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Max}/grade", new { points = 0 }));
        Assert.Equal(0m, (await Json(await Grade(id, notHandedIn.GetProperty("id").GetInt64(), new { points = 2 }))).GetProperty("rawScore").GetDecimal() - 2);
    }

    [Fact]
    public async Task A_rubric_cannot_be_added_or_resized_under_grades_already_given()
    {
        var small = (await RubricAsync()).GetProperty("id").GetInt64();   // worth 15
        var id = await AssignmentAsync(new { maxPoints = 100 });
        var submission = await HandInAsync(StudentA, id);
        await Json(await Grade(id, submission, new { points = 90 }));
        // Attaching it would make the 90 a score out of 15.
        Assert.Contains("already been graded", await Refused(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { rubricId = small }), HttpStatusCode.BadRequest));
        Assert.Equal(100m, (await Json(await Instructor.GetAsync($"{Base}/{id}"))).GetProperty("maxPoints").GetDecimal());

        // A rubric in use by an assignment that has only a plain "not handed in" grade is not locked, but its total can't change either.
        var due = Now.AddHours(1);
        var other = await AssignmentAsync(new { title = "With rubric", rubricId = small, dueAt = due });
        Factory.Time.Now = due.AddMinutes(1);
        await Json(await Instructor.PutAsJsonAsync($"{Base}/{other}/students/{Max}/grade", new { points = 3 }));
        Assert.False((await Json(await Instructor.GetAsync($"{Rubrics}/{small}"))).GetProperty("locked").GetBoolean());
        Assert.Contains("has grades", await Refused(await Instructor.PutAsJsonAsync($"{Rubrics}/{small}", new { criteria = new object[] { new { title = "Only", levels = new object[] { new { title = "A", points = 2 }, new { title = "B", points = 0 } } } } }), HttpStatusCode.Conflict));
        Assert.Equal(15m, (await Json(await Instructor.GetAsync($"{Base}/{other}"))).GetProperty("maxPoints").GetDecimal());
        // Its title can still change.
        await Json(await Instructor.PutAsJsonAsync($"{Rubrics}/{small}", new { title = "Lab report (2026)" }));
    }

    [Fact]
    public async Task A_rubric_can_be_taken_off_an_assignment_before_it_is_used()
    {
        var rubricId = (await RubricAsync()).GetProperty("id").GetInt64();
        var id = await AssignmentAsync(new { rubricId });
        var cleared = await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { clearRubric = true, maxPoints = 30 }));
        Assert.Equal((JsonValueKind.Null, 30m), (cleared.GetProperty("rubricId").ValueKind, cleared.GetProperty("maxPoints").GetDecimal()));
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{Rubrics}/{rubricId}")).StatusCode);
    }

    // ------------------------------------------------------------------------- §13 comment bank

    [Fact]
    public async Task Saved_comments_are_the_instructors_own()
    {
        await SeedAsync();
        const string bank = "/api/comment-bank";
        var first = await Json(await Instructor.PostAsJsonAsync(bank, new { text = "  Label every relationship.  " }));
        Assert.Equal("Label every relationship.", first.GetProperty("text").GetString());
        var second = await Json(await Instructor.PostAsJsonAsync(bank, new { text = "Show the cardinality." }));
        // The same text again answers the one already saved.
        Assert.Equal(first.GetProperty("id").GetInt64(), (await Json(await Instructor.PostAsJsonAsync(bank, new { text = "Label every relationship." }))).GetProperty("id").GetInt64());
        Assert.Equal(["Show the cardinality.", "Label every relationship."], (await Json(await Instructor.GetAsync(bank))).EnumerateArray().Select(c => c.GetProperty("text").GetString()!).ToArray());

        Assert.Contains("Enter a comment", await Refused(await Instructor.PostAsJsonAsync(bank, new { text = " " }), HttpStatusCode.BadRequest));
        Assert.Contains("at most 500", await Refused(await Instructor.PostAsJsonAsync(bank, new { text = new string('a', 501) }), HttpStatusCode.BadRequest));
        Assert.Equal("Show the cardinality on both ends.", (await Json(await Instructor.PutAsJsonAsync($"{bank}/{second.GetProperty("id").GetInt64()}", new { text = "Show the cardinality on both ends." }))).GetProperty("text").GetString());

        // Another instructor has their own, empty list and can't touch these; students have none.
        var other = As(OtherTeacher, "instructor");
        Assert.Empty((await Json(await other.GetAsync(bank))).EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"{bank}/{first.GetProperty("id").GetInt64()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"{bank}/{first.GetProperty("id").GetInt64()}", new { text = "Mine now" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.GetAsync(bank)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.PostAsJsonAsync(bank, new { text = "Hello" })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{bank}/{first.GetProperty("id").GetInt64()}")).StatusCode);
        Assert.Single((await Json(await Instructor.GetAsync(bank))).EnumerateArray());
    }

    // ------------------------------------------------------------------------- §13 the zip

    private static async Task Upload(HttpClient client, long id, byte[] bytes, string name)
    {
        using var form = TestFiles.Form(bytes, name);
        var response = await client.PostAsync($"{Base}/{id}/draft/files", form);
        Assert.True(response.StatusCode == HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task The_zip_holds_each_students_latest_work_in_their_own_folder()
    {
        var id = await AssignmentAsync(new { allowResubmission = true, submissionKinds = new[] { "text", "file", "link" }, title = "ER: diagram?" });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "First try", link = (string?)null }));
        await Upload(StudentA, id, TestFiles.Pdf("v1"), "old.pdf");
        await Json(await StudentA.PostAsJsonAsync($"{Base}/{id}/draft/turn-in", new { }));
        // Lia's second version replaces the first in the zip; it has two files with the same name and a link.
        await Json(await StudentA.PostAsync($"{Base}/{id}/draft", null));
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Second try", link = "https://example.edu/er" }));
        var draft = (await Json(await StudentA.GetAsync($"{Base}/{id}/my-submissions"))).EnumerateArray().Last();
        await Json(await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{draft.GetProperty("files")[0].GetProperty("id").GetInt64()}"));
        await Upload(StudentA, id, TestFiles.Pdf("v2"), "er.pdf");
        await Upload(StudentA, id, TestFiles.Pdf("v2 again"), "er.pdf");
        await Json(await StudentA.PostAsJsonAsync($"{Base}/{id}/draft/turn-in", new { }));
        // Max has a file only, and a draft on top that must not be included.
        await Upload(StudentB, id, TestFiles.Png(), "photo.png");
        await Json(await StudentB.PostAsJsonAsync($"{Base}/{id}/draft/turn-in", new { }));
        await Json(await StudentB.PostAsync($"{Base}/{id}/draft", null));
        await Upload(StudentB, id, TestFiles.Pdf("draft"), "draft.pdf");

        var response = await Instructor.GetAsync($"{Base}/{id}/submissions.zip");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/zip", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal("ER_ diagram_-work.zip", response.Content.Headers.ContentDisposition.FileNameStar);
        using var zip = new ZipArchive(await response.Content.ReadAsStreamAsync());
        Assert.Equal(
            ["Abad, Lia (STU-1)/answer.txt", "Abad, Lia (STU-1)/er (2).pdf", "Abad, Lia (STU-1)/er.pdf", "Bautista, Max (STU-2)/photo.png"],
            zip.Entries.Select(e => e.FullName).Order(StringComparer.Ordinal).ToArray());
        using (var answer = new StreamReader(zip.GetEntry("Abad, Lia (STU-1)/answer.txt")!.Open()))
            Assert.Equal("Link: https://example.edu/er\n\nSecond try\n", (await answer.ReadToEndAsync()).ReplaceLineEndings("\n"));
        using (var photo = new MemoryStream())
        {
            await zip.GetEntry("Bautista, Max (STU-2)/photo.png")!.Open().CopyToAsync(photo);
            Assert.Equal(TestFiles.Png(), photo.ToArray());
        }
        var audit = await Factory.WithDbAsync(db => db.AuditLog.SingleAsync(a => a.Action == "downloaded"));
        Assert.Equal("Work of 2 students downloaded", audit.Summary);

        Assert.Equal(HttpStatusCode.Forbidden, (await StudentA.GetAsync($"{Base}/{id}/submissions.zip")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, "instructor").GetAsync($"{Base}/{id}/submissions.zip")).StatusCode);
        var (exam, _) = await ExamAsync();
        Assert.Contains("Only an assignment", await Refused(await Instructor.GetAsync($"{Base}/{exam}/submissions.zip"), HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Students_with_the_same_long_name_get_their_own_folders_in_the_zip()
    {
        var id = await AssignmentAsync();
        var name = new string('n', 100);
        await Factory.WithDbAsync(db => db.IsmsClassStudents.ExecuteUpdateAsync(s => s.SetProperty(x => x.FirstName, name).SetProperty(x => x.LastName, name)));
        await HandInAsync(StudentA, id, "Lia's");
        await HandInAsync(StudentB, id, "Max's");
        using var zip = new ZipArchive(await (await Instructor.GetAsync($"{Base}/{id}/submissions.zip")).Content.ReadAsStreamAsync());
        var folders = zip.Entries.Select(e => e.FullName.Split('/')[0]).ToList();
        Assert.Equal(2, folders.Distinct().Count());
        Assert.Contains(folders, f => f.EndsWith("(STU-1)"));
        Assert.Contains(folders, f => f.EndsWith("(STU-2)"));
    }

    [Fact]
    public async Task The_zip_is_refused_when_the_files_add_up_to_too_much()
    {
        var id = await AssignmentAsync();
        await Upload(StudentA, id, TestFiles.Pdf(), "er.pdf");
        await Json(await StudentA.PostAsJsonAsync($"{Base}/{id}/draft/turn-in", new { }));
        // The size on record decides, so no huge file is needed to try the limit.
        await Factory.WithDbAsync(db => db.StoredFiles.ExecuteUpdateAsync(s => s.SetProperty(f => f.Size, DownloadEndpoints.MaxZipBytes + 1)));
        Assert.Contains("more than 250 MB", await Refused(await Instructor.GetAsync($"{Base}/{id}/submissions.zip"), HttpStatusCode.Conflict));
    }

    [Fact]
    public void Two_files_with_one_name_get_a_number()
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        Assert.Equal(["er.pdf", "er (2).pdf", "ER (3).pdf", "notes", "notes (2)"], new[] { "er.pdf", "er.pdf", "ER.pdf", "notes", "notes" }.Select(name => DownloadEndpoints.Unique(used, name)).ToArray());
    }
}
