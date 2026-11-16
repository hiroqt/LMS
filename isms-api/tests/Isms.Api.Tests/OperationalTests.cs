using System.Net;
using Isms.Api.Access;
using Isms.Api.Cli;
using Isms.Api.Isms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Isms.Api.Tests;

public class RequestLogTests(IsmsApiFactory factory) : IClassFixture<IsmsApiFactory>
{
    [Fact]
    public async Task Successful_request_is_logged_without_the_key()
    {
        var marker = "/v1/subjects";
        Assert.Equal(HttpStatusCode.OK, (await factory.FullAccessClient().GetAsync(marker + "?page=2")).StatusCode);

        var rows = factory.WithAccessDb(db => db.RequestLogs.AsNoTracking().ToList());
        var row = Assert.Single(rows, r => r.Path == marker && r.ClientUsername == IsmsApiFactory.FullClient);
        Assert.Equal("GET", row.Method);
        Assert.Equal(Permissions.SubjectView, row.RequiredPermission);
        Assert.Equal(200, row.StatusCode);
        Assert.True(row.Timestamp > DateTime.UtcNow.AddMinutes(-5));

        // No column of any log row contains a key (or even a key prefix).
        foreach (var r in rows)
        {
            var values = string.Join("|", r.ClientUsername, r.Method, r.Path, r.RequiredPermission, r.RemoteIp);
            Assert.DoesNotContain(factory.FullKey, values);
            Assert.DoesNotContain(factory.FullKey[..8], values);
        }
    }

    [Fact]
    public async Task Rejected_request_is_logged_without_identity_or_key()
    {
        var badKey = ApiKeys.Generate();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.ClientWith(IsmsApiFactory.FullClient, badKey).GetAsync("/v1/instructors")).StatusCode);

        var rows = factory.WithAccessDb(db => db.RequestLogs.AsNoTracking().Where(r => r.Path == "/v1/instructors").ToList());
        var row = Assert.Single(rows, r => r.StatusCode == 401);
        Assert.Null(row.ClientUsername);
        Assert.Equal(Permissions.InstructorView, row.RequiredPermission);
        Assert.DoesNotContain(rows, r => (r.Path + r.ClientUsername + r.RemoteIp).Contains(badKey));
    }

    [Fact]
    public async Task Successful_authentication_records_last_used()
    {
        await factory.FullAccessClient().GetAsync("/v1/subjects");
        var key = factory.WithAccessDb(db => db.ClientKeys.AsNoTracking().Single(k => k.KeyPrefix == ApiKeys.PrefixOf(factory.FullKey)));
        Assert.NotNull(key.LastUsedAt);
        Assert.Equal(ApiKeys.Hash(factory.FullKey), key.KeyHash);
        Assert.NotEqual(factory.FullKey, key.KeyHash);
    }

    [Fact]
    public async Task Isms_context_refuses_to_save()
    {
        using var scope = factory.Services.CreateScope();
        var isms = scope.ServiceProvider.GetRequiredService<IsmsDbContext>();
        Assert.Throws<InvalidOperationException>(() => isms.SaveChanges());
        await Assert.ThrowsAsync<InvalidOperationException>(() => isms.SaveChangesAsync());
        Assert.Equal(QueryTrackingBehavior.NoTracking, isms.ChangeTracker.QueryTrackingBehavior);
    }
}

public sealed class RateLimitedFactory : IsmsApiFactory
{
    protected override int PermitsPerMinute => 3;
}

public class RateLimitTests(RateLimitedFactory factory) : IClassFixture<RateLimitedFactory>
{
    [Fact]
    public async Task Requests_over_the_limit_get_429_per_client()
    {
        var http = factory.FullAccessClient();
        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await http.GetAsync("/v1/subjects")).StatusCode);
        var limited = await http.GetAsync("/v1/subjects");
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("application/problem+json", limited.Content.Headers.ContentType?.MediaType);

        // Another client has its own partition.
        var other = factory.ClientWith(IsmsApiFactory.SubjectsOnlyClient, factory.SubjectsOnlyKey);
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync("/v1/subjects")).StatusCode);
    }
}

public class ClientCliTests(IsmsApiFactory factory) : IClassFixture<IsmsApiFactory>
{
    private async Task<(int Code, string Out, string Err)> Run(params string[] args)
    {
        using var scope = factory.Services.CreateScope();
        var output = new StringWriter();
        var error = new StringWriter();
        var code = await ClientCli.RunAsync(args, scope.ServiceProvider.GetRequiredService<ClientAdmin>(), output, error);
        return (code, output.ToString(), error.ToString());
    }

    [Fact]
    public async Task Create_prints_key_once_and_list_never_prints_it()
    {
        var (code, output, _) = await Run("create", "cli-demo", "--name", "CLI Demo", "--permissions", "subject.view,schedule.view", "--expires-days", "7");
        Assert.Equal(0, code);
        var key = output.Split('\n').Select(l => l.Trim()).Single(l => l.Length == 43);

        Assert.Equal(HttpStatusCode.OK, (await factory.ClientWith("cli-demo", key).GetAsync("/v1/schedules")).StatusCode);

        var (listCode, list, _) = await Run("list");
        Assert.Equal(0, listCode);
        Assert.Contains("cli-demo (CLI Demo) - active", list);
        Assert.Contains("schedule.view, subject.view", list);
        Assert.DoesNotContain(key, list);
        Assert.DoesNotContain(ApiKeys.Hash(key), list);
    }

    [Theory]
    [InlineData("create", "bad-perm", "--permissions", "subject.view,student.delete")]
    [InlineData("grant", IsmsApiFactory.SubjectsOnlyClient, "admin.all")]
    public async Task Unknown_permissions_are_rejected(params string[] args)
    {
        var (code, _, err) = await Run(args);
        Assert.Equal(1, code);
        Assert.Contains("Unknown permission", err);
        Assert.False(factory.WithAccessDb(db => db.Clients.Any(c => c.Username == "bad-perm")));
        Assert.False(factory.WithAccessDb(db => db.ClientPermissions.Any(p => p.Permission == "admin.all")));
    }

    [Fact]
    public async Task Disable_then_enable()
    {
        var issued = await factory.WithAdminAsync(a => a.CreateAsync("toggle-me", "Toggle", [Permissions.SubjectView], 30));
        Assert.Equal(0, (await Run("disable", "toggle-me")).Code);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.ClientWith("toggle-me", issued.Key).GetAsync("/v1/subjects")).StatusCode);
        Assert.Equal(0, (await Run("enable", "toggle-me")).Code);
        Assert.Equal(HttpStatusCode.OK, (await factory.ClientWith("toggle-me", issued.Key).GetAsync("/v1/subjects")).StatusCode);
    }

    [Fact]
    public async Task Revoke_key_by_prefix()
    {
        var issued = await factory.WithAdminAsync(a => a.CreateAsync("revoke-me", "Revoke", [Permissions.SubjectView], 30));
        Assert.Equal(0, (await Run("revoke-key", "revoke-me", issued.KeyPrefix)).Code);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.ClientWith("revoke-me", issued.Key).GetAsync("/v1/subjects")).StatusCode);
    }

    [Fact]
    public async Task Unknown_command_prints_usage()
    {
        var (code, _, err) = await Run("frobnicate");
        Assert.Equal(2, code);
        Assert.Contains("clients create", err);
    }
}
