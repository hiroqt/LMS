using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

public sealed class ClassContentTests : IDisposable
{
    private readonly LmsApiFactory _factory = new LmsApiFactory().InEnvironment("Development");
    public void Dispose() => _factory.Dispose();
    private const string Root = "/api/classes/class-a/content";

    private async Task<HttpClient> ClientAsync()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-Instructor-Id", "EMP-1");
        await _factory.WithDbAsync(async db =>
        {
            db.IsmsClasses.AddRange(
                new IsmsClass { Id = "class-a", InstructorId = "EMP-1", IsActive = true },
                new IsmsClass { Id = "class-b", InstructorId = "EMP-2", IsActive = true });
            return await db.SaveChangesAsync();
        });
        return client;
    }

    private static async Task<JsonElement> Body(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Content_is_persisted_and_material_archive_restore_delete_work()
    {
        var client = await ClientAsync();
        var unit = await client.PostAsJsonAsync(Root + "/modules", new { title = "  SQL unit  ", sortOrder = 1 });
        Assert.Equal(HttpStatusCode.Created, unit.StatusCode);
        var moduleId = (await Body(unit)).GetProperty("id").GetInt64();
        var material = await client.PostAsJsonAsync(Root + "/materials", new { moduleId, title = "SQL notes", kind = "Study guide", description = "Fictional notes", fileName = "notes.pdf" });
        Assert.Equal(HttpStatusCode.Created, material.StatusCode);
        var materialId = (await Body(material)).GetProperty("id").GetInt64();
        var announcement = await client.PostAsJsonAsync(Root + "/announcements", new { title = "Reminder", message = "Bring a notebook" });
        Assert.Equal(HttpStatusCode.Created, announcement.StatusCode);
        var snapshot = await Body(await client.GetAsync(Root));
        Assert.Equal("SQL unit", snapshot.GetProperty("modules")[0].GetProperty("title").GetString());
        Assert.EndsWith("Z", snapshot.GetProperty("modules")[0].GetProperty("createdAt").GetString());
        Assert.Equal((await Body(unit)).GetProperty("createdAt").GetDateTimeOffset(), snapshot.GetProperty("modules")[0].GetProperty("createdAt").GetDateTimeOffset());
        Assert.EndsWith("Z", snapshot.GetProperty("announcements")[0].GetProperty("publishedAt").GetString());
        Assert.Equal("SQL notes", snapshot.GetProperty("materials")[0].GetProperty("title").GetString());
        Assert.Equal("Bring a notebook", snapshot.GetProperty("announcements")[0].GetProperty("message").GetString());
        foreach (var status in new[] { "archived", "active" })
        {
            var result = await client.PatchAsJsonAsync($"{Root}/materials/{materialId}", new { status });
            Assert.True(result.IsSuccessStatusCode);
            Assert.Equal(status, (await _factory.WithDbAsync(db => db.Materials.SingleAsync())).Status);
        }
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Root}/materials/{materialId}")).StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Materials.CountAsync()));
        var audits = await _factory.WithDbAsync(db => db.AuditLog.ToListAsync());
        Assert.NotEmpty(audits);
        Assert.All(audits, item => { Assert.Equal("EMP-1", item.ActorId); Assert.DoesNotContain("Bring a notebook", item.Summary); Assert.DoesNotContain("Fictional notes", item.Summary); });
        Assert.Equal("EMP-1", (await _factory.WithDbAsync(db => db.Modules.SingleAsync())).CreatedBy);
    }

    [Fact]
    public async Task Class_and_resource_scope_are_enforced_for_demo_selection()
    {
        var client = await ClientAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/classes/class-b/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/classes/missing/content")).StatusCode);
        await _factory.WithDbAsync(async db => { db.Modules.Add(new Module { ClassId = "class-b", Title = "Other unit" }); return await db.SaveChangesAsync(); });
        var moduleId = (await _factory.WithDbAsync(db => db.Modules.SingleAsync())).Id;
        var result = await client.PostAsJsonAsync(Root + "/materials", new { moduleId, title = "Invalid cross-class material", kind = "Guide" });
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Materials.CountAsync()));
        client.DefaultRequestHeaders.Remove("X-Demo-Instructor-Id");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Root)).StatusCode);
    }

    [Theory]
    [InlineData("/modules", "{\"title\":\"   \"}")]
    [InlineData("/announcements", "{\"title\":\"x\",\"message\":\"\"}")]
    [InlineData("/materials", "{\"title\":\"x\",\"moduleId\":0,\"kind\":\"Guide\"}")]
    public async Task Invalid_content_does_not_write_data_or_audit(string path, string json)
    {
        var client = await ClientAsync();
        var response = await client.PostAsync(Root + path, new StringContent(json, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.AuditLog.CountAsync()));
    }

    [Fact]
    public async Task Content_routes_are_absent_outside_Development()
    {
        using var factory = new LmsApiFactory();
        var response = await factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") }).GetAsync(Root);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Inactive_class_cannot_receive_content()
    {
        var client = await ClientAsync();
        await _factory.WithDbAsync(async db => { (await db.IsmsClasses.SingleAsync(c => c.Id == "class-a")).IsActive = false; return await db.SaveChangesAsync(); });
        Assert.False((await client.PostAsJsonAsync(Root + "/modules", new { title = "No new content" })).IsSuccessStatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Modules.CountAsync()));
    }

    [Fact]
    public async Task Pagination_is_bounded_and_cross_class_material_mutations_are_rejected()
    {
        var client = await ClientAsync();
        await _factory.WithDbAsync(async db =>
        {
            var module = new Module { ClassId = "class-b", Title = "Other unit" };
            db.Modules.Add(module);
            db.Modules.AddRange(new Module { ClassId = "class-a", Title = "First", SortOrder = 0 }, new Module { ClassId = "class-a", Title = "Second", SortOrder = 1 });
            await db.SaveChangesAsync();
            db.Materials.Add(new Material { ClassId = "class-b", ModuleId = module.Id, Title = "Private class notes", Kind = "Guide" });
            return await db.SaveChangesAsync();
        });
        var otherId = (await _factory.WithDbAsync(db => db.Materials.SingleAsync())).Id;
        Assert.Equal(HttpStatusCode.NotFound, (await client.PatchAsJsonAsync($"{Root}/materials/{otherId}", new { status = "archived" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"{Root}/materials/{otherId}")).StatusCode);
        var first = await Body(await client.GetAsync(Root + "?limit=1"));
        Assert.Equal("First", first.GetProperty("modules")[0].GetProperty("title").GetString());
        Assert.Equal(1, first.GetProperty("nextOffset").GetInt32());
        var second = await Body(await client.GetAsync(Root + "?limit=1&offset=1"));
        Assert.Equal("Second", second.GetProperty("modules")[0].GetProperty("title").GetString());
        Assert.Equal(JsonValueKind.Null, second.GetProperty("nextOffset").ValueKind);
        Assert.Empty(first.GetProperty("materials").EnumerateArray());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync(Root + "?limit=201")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync(Root + "?offset=-1")).StatusCode);
    }

    [Fact]
    public async Task Failed_audit_write_rolls_back_content_creation()
    {
        var client = await ClientAsync();
        await _factory.WithDbAsync(db => db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER reject_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;"));
        var response = await client.PostAsJsonAsync(Root + "/modules", new { title = "Must not persist" });
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Modules.CountAsync()));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.AuditLog.CountAsync()));
    }

    [Fact]
    public async Task Development_CORS_allows_content_mutation_preflight()
    {
        var client = await ClientAsync();
        using var request = new HttpRequestMessage(HttpMethod.Options, Root + "/materials");
        request.Headers.Add("Origin", LmsApiFactory.AllowedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type,x-demo-instructor-id");
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains("POST", string.Join(",", response.Headers.GetValues("Access-Control-Allow-Methods")));
    }
}
