using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Classes;
using static Lms.Api.Tests.IsmsFixtures;

namespace Lms.Api.Tests;

public sealed class ApiTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private StubIsmsHandler Isms => _factory.Isms;

    private static async Task<JsonElement> JsonOf(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    // ---------- happy paths ----------

    [Fact]
    public async Task Classes_map_ISMS_schedules_and_group_by_schedule_subject_instructor()
    {
        Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(
                // Same offering split across two rows (one per meeting) plus a duplicate meeting.
                Schedule("SCH-1", 101, "EMP-7", Meeting("Mon", "08:00", "09:30")),
                Schedule("SCH-1", 101, "EMP-7", Meeting("Wed", "08:00", "09:30"), Meeting("Mon", "08:00", "09:30")),
                // Same schedule, different instructor: a separate class.
                Schedule("SCH-1", 101, "EMP-9", Meeting("Fri", "13:00", "14:30")),
                Schedule("SCH-2", 202, "EMP-7")),
        });

        var response = await _factory.CreateClient().GetAsync("/api/classes");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonOf(response);
        Assert.Equal("isms", body.GetProperty("source").GetString());
        Assert.Equal(_factory.Time.Now, body.GetProperty("syncedAt").GetDateTimeOffset());

        var items = body.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(3, items.Count);

        var santos = items.Single(i => i.GetProperty("subjectId").GetInt32() == 101 && i.GetProperty("instructorId").GetString() == "EMP-7");
        Assert.Equal(ClassId.Create("SCH-1", 101, "EMP-7"), santos.GetProperty("id").GetString());
        Assert.Equal("SCH-1", santos.GetProperty("scheduleId").GetString());
        Assert.Equal("IT 201", santos.GetProperty("subjectCode").GetString());
        Assert.Equal("Data Structures", santos.GetProperty("subjectName").GetString());
        Assert.Equal(31, santos.GetProperty("sectionId").GetInt32());
        Assert.Equal("BSIT 2-A", santos.GetProperty("sectionName").GetString());
        Assert.Equal("Santos, Maria", santos.GetProperty("instructorName").GetString());
        Assert.Equal(2026, santos.GetProperty("schoolYearId").GetInt32());
        Assert.Equal(1, santos.GetProperty("semesterId").GetInt32());

        var meetings = santos.GetProperty("meetings").EnumerateArray().ToList();
        Assert.Equal(2, meetings.Count);
        Assert.Equal(["Mon", "Wed"], meetings.Select(m => m.GetProperty("day").GetString()));
        Assert.Equal("08:00", meetings[0].GetProperty("timeFrom").GetString());
        Assert.Equal("09:30", meetings[0].GetProperty("timeTo").GetString());
        Assert.Equal(12, meetings[0].GetProperty("roomId").GetInt32());
        Assert.Equal(1, meetings[0].GetProperty("modality").GetInt32());
        Assert.False(meetings[0].TryGetProperty("unknownMeetingField", out _));

        // Ids are URL-safe and unique.
        var ids = items.Select(i => i.GetProperty("id").GetString()!).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.All(ids, id => Assert.Equal(Uri.EscapeDataString(id), id));
    }

    [Fact]
    public async Task Classes_pass_term_filters_to_ISMS_and_filter_instructors_locally()
    {
        Isms.Responder = _ => StubIsmsHandler.Page(
            Schedule("SCH 1", 101, "EMP-7", Meeting("MW", "08:00", "09:30")),
            Schedule("SCH 1", 102, "EMP-9", Meeting("TTH", "08:00", "09:30")));

        var response = await _factory.CreateClient().GetAsync("/api/classes?instructorId=EMP-7&schoolYearId=2026&semesterId=2");

        var query = Isms.RequestsTo("/v1/schedules").Single().RequestUri!.Query;
        Assert.Contains("schoolYearId=2026", query);
        Assert.Contains("semesterId=2", query);
        Assert.Contains("pageSize=200", query);
        // Free text from the caller is never forwarded (it would become a cache key).
        Assert.DoesNotContain("instructorId", query);
        var items = (await JsonOf(response)).GetProperty("items");
        Assert.Equal(1, items.GetArrayLength());
        Assert.Equal("EMP-7", items[0].GetProperty("instructorId").GetString());
    }

    [Fact]
    public async Task Term_current_limits_classes_to_the_term_ISMS_flags_as_current()
    {
        Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/school-years"] = _ => StubIsmsHandler.Page(
                new { id = 1, name = "2025-2026", status = "1", isCurrent = false },
                new { id = 2, name = "2026-2027", status = "1", isCurrent = true }),
            ["/v1/semesters"] = _ => StubIsmsHandler.Page(
                new { id = 1, name = "1st Semester", status = "1", isCurrent = true },
                new { id = 2, name = "2nd Semester", status = "1", isCurrent = false }),
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(Schedule("SCH 1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))),
        });

        var body = await JsonOf(await _factory.CreateClient().GetAsync("/api/classes?term=current"));

        var query = Isms.RequestsTo("/v1/schedules").Single().RequestUri!.Query;
        Assert.Contains("schoolYearId=2", query);
        Assert.Contains("semesterId=1", query);
        var term = body.GetProperty("term");
        Assert.Equal("2026-2027", term.GetProperty("schoolYearName").GetString());
        Assert.Equal("1st Semester", term.GetProperty("semesterName").GetString());
    }

    [Fact]
    public async Task Term_current_filters_nothing_when_ISMS_flags_no_current_term()
    {
        Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/school-years"] = _ => StubIsmsHandler.Page(new { id = 1, name = "2025-2026", status = "1", isCurrent = false }),
            ["/v1/semesters"] = _ => StubIsmsHandler.Page(new { id = 1, name = "1st Semester", status = "1", isCurrent = true }),
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(Schedule("SCH 1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))),
        });

        var body = await JsonOf(await _factory.CreateClient().GetAsync("/api/classes?term=current"));

        var query = Isms.RequestsTo("/v1/schedules").Single().RequestUri!.Query;
        Assert.DoesNotContain("schoolYearId", query);
        Assert.DoesNotContain("semesterId", query);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, body.GetProperty("term").ValueKind);
        Assert.Equal(1, body.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task Class_students_come_from_the_classes_ISMS_schedule()
    {
        Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(Schedule("SCH 1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))),
            ["/v1/schedules/SCH%201/students"] = _ => StubIsmsHandler.Page(Student("S-1"), Student("S-2")),
        });
        var id = ClassId.Create("SCH 1", 101, "EMP-7");

        var response = await _factory.CreateClient().GetAsync($"/api/classes/{id}/students");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonOf(response);
        Assert.Equal("isms", body.GetProperty("source").GetString());
        var first = body.GetProperty("items")[0];
        Assert.Equal("S-1", first.GetProperty("studentId").GetString());
        Assert.Equal("ENR-S-1", first.GetProperty("enrollmentId").GetString());
        Assert.Equal("Ana", first.GetProperty("firstName").GetString());
        Assert.Equal("B", first.GetProperty("middleName").GetString());
        Assert.Equal("Cruz", first.GetProperty("lastName").GetString());
        Assert.False(first.TryGetProperty("yearLevel", out _));
    }

    [Fact]
    public async Task A_well_formed_id_for_a_class_ISMS_does_not_have_is_a_404_and_never_asks_for_students()
    {
        Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/schedules"] = _ => StubIsmsHandler.Page(Schedule("SCH 1", 101, "EMP-7", Meeting("MW", "08:00", "09:30"))),
            ["/v1/schedules/SCH%201/students"] = _ => StubIsmsHandler.Page(Student("S-1")),
        });
        // Same schedule, but a subject and instructor that are not offered together.
        var edited = ClassId.Create("SCH 1", 999, "EMP-0");

        var response = await _factory.CreateClient().GetAsync($"/api/classes/{edited}/students");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(Isms.RequestsTo("/v1/schedules/SCH%201/students"));
    }

    [Fact]
    public async Task Unknown_class_id_is_a_404_problem()
    {
        var response = await _factory.CreateClient().GetAsync("/api/classes/not-a-real-id!/students");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Empty(Isms.Requests);
    }

    [Fact]
    public async Task Subjects_and_instructors_keep_the_ISMS_item_shape()
    {
        Isms.Responder = StubIsmsHandler.Routes(new()
        {
            ["/v1/subjects"] = _ => StubIsmsHandler.Page(Subject(101, "IT 201", "Data Structures"), Subject(102, null, "Seminar")),
            ["/v1/instructors"] = _ => StubIsmsHandler.Page(Instructor("EMP-7")),
        });
        var client = _factory.CreateClient();

        var subjects = await JsonOf(await client.GetAsync("/api/subjects"));
        var subject = subjects.GetProperty("items")[1];
        Assert.Equal(102, subject.GetProperty("id").GetInt32());
        Assert.Equal(JsonValueKind.Null, subject.GetProperty("code").ValueKind);
        Assert.Equal("Seminar", subject.GetProperty("name").GetString());
        Assert.Equal(3, subject.GetProperty("units").GetInt32());
        Assert.Equal("active", subject.GetProperty("status").GetString());
        Assert.Equal("isms", subjects.GetProperty("source").GetString());

        var instructors = await JsonOf(await client.GetAsync("/api/instructors"));
        var instructor = instructors.GetProperty("items")[0];
        Assert.Equal("EMP-7", instructor.GetProperty("id").GetString());
        Assert.Equal("E-0007", instructor.GetProperty("employeeNo").GetString());
        Assert.Equal("Santos", instructor.GetProperty("lastName").GetString());
        Assert.Equal("Dr.", instructor.GetProperty("honorific").GetString());
        Assert.Equal("D04", instructor.GetProperty("departmentId").GetString());
        Assert.False(instructor.TryGetProperty("email", out _));
    }

    // ---------- the ISMS call itself ----------

    [Fact]
    public async Task Every_ISMS_request_carries_client_id_and_api_key()
    {
        Isms.Responder = _ => StubIsmsHandler.Page();
        var client = _factory.CreateClient();

        await client.GetAsync("/api/subjects");
        await client.GetAsync("/api/instructors");
        await client.GetAsync("/api/classes");
        await client.GetAsync("/api/isms/status");

        Assert.Equal(4, Isms.Requests.Count);
        Assert.All(Isms.Requests, r =>
        {
            Assert.Equal(LmsApiFactory.ClientId, r.Headers.GetValues("X-Client-Id").Single());
            Assert.Equal(LmsApiFactory.ApiKey, r.Headers.GetValues("X-Api-Key").Single());
        });
    }

    [Fact]
    public async Task Paging_follows_every_ISMS_page()
    {
        Isms.Responder = req =>
        {
            var page = int.Parse(System.Web.HttpUtility.ParseQueryString(req.RequestUri!.Query)["page"]!);
            var items = page switch
            {
                1 => new[] { Subject(1, "A", "A"), Subject(2, "B", "B") },
                2 => new[] { Subject(3, "C", "C"), Subject(4, "D", "D") },
                3 => new[] { Subject(5, "E", "E") },
                _ => throw new InvalidOperationException("asked for a page past the end"),
            };
            return StubIsmsHandler.Json(new { items, page, pageSize = 2, total = 5 });
        };

        var body = await JsonOf(await _factory.CreateClient().GetAsync("/api/subjects"));

        Assert.Equal([1, 2, 3, 4, 5], body.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()));
        Assert.Equal(3, Isms.Requests.Count);
    }

    [Fact]
    public async Task Transient_ISMS_failure_is_retried()
    {
        var calls = 0;
        Isms.Responder = _ => ++calls == 1
            ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
            : StubIsmsHandler.Page(Subject(1, "A", "A"));

        var response = await _factory.CreateClient().GetAsync("/api/subjects");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, calls);
    }

    // ---------- failures ----------

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "isms_unauthorized")]
    [InlineData(HttpStatusCode.Forbidden, "isms_forbidden")]
    public async Task ISMS_credential_rejection_is_a_502_problem(HttpStatusCode ismsStatus, string code)
    {
        Isms.Responder = _ => new HttpResponseMessage(ismsStatus);

        var response = await _factory.CreateClient().GetAsync("/api/classes");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await JsonOf(response);
        Assert.Equal(502, problem.GetProperty("status").GetInt32());
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.Equal((int)ismsStatus, problem.GetProperty("ismsStatus").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("detail").GetString()));
        Assert.Single(Isms.Requests); // 401/403 are not retried
    }

    [Fact]
    public async Task ISMS_down_without_cache_is_a_503_problem()
    {
        Isms.Responder = _ => throw new HttpRequestException("Connection refused (isms.test:80)");

        var response = await _factory.CreateClient().GetAsync("/api/subjects");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.Contains("Retry-After"));
        Assert.Equal("isms_unavailable", (await JsonOf(response)).GetProperty("code").GetString());
        Assert.Equal(3, Isms.Requests.Count); // 1 attempt + 2 retries
    }

    [Fact]
    public async Task ISMS_down_with_cache_serves_the_stale_copy()
    {
        Isms.Responder = _ => StubIsmsHandler.Page(Subject(1, "A", "Algebra"));
        var client = _factory.CreateClient();
        var fetchedAt = _factory.Time.Now;
        await client.GetAsync("/api/subjects");

        _factory.Time.Now = fetchedAt.AddMinutes(10); // past the 5-minute TTL, inside MaxStale
        Isms.Responder = _ => throw new HttpRequestException("down");

        var response = await client.GetAsync("/api/subjects");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonOf(response);
        Assert.Equal("Algebra", body.GetProperty("items")[0].GetProperty("name").GetString());
        Assert.Equal(fetchedAt, body.GetProperty("syncedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Stale_copy_is_not_served_once_too_old()
    {
        Isms.Responder = _ => StubIsmsHandler.Page(Subject(1, "A", "Algebra"));
        var client = _factory.CreateClient();
        await client.GetAsync("/api/subjects");

        _factory.Time.Now = _factory.Time.Now.AddHours(2); // TTL 5 min + MaxStale 1 h exceeded
        Isms.Responder = _ => throw new HttpRequestException("down");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/api/subjects")).StatusCode);
    }

    [Fact]
    public async Task Fresh_cache_does_not_call_ISMS_again()
    {
        Isms.Responder = _ => StubIsmsHandler.Page(Subject(1, "A", "Algebra"));
        var client = _factory.CreateClient();

        var first = await JsonOf(await client.GetAsync("/api/subjects"));
        _factory.Time.Now = _factory.Time.Now.AddMinutes(4);
        var second = await JsonOf(await client.GetAsync("/api/subjects"));

        Assert.Single(Isms.Requests);
        Assert.Equal(first.GetProperty("syncedAt").GetDateTimeOffset(), second.GetProperty("syncedAt").GetDateTimeOffset());

        _factory.Time.Now = _factory.Time.Now.AddMinutes(2); // now past the TTL
        var third = await JsonOf(await client.GetAsync("/api/subjects"));
        Assert.Equal(2, Isms.Requests.Count);
        Assert.Equal(_factory.Time.Now, third.GetProperty("syncedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Credential_errors_are_not_masked_by_stale_data()
    {
        Isms.Responder = _ => StubIsmsHandler.Page(Subject(1, "A", "Algebra"));
        var client = _factory.CreateClient();
        await client.GetAsync("/api/subjects");

        _factory.Time.Now = _factory.Time.Now.AddMinutes(10);
        Isms.Responder = _ => new HttpResponseMessage(HttpStatusCode.Unauthorized);

        Assert.Equal(HttpStatusCode.BadGateway, (await client.GetAsync("/api/subjects")).StatusCode);
    }

    [Fact]
    public async Task The_api_key_never_appears_in_any_response()
    {
        var scenarios = new Func<HttpRequestMessage, HttpResponseMessage>[]
        {
            _ => StubIsmsHandler.Page(),
            _ => new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent($"bad key {LmsApiFactory.ApiKey}") },
            _ => new HttpResponseMessage(HttpStatusCode.Forbidden) { Content = new StringContent($"client {LmsApiFactory.ClientId} key {LmsApiFactory.ApiKey}") },
            _ => new HttpResponseMessage(HttpStatusCode.InternalServerError) { Content = new StringContent(LmsApiFactory.ApiKey) },
            _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent($"{{not json {LmsApiFactory.ApiKey}") },
            _ => throw new HttpRequestException($"failed with key {LmsApiFactory.ApiKey}"),
        };
        var paths = new[] { "/api/classes", "/api/classes/" + ClassId.Create("S", 1, "I") + "/students", "/api/subjects", "/api/instructors", "/api/isms/status" };

        foreach (var scenario in scenarios)
        {
            using var factory = new LmsApiFactory();
            factory.Isms.Responder = scenario;
            var client = factory.CreateClient();
            foreach (var path in paths)
            {
                var response = await client.GetAsync(path);
                var text = await response.Content.ReadAsStringAsync();
                Assert.DoesNotContain(LmsApiFactory.ApiKey, text);
                Assert.DoesNotContain(LmsApiFactory.ApiKey, response.Headers.ToString());
            }
        }
    }

    // ---------- status ----------

    [Theory]
    [InlineData(200, true, true)]
    [InlineData(401, true, false)]
    [InlineData(403, true, false)]
    [InlineData(null, false, false)]
    public async Task Status_reports_reachability_and_authorization(int? ismsStatus, bool reachable, bool authorized)
    {
        Isms.Responder = ismsStatus is { } s
            ? _ => s == 200 ? StubIsmsHandler.Page() : new HttpResponseMessage((HttpStatusCode)s)
            : _ => throw new HttpRequestException("down");

        var response = await _factory.CreateClient().GetAsync("/api/isms/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonOf(response);
        Assert.Equal(reachable, body.GetProperty("reachable").GetBoolean());
        Assert.Equal(authorized, body.GetProperty("authorized").GetBoolean());
        Assert.Equal(_factory.Time.Now, body.GetProperty("checkedAt").GetDateTimeOffset());
        var detail = body.GetProperty("detail").GetString()!;
        Assert.NotEmpty(detail);
        Assert.DoesNotContain("isms.test", detail);
    }

    // ---------- CORS ----------

    [Fact]
    public async Task Cors_allows_the_configured_origin_only()
    {
        Isms.Responder = _ => StubIsmsHandler.Page();
        var client = _factory.CreateClient();

        async Task<HttpResponseMessage> Preflight(string origin)
        {
            var request = new HttpRequestMessage(HttpMethod.Options, "/api/subjects");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "GET");
            return await client.SendAsync(request);
        }

        async Task<HttpResponseMessage> Get(string origin)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/subjects");
            request.Headers.Add("Origin", origin);
            return await client.SendAsync(request);
        }

        var allowedPreflight = await Preflight(LmsApiFactory.AllowedOrigin);
        Assert.Equal(LmsApiFactory.AllowedOrigin, allowedPreflight.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal(LmsApiFactory.AllowedOrigin, (await Get(LmsApiFactory.AllowedOrigin)).Headers.GetValues("Access-Control-Allow-Origin").Single());

        Assert.False((await Preflight("http://evil.example")).Headers.Contains("Access-Control-Allow-Origin"));
        Assert.False((await Get("http://evil.example")).Headers.Contains("Access-Control-Allow-Origin"));
    }

    // ---------- read-only ----------

    [Theory]
    [InlineData("POST", "/api/classes")]
    [InlineData("PUT", "/api/classes/abc")]
    [InlineData("PATCH", "/api/classes/abc")]
    [InlineData("DELETE", "/api/classes/abc")]
    [InlineData("POST", "/api/subjects")]
    [InlineData("PUT", "/api/subjects/1")]
    [InlineData("DELETE", "/api/subjects/1")]
    public async Task Classes_and_subjects_have_no_write_endpoints(string method, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path) { Content = JsonContent.Create(new { name = "x" }) };

        var response = await _factory.CreateClient().SendAsync(request);

        Assert.True(response.StatusCode is HttpStatusCode.MethodNotAllowed or HttpStatusCode.NotFound, $"{method} {path} answered {(int)response.StatusCode}");
        Assert.Empty(Isms.Requests);
    }

    // ---------- startup and hosting ----------

    [Fact]
    public void Startup_fails_fast_without_an_api_key()
    {
        using var factory = new LmsApiFactory().With("Isms:ApiKey", "");

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        var messages = string.Join(" | ", Flatten(error).Select(e => e.Message));
        Assert.Contains("Isms:ApiKey is not set", messages);
        Assert.Contains("user-secrets", messages);
    }

    [Fact]
    public async Task OpenApi_document_is_served_in_Development()
    {
        using var factory = new LmsApiFactory().InEnvironment("Development");

        var response = await factory.CreateClient().GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("/api/classes", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task OpenApi_document_is_not_served_outside_Development()
    {
        var response = await _factory.CreateClient().GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static IEnumerable<Exception> Flatten(Exception e)
    {
        yield return e;
        if (e is AggregateException agg)
            foreach (var inner in agg.InnerExceptions.SelectMany(Flatten)) yield return inner;
        else if (e.InnerException is { } inner)
            foreach (var x in Flatten(inner)) yield return x;
    }
}
