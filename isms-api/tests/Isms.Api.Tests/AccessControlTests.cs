using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Isms.Api.Access;

namespace Isms.Api.Tests;

public class AccessControlTests(IsmsApiFactory factory) : IClassFixture<IsmsApiFactory>
{
    private const string Route = "/v1/subjects";

    public static TheoryData<string> ResourceRoutes =>
    [
        "/v1/school-years", "/v1/semesters", "/v1/subjects", "/v1/instructors", "/v1/schedules", "/v1/schedules/SCH-1/students",
    ];

    private async Task AssertGeneric401(HttpClient http, string route = Route)
    {
        var response = await http.GetAsync(route);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        // Same body whatever failed, so callers cannot probe which part was wrong.
        Assert.Equal("Unauthorized", problem.GetProperty("title").GetString());
        Assert.Equal("Missing or invalid client credentials.", problem.GetProperty("detail").GetString());
    }

    [Fact] public Task No_headers_is_401() => AssertGeneric401(factory.ClientWith(null, null));
    [Fact] public Task Client_id_without_key_is_401() => AssertGeneric401(factory.ClientWith(IsmsApiFactory.FullClient, null));
    [Fact] public Task Key_without_client_id_is_401() => AssertGeneric401(factory.ClientWith(null, factory.FullKey));
    [Fact] public Task Unknown_client_is_401() => AssertGeneric401(factory.ClientWith("nobody", factory.FullKey));
    [Fact] public Task Wrong_key_is_401() => AssertGeneric401(factory.ClientWith(IsmsApiFactory.FullClient, ApiKeys.Generate()));
    [Fact] public Task Wrong_key_with_correct_prefix_is_401() =>
        AssertGeneric401(factory.ClientWith(IsmsApiFactory.FullClient, factory.FullKey[..8] + ApiKeys.Generate()[8..]));
    [Fact] public Task Another_clients_key_is_401() => AssertGeneric401(factory.ClientWith(IsmsApiFactory.FullClient, factory.SubjectsOnlyKey));
    [Fact] public Task Expired_key_is_401() => AssertGeneric401(factory.ClientWith(IsmsApiFactory.ExpiredClient, factory.ExpiredKey));
    [Fact] public Task Revoked_key_is_401() => AssertGeneric401(factory.ClientWith(IsmsApiFactory.RevokedClient, factory.RevokedKey));
    [Fact] public Task Disabled_client_is_401() => AssertGeneric401(factory.ClientWith(IsmsApiFactory.DisabledClient, factory.DisabledKey));

    [Theory, MemberData(nameof(ResourceRoutes))]
    public async Task Valid_client_with_permission_gets_200(string route)
    {
        var response = await factory.FullAccessClient().GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory, MemberData(nameof(ResourceRoutes))]
    public async Task Every_resource_route_requires_credentials(string route) =>
        await AssertGeneric401(factory.ClientWith(null, null), route);

    [Fact]
    public async Task Subject_only_client_can_read_subjects()
    {
        var response = await factory.ClientWith(IsmsApiFactory.SubjectsOnlyClient, factory.SubjectsOnlyKey).GetAsync("/v1/subjects");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/v1/instructors")]
    [InlineData("/v1/schedules")]
    [InlineData("/v1/school-years")]
    [InlineData("/v1/semesters")]
    [InlineData("/v1/schedules/SCH-1/students")]
    public async Task Valid_client_without_permission_gets_403(string route)
    {
        var response = await factory.ClientWith(IsmsApiFactory.SubjectsOnlyClient, factory.SubjectsOnlyKey).GetAsync(route);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(403, problem.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Rotation_keeps_old_key_valid_until_revoked()
    {
        var username = "rotating-" + Guid.NewGuid().ToString("N")[..8];
        var first = await factory.WithAdminAsync(a => a.CreateAsync(username, "Rotating", [Permissions.SubjectView], 30));
        var second = await factory.WithAdminAsync(a => a.RotateAsync(username, 30, revokeOld: false));
        Assert.NotEqual(first.Key, second.Key);

        Assert.Equal(HttpStatusCode.OK, (await factory.ClientWith(username, first.Key).GetAsync(Route)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.ClientWith(username, second.Key).GetAsync(Route)).StatusCode);

        var third = await factory.WithAdminAsync(a => a.RotateAsync(username, 30, revokeOld: true));
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.ClientWith(username, first.Key).GetAsync(Route)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.ClientWith(username, second.Key).GetAsync(Route)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.ClientWith(username, third.Key).GetAsync(Route)).StatusCode);
    }

    [Fact]
    public async Task Ungranting_takes_effect_on_next_request()
    {
        var username = "ungrant-" + Guid.NewGuid().ToString("N")[..8];
        var issued = await factory.WithAdminAsync(a => a.CreateAsync(username, "Ungrant", [Permissions.SubjectView], 30));
        var http = factory.ClientWith(username, issued.Key);
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync(Route)).StatusCode);
        await factory.WithAdminAsync(async a => { await a.UngrantAsync(username, [Permissions.SubjectView]); return 0; });
        Assert.Equal(HttpStatusCode.Forbidden, (await http.GetAsync(Route)).StatusCode);
    }

    [Theory]
    [InlineData("POST", "/v1/subjects")]
    [InlineData("PUT", "/v1/subjects")]
    [InlineData("DELETE", "/v1/subjects")]
    [InlineData("PATCH", "/v1/subjects")]
    [InlineData("POST", "/v1/schedules")]
    [InlineData("PUT", "/v1/instructors")]
    [InlineData("DELETE", "/v1/schedules/SCH-1/students")]
    [InlineData("POST", "/v1/schedules/SCH-1/students")]
    public async Task Write_methods_are_not_available(string method, string route)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), route) { Content = JsonContent.Create(new { name = "x" }) };
        var response = await factory.FullAccessClient().SendAsync(request);
        Assert.False(response.IsSuccessStatusCode, $"{method} {route} returned {(int)response.StatusCode}");
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.Forbidden, HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
    }

    [Fact]
    public async Task Unknown_route_is_denied_by_fallback_policy()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await factory.FullAccessClient().GetAsync("/v1/does-not-exist")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.ClientWith(null, null).GetAsync("/v1/does-not-exist")).StatusCode);
    }

    [Fact]
    public async Task Openapi_document_is_anonymous_in_development()
    {
        var response = await factory.ClientWith(null, null).GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
