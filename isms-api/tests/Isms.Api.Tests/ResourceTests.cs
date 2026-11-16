using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Isms.Api.Tests;

public class ResourceTests(IsmsApiFactory factory) : IClassFixture<IsmsApiFactory>
{
    private async Task<JsonElement> GetJson(string route)
    {
        var response = await factory.FullAccessClient().GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static string[] PropertyNames(JsonElement e) => e.EnumerateObject().Select(p => p.Name).ToArray();

    [Fact]
    public async Task Subjects_default_page_and_shape()
    {
        var body = await GetJson("/v1/subjects");
        Assert.Equal(["items", "page", "pageSize", "total"], PropertyNames(body));
        Assert.Equal(1, body.GetProperty("page").GetInt32());
        Assert.Equal(50, body.GetProperty("pageSize").GetInt32());
        Assert.Equal(121, body.GetProperty("total").GetInt32());
        Assert.Equal(50, body.GetProperty("items").GetArrayLength());
        var first = body.GetProperty("items")[0];
        Assert.Equal(["id", "code", "name", "units", "status"], PropertyNames(first));
    }

    [Fact]
    public async Task Subjects_status_filter()
    {
        var body = await GetJson("/v1/subjects?status=0");
        Assert.Equal(1, body.GetProperty("total").GetInt32());
        var item = body.GetProperty("items")[0];
        Assert.Equal(1000, item.GetProperty("id").GetInt32());
        Assert.Equal("RET100", item.GetProperty("code").GetString());
        Assert.Equal(2, item.GetProperty("units").GetInt32());
        Assert.Equal("0", item.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Pagination_last_page_and_max_size()
    {
        var page3 = await GetJson("/v1/subjects?page=3&pageSize=50");
        Assert.Equal(21, page3.GetProperty("items").GetArrayLength());
        var max = await GetJson("/v1/subjects?pageSize=200");
        Assert.Equal(121, max.GetProperty("items").GetArrayLength());
        var beyond = await GetJson("/v1/subjects?page=99");
        Assert.Equal(0, beyond.GetProperty("items").GetArrayLength());
        Assert.Equal(121, beyond.GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData("/v1/subjects?pageSize=201")]
    [InlineData("/v1/subjects?pageSize=0")]
    [InlineData("/v1/subjects?page=0")]
    [InlineData("/v1/subjects?page=-1")]
    [InlineData("/v1/instructors?pageSize=1000")]
    [InlineData("/v1/schedules?pageSize=201")]
    public async Task Pagination_out_of_bounds_is_400_problem(string route)
    {
        var response = await factory.FullAccessClient().GetAsync(route);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Instructors_only_scheduled_employees_without_personal_fields()
    {
        var response = await factory.FullAccessClient().GetAsync("/v1/instructors");
        var raw = await response.Content.ReadAsStringAsync();
        var body = JsonDocument.Parse(raw).RootElement;
        var items = body.GetProperty("items").EnumerateArray().ToList();

        Assert.Equal(["EMP-B", "EMP-A"], items.Select(i => i.GetProperty("id").GetString()));  // Cruz, Reyes; Diaz has no schedule
        foreach (var item in items)
        {
            Assert.Equal(
                ["id", "employeeNo", "firstName", "middleName", "lastName", "suffix", "honorific", "departmentId", "status"],
                PropertyNames(item));
        }
        foreach (var forbidden in new[] { "bdate", "birth", "sex", "address", "contact", "email", "username", "userName" })
            Assert.DoesNotContain(forbidden, raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Schedules_one_item_per_offering_with_grouped_meetings()
    {
        var body = await GetJson("/v1/schedules");
        Assert.Equal(3, body.GetProperty("total").GetInt32());
        var first = body.GetProperty("items")[0];
        Assert.Equal(
            ["scheduleId", "schoolYearId", "semesterId", "sectionId", "sectionName", "subjectId", "subjectCode", "subjectName",
             "instructorId", "instructorName", "meetings"],
            PropertyNames(first));
        Assert.Equal("SCH-1", first.GetProperty("scheduleId").GetString());
        Assert.Equal(1, first.GetProperty("subjectId").GetInt32());
        Assert.Equal("SUB001", first.GetProperty("subjectCode").GetString());
        Assert.Equal("BSIT 1-A", first.GetProperty("sectionName").GetString());
        Assert.Equal("EMP-A", first.GetProperty("instructorId").GetString());
        Assert.Equal("Ana Reyes", first.GetProperty("instructorName").GetString());
        var meetings = first.GetProperty("meetings");
        Assert.Equal(2, meetings.GetArrayLength());
        Assert.Equal(["day", "timeFrom", "timeTo", "roomId", "modality"], PropertyNames(meetings[0]));
        Assert.Equal("08:00", meetings[0].GetProperty("timeFrom").GetString());
        Assert.Equal("09:30", meetings[0].GetProperty("timeTo").GetString());
        Assert.Equal(101, meetings[0].GetProperty("roomId").GetInt32());
    }

    [Fact]
    public async Task Schedules_filters()
    {
        Assert.Equal(2, (await GetJson("/v1/schedules?instructorId=EMP-B")).GetProperty("total").GetInt32());
        Assert.Equal(1, (await GetJson("/v1/schedules?semesterId=2")).GetProperty("total").GetInt32());
        Assert.Equal(1, (await GetJson("/v1/schedules?subjectId=2&schoolYearId=1")).GetProperty("total").GetInt32());
        Assert.Equal(0, (await GetJson("/v1/schedules?schoolYearId=2")).GetProperty("total").GetInt32());
        var paged = await GetJson("/v1/schedules?pageSize=1&page=2");
        Assert.Equal(1, paged.GetProperty("items").GetArrayLength());
        Assert.Equal(3, paged.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Schedule_students_and_404()
    {
        var body = await GetJson("/v1/schedules/SCH-1/students");
        var items = body.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(["Marco", "Lia"], items.Select(i => i.GetProperty("firstName").GetString())); // Lim, Torres
        Assert.Equal(["studentId", "enrollmentId", "firstName", "middleName", "lastName"], PropertyNames(items[0]));
        Assert.Equal("STU-2", items[0].GetProperty("studentId").GetString());
        Assert.Equal("ENR-2", items[0].GetProperty("enrollmentId").GetString());

        Assert.Equal(0, (await GetJson("/v1/schedules/SCH-2/students")).GetProperty("total").GetInt32());

        var missing = await factory.FullAccessClient().GetAsync("/v1/schedules/NOPE/students");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("application/problem+json", missing.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task School_years_and_semesters()
    {
        var years = (await GetJson("/v1/school-years")).GetProperty("items");
        Assert.Equal("2025-2026", years[0].GetProperty("name").GetString());
        Assert.True(years[0].GetProperty("isCurrent").GetBoolean());
        Assert.False(years[1].GetProperty("isCurrent").GetBoolean());
        Assert.Equal(["id", "name", "status", "standing", "isCurrent"], PropertyNames(years[0]));

        var sems = (await GetJson("/v1/semesters")).GetProperty("items");
        Assert.Equal("First Semester", sems[0].GetProperty("name").GetString());
        Assert.True(sems[0].GetProperty("isCurrent").GetBoolean());
    }
}
