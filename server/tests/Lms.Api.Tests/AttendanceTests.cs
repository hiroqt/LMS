using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Monthly attendance: the class's instructor records it, each student reads their own.</summary>
public sealed class AttendanceTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string OtherTeacher = "EMP-2";
    private const string Lia = "STU-1";
    private const string Max = "STU-2";
    private const string Dropped = "STU-3";
    private const string Outsider = "STU-9";
    private const string Base = "/api/classes/class-a/attendance";

    private async Task SeedAsync(bool active = true) => await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.AddRange(
            new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = active },
            new IsmsClass { Id = "class-b", ScheduleId = "SCH-2", SubjectName = "Web Development 1", InstructorId = OtherTeacher, InstructorName = "Ben Cruz", IsActive = true });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Lia, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Max, EnrollmentId = "E-2", FirstName = "Max", LastName = "Bautista", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Dropped, EnrollmentId = "E-3", FirstName = "Mia", LastName = "Cruz", IsActive = false });
        return await db.SaveChangesAsync();
    });

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient Instructor => As(Teacher, CurrentUser.Instructor);
    private HttpClient Student(string id = Lia) => As(id, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static object Month(int schoolDays, params (string Id, int Days)[] entries) =>
        new { schoolDays, entries = entries.Select(e => new { studentId = e.Id, daysPresent = e.Days }).ToArray() };

    private static string[] ErrorFields(JsonElement problem) =>
        problem.GetProperty("errors").EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray();

    [Fact]
    public async Task The_instructor_records_a_month_and_saving_again_updates_it()
    {
        await SeedAsync();
        var created = await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 18), (Max, 20)));
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var body = await Json(created);
        Assert.Equal(20, body.GetProperty("schoolDays").GetInt32());
        Assert.Equal(2, body.GetProperty("entries").GetArrayLength());

        // Upsert: the same month again changes its rows instead of adding new ones; Max is kept.
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(21, (Lia, 19)))).StatusCode);
        var list = await Json(await Instructor.GetAsync(Base));
        var month = Assert.Single(list.EnumerateArray());
        Assert.Equal(21, month.GetProperty("schoolDays").GetInt32());
        Assert.Equal([(Lia, 19), (Max, 20)], month.GetProperty("entries").EnumerateArray()
            .Select(e => (e.GetProperty("studentId").GetString()!, e.GetProperty("daysPresent").GetInt32())).ToArray());
        Assert.Equal(1, await _factory.WithDbAsync(db => db.AttendanceMonths.CountAsync()));
        Assert.Equal(2, await _factory.WithDbAsync(db => db.AttendanceEntries.CountAsync()));

        // Each save writes one metadata-only audit row stamped with the instructor.
        var audit = await _factory.WithDbAsync(db => db.AuditLog.OrderBy(a => a.Id).ToListAsync());
        Assert.Equal(["recorded", "updated"], audit.Select(a => a.Action).ToArray());
        Assert.All(audit, a => Assert.Equal(("attendance", "Attendance", Teacher), (a.Category, a.Target, a.ActorId)));
        var row = await _factory.WithDbAsync(db => db.AttendanceMonths.SingleAsync());
        Assert.Equal(row.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), audit[0].TargetId);
        Assert.Equal((Teacher, Teacher), (row.CreatedBy, row.UpdatedBy));
    }

    [Fact]
    public async Task School_days_and_days_present_are_checked_with_field_errors()
    {
        await SeedAsync();
        var feb = await Instructor.PutAsJsonAsync($"{Base}/2026/2", Month(29));   // 2026 is not a leap year
        Assert.Equal(HttpStatusCode.BadRequest, feb.StatusCode);
        Assert.Equal(["schoolDays"], ErrorFields(await Json(feb)));
        Assert.Equal(["schoolDays"], ErrorFields(await Json(await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(0)))));
        Assert.Equal(["month"], ErrorFields(await Json(await Instructor.PutAsJsonAsync($"{Base}/2026/13", Month(20)))));
        Assert.Equal(["year"], ErrorFields(await Json(await Instructor.PutAsJsonAsync($"{Base}/1999/10", Month(20)))));

        var bad = await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 21), (Max, -1), (Dropped, 5), (Outsider, 5), (Lia, 3)));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(["entries[0].daysPresent", "entries[1].daysPresent", "entries[2].studentId", "entries[3].studentId", "entries[4].studentId"], ErrorFields(await Json(bad)));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.AttendanceMonths.CountAsync()));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.AuditLog.CountAsync()));
    }

    [Fact]
    public async Task Lowering_school_days_below_a_saved_entry_is_refused_and_names_the_student()
    {
        await SeedAsync();
        await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(22, (Lia, 22), (Max, 15)));
        var lowered = await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20));
        Assert.Equal(HttpStatusCode.BadRequest, lowered.StatusCode);
        var message = (await Json(lowered)).GetProperty("errors").GetProperty("schoolDays")[0].GetString()!;
        Assert.Contains("Lia Abad", message);
        Assert.DoesNotContain("Max", message);
        Assert.Equal(22, await _factory.WithDbAsync(db => db.AttendanceMonths.Select(m => m.SchoolDays).SingleAsync()));

        // Lowering Lia's days in the same call makes it valid.
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 20)))).StatusCode);
    }

    [Fact]
    public async Task A_student_reads_only_their_own_days_and_cannot_write()
    {
        await SeedAsync();
        await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 18), (Max, 10)));
        await Instructor.PutAsJsonAsync($"{Base}/2026/11", Month(19, (Max, 19)));

        var mine = await Json(await Student(Lia).GetAsync(Base));
        Assert.Equal([(2026, 11), (2026, 10)], mine.EnumerateArray().Select(m => (m.GetProperty("year").GetInt32(), m.GetProperty("month").GetInt32())).ToArray());
        Assert.Equal(0, mine[0].GetProperty("entries").GetArrayLength());
        var entry = Assert.Single(mine[1].GetProperty("entries").EnumerateArray());
        Assert.Equal((Lia, 18), (entry.GetProperty("studentId").GetString(), entry.GetProperty("daysPresent").GetInt32()));
        Assert.DoesNotContain(Max, mine.GetRawText());

        Assert.Equal(HttpStatusCode.Forbidden, (await Student(Lia).PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 20)))).StatusCode);
        Assert.Equal(18, await _factory.WithDbAsync(db => db.AttendanceEntries.Where(e => e.StudentId == Lia).Select(e => e.DaysPresent).SingleAsync()));
    }

    [Fact]
    public async Task People_outside_the_class_get_404()
    {
        await SeedAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, CurrentUser.Instructor).GetAsync(Base)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, CurrentUser.Instructor).PutAsJsonAsync($"{Base}/2026/10", Month(20))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Dropped).GetAsync(Base)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Outsider).GetAsync(Base)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.GetAsync("/api/classes/no-such-class/attendance")).StatusCode);
    }

    [Fact]
    public async Task A_class_ISMS_no_longer_offers_is_read_only()
    {
        await SeedAsync(active: false);
        var write = await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 18)));
        Assert.Equal(HttpStatusCode.Conflict, write.StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.AttendanceMonths.CountAsync()));
        Assert.Equal(HttpStatusCode.OK, (await Instructor.GetAsync(Base)).StatusCode);
    }

    [Fact]
    public async Task The_overview_carries_attendance_scoped_to_the_viewer_and_leaves_the_gradebook_alone()
    {
        await SeedAsync();
        await Instructor.PutAsJsonAsync($"{Base}/2026/10", Month(20, (Lia, 18), (Max, 10)));
        await As(OtherTeacher, CurrentUser.Instructor).PutAsJsonAsync("/api/classes/class-b/attendance/2026/10", Month(20));

        var ana = await Instructor.GetFromJsonAsync<JsonElement>("/api/me/overview");
        var item = Assert.Single(ana.GetProperty("attendance").EnumerateArray());
        Assert.Equal("class-a", item.GetProperty("classId").GetString());
        Assert.Equal(2, item.GetProperty("month").GetProperty("entries").GetArrayLength());

        var lia = await Student(Lia).GetFromJsonAsync<JsonElement>("/api/me/overview");
        var own = Assert.Single(lia.GetProperty("attendance").EnumerateArray()).GetProperty("month");
        Assert.Equal(18, Assert.Single(own.GetProperty("entries").EnumerateArray()).GetProperty("daysPresent").GetInt32());

        // Recorded only: the gradebook has no attendance in it.
        var gradebook = await Instructor.GetAsync("/api/classes/class-a/gradebook");
        Assert.DoesNotContain("attendance", await gradebook.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }
}
