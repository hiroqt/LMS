using Lms.Api.Identity;
using Microsoft.Extensions.Options;
using System.Threading.RateLimiting;

namespace Lms.Api.Meetings;

/// <summary>
/// The media server for class meetings (D-070): a LiveKit server we host ourselves. Without a
/// URL, key, and secret, meetings are off: classes can still list and schedule meetings, but
/// nobody can start or join one.
/// </summary>
public sealed class MeetingOptions
{
    public const string SectionName = "Lms:Meet";
    public const string ChatPolicy = "meeting-chat";

    /// <summary>The address browsers connect to, e.g. <c>wss://meet.school.edu</c> or <c>ws://localhost:7880</c>.</summary>
    public string? Url { get; set; }
    /// <summary>The server API address the LMS API calls. Unset: <see cref="Url"/> with http(s) instead of ws(s).</summary>
    public string? ApiUrl { get; set; }
    /// <summary>The media server's API key. Keep it in user-secrets or the environment.</summary>
    public string? ApiKey { get; set; }
    /// <summary>The media server's API secret (32 characters or more). Never in a committed file.</summary>
    public string? ApiSecret { get; set; }
    /// <summary>How long a join pass can be used to join. Once in, the media server keeps the person in.</summary>
    public int JoinPassMinutes { get; set; } = 10;
    /// <summary>A room nobody joins, or everyone has left, closes after this long. Ends the meeting.</summary>
    public int EmptyRoomMinutes { get; set; } = 5;
    /// <summary>Chat messages one person may send per minute.</summary>
    public int ChatMessagesPerMinute { get; set; } = 30;
    public int TimeoutSeconds { get; set; } = 10;

    public bool Configured =>
        !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(ApiKey) && (ApiSecret?.Length ?? 0) >= MeetingLimits.SecretMinLength;

    /// <summary>The server API's base address.</summary>
    public Uri ApiBase()
    {
        var raw = (string.IsNullOrWhiteSpace(ApiUrl) ? Url! : ApiUrl).Trim().TrimEnd('/');
        if (raw.StartsWith("ws://", StringComparison.OrdinalIgnoreCase)) raw = "http://" + raw[5..];
        else if (raw.StartsWith("wss://", StringComparison.OrdinalIgnoreCase)) raw = "https://" + raw[6..];
        return new Uri(raw + "/");
    }
}

public static class MeetingLimits
{
    public const int ChatLength = 1000;
    public const int TitleLength = 250;
    public const int SecretMinLength = 32;
    /// <summary>A webhook body bigger than this is refused before it is read.</summary>
    public const int WebhookBodyBytes = 256 * 1024;
}

public static class MeetingServices
{
    public static void AddLmsMeetings(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(MeetingOptions.SectionName);
        services.Configure<MeetingOptions>(section);
        var options = section.Get<MeetingOptions>() ?? new MeetingOptions();
        if (!string.IsNullOrWhiteSpace(options.ApiSecret) && options.ApiSecret.Length < MeetingLimits.SecretMinLength)
            throw new InvalidOperationException($"Lms:Meet:ApiSecret is shorter than {MeetingLimits.SecretMinLength} characters. Use the same secret as the media server (meet-server/README.md).");

        services.AddSingleton<MeetingTokens>();
        if (options.Configured)
        {
            services.AddHttpClient<IMeetingServer, LiveKitMeetingServer>(http =>
            {
                http.BaseAddress = options.ApiBase();
                http.Timeout = TimeSpan.FromSeconds(Math.Max(1, options.TimeoutSeconds));
            });
            services.AddSingleton(new MeetingNotice($"Class meetings use the media server at {options.Url}."));
        }
        else
        {
            services.AddSingleton<IMeetingServer, MeetingServerOff>();
            services.AddSingleton(new MeetingNotice("Class meetings are off: set Lms:Meet:Url, Lms:Meet:ApiKey and Lms:Meet:ApiSecret (meet-server/README.md)."));
        }
        services.AddHostedService<MeetingNoticeLogger>();
        services.AddScoped<MeetingRooms>();

        services.AddRateLimiter(limiter => limiter.AddPolicy(MeetingOptions.ChatPolicy, http =>
        {
            var who = http.Request.Headers[DemoIdentity.UserHeader].ToString() is { Length: > 0 and <= 64 } id ? id : http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var perMinute = Math.Max(1, http.RequestServices.GetRequiredService<IOptions<MeetingOptions>>().Value.ChatMessagesPerMinute);
            return RateLimitPartition.GetFixedWindowLimiter($"{Demo.DemoDatabases.SandboxOf(http)}|{who}", _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = perMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true,
            });
        }));
    }
}

/// <summary>Whether meetings are on, said once at start-up.</summary>
public sealed record MeetingNotice(string Message);

internal sealed class MeetingNoticeLogger(MeetingNotice notice, ILogger<MeetingNoticeLogger> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("{Notice}", notice.Message);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
