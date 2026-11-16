using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Lms.Api.Tests;

/// <summary>Stands in for the ISMS API: answers via a swappable responder and records requests.</summary>
public sealed class StubIsmsHandler : HttpMessageHandler
{
    public ConcurrentQueue<HttpRequestMessage> Requests { get; } = new();

    public Func<HttpRequestMessage, HttpResponseMessage> Responder { get; set; } =
        _ => new HttpResponseMessage(HttpStatusCode.NotFound);

    public IEnumerable<HttpRequestMessage> RequestsTo(string path) =>
        Requests.Where(r => r.RequestUri!.AbsolutePath == path);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Enqueue(request);
        return Task.FromResult(Responder(request));
    }

    public static HttpResponseMessage Json(object body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(JsonSerializer.Serialize(body, JsonSerializerOptions.Web), Encoding.UTF8, "application/json") };

    /// <summary>A single-page ISMS list.</summary>
    public static HttpResponseMessage Page(params object[] items) =>
        Json(new { items, page = 1, pageSize = 200, total = items.Length });

    /// <summary>Routes by path; unknown paths 404.</summary>
    public static Func<HttpRequestMessage, HttpResponseMessage> Routes(Dictionary<string, Func<HttpRequestMessage, HttpResponseMessage>> routes) =>
        req => routes.TryGetValue(req.RequestUri!.AbsolutePath, out var r) ? r(req) : new HttpResponseMessage(HttpStatusCode.NotFound);
}

/// <summary>A TimeProvider the tests move by hand.</summary>
public sealed class ManualTimeProvider : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 11, 16, 8, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}

public sealed class LmsApiFactory : WebApplicationFactory<Program>
{
    public const string ClientId = "lms-test-client";
    public const string ApiKey = "sk_test_DO-NOT-LEAK-7f3a9c";
    public const string AllowedOrigin = "http://localhost:5173";

    public StubIsmsHandler Isms { get; } = new();
    public ManualTimeProvider Time { get; } = new();

    private readonly Dictionary<string, string?> _settings = new()
    {
        ["Isms:BaseUrl"] = "http://isms.test",
        ["Isms:ClientId"] = ClientId,
        ["Isms:ApiKey"] = ApiKey,
        ["Isms:RetryDelayMilliseconds"] = "1",
        ["Isms:MaxRetries"] = "2",
        ["Isms:TimeoutSeconds"] = "5",
        ["Isms:CacheTtlSeconds"] = "300",
        ["Isms:MaxStaleSeconds"] = "3600",
        ["Cors:AllowedOrigins:0"] = AllowedOrigin,
    };

    private string _environment = "Testing";

    public LmsApiFactory With(string key, string? value)
    {
        _settings[key] = value;
        return this;
    }

    public LmsApiFactory InEnvironment(string environment)
    {
        _environment = environment;
        return this;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(_environment);
        foreach (var (key, value) in _settings)
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<TimeProvider>(Time);
            services.ConfigureHttpClientDefaults(http => http.ConfigurePrimaryHttpMessageHandler(() => Isms));
        });
    }
}
