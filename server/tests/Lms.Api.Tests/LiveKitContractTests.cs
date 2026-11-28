using System.Net;
using Lms.Api.Meetings;

namespace Lms.Api.Tests;

/// <summary>
/// Runs against a real LiveKit server when LMS_TEST_LIVEKIT_URL is set (for example
/// http://127.0.0.1:7880 with meet-server/ running). API CI starts one and sets
/// LMS_REQUIRE_LIVEKIT=1, so there a missing server fails these tests instead of skipping them.
/// </summary>
public sealed class LiveKitFactAttribute : FactAttribute
{
    public LiveKitFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("LMS_TEST_LIVEKIT_URL")) && Environment.GetEnvironmentVariable("LMS_REQUIRE_LIVEKIT") != "1")
            Skip = "No LiveKit server here (set LMS_TEST_LIVEKIT_URL); API CI runs these tests.";
    }
}

/// <summary>The LMS API's calls and passes, as the real media server reads them (D-070).</summary>
public sealed class LiveKitContractTests
{
    private static MeetingOptions Options(string? secret = null) => new()
    {
        Url = Environment.GetEnvironmentVariable("LMS_TEST_LIVEKIT_URL") is { Length: > 0 } url ? url
            : throw new InvalidOperationException("LMS_REQUIRE_LIVEKIT is set, but LMS_TEST_LIVEKIT_URL is not."),
        ApiKey = Environment.GetEnvironmentVariable("LMS_TEST_LIVEKIT_KEY") ?? "lms-dev",
        ApiSecret = secret ?? Environment.GetEnvironmentVariable("LMS_TEST_LIVEKIT_SECRET") ?? "dev_only_livekit_secret_change_me_0123",
    };

    private static (LiveKitMeetingServer Server, MeetingTokens Tokens, HttpClient Http) Connect(MeetingOptions options)
    {
        var tokens = new MeetingTokens(Microsoft.Extensions.Options.Options.Create(options));
        var http = new HttpClient { BaseAddress = options.ApiBase(), Timeout = TimeSpan.FromSeconds(10) };
        return (new LiveKitMeetingServer(http, tokens), tokens, http);
    }

    [LiveKitFact]
    public async Task The_room_api_calls_work_on_a_real_server()
    {
        var (server, _, http) = Connect(Options());
        using var _ = http;
        var room = $"lms-contract-{Guid.NewGuid():N}";
        var ct = CancellationToken.None;

        await server.CreateRoomAsync(room, """{"saveChat":false}""", TimeSpan.FromMinutes(1), ct);
        Assert.Empty(await server.ListParticipantsAsync(room, ct));
        Assert.Null(await server.GetParticipantAsync(room, "nobody", ct));
        await server.UpdateRoomMetadataAsync(room, """{"saveChat":true}""", ct);
        await server.SendDataAsync(room, MeetingTopic.Chat, "{}"u8.ToArray(), null, ct);
        await server.SendDataAsync(room, MeetingTopic.AskUnmute, "{}"u8.ToArray(), ["nobody"], ct);
        // Someone who already left can be removed without an error; a mute or a change for them is refused.
        await server.RemoveParticipantAsync(room, "nobody", ct);
        var mute = await Assert.ThrowsAsync<MeetingServerException>(() => server.MuteTrackAsync(room, "nobody", "TR_missing", ct));
        Assert.NotNull(mute.Code);
        Assert.False(mute.Off);
        var update = await Assert.ThrowsAsync<MeetingServerException>(() =>
            server.UpdateParticipantAsync(room, "nobody", MeetingRights.ForInstructor(), new Dictionary<string, string> { ["lms.letSpeak"] = "true" }, ct));
        Assert.NotNull(update.Code);

        await server.DeleteRoomAsync(room, ct);
        // Ending twice, or a room that is gone, is fine.
        await server.DeleteRoomAsync(room, ct);
        Assert.Empty(await server.ListParticipantsAsync(room, ct));
    }

    [LiveKitFact]
    public async Task The_server_accepts_our_join_passes_and_refuses_a_forged_one()
    {
        var (_, tokens, http) = Connect(Options());
        using var _ = http;
        var student = MeetingRights.ForStudent(new Data.OnlineMeeting { StudentsMayUnmute = false });
        var (pass, _) = tokens.JoinPass("STU-1", "Lia Abad", MeetingRights.Grant("lms-contract-validate", student),
            new Dictionary<string, string> { [MeetingRights.RoleAttribute] = "student" });
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync($"rtc/validate?access_token={pass}")).StatusCode);

        var (forger, forgerTokens, forgerHttp) = Connect(Options(secret: "not_the_servers_secret_not_the_servers_secret"));
        using var __ = forgerHttp;
        var (forged, _) = forgerTokens.JoinPass("STU-1", "Lia Abad", MeetingRights.Grant("lms-contract-validate", student), new Dictionary<string, string>());
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync($"rtc/validate?access_token={forged}")).StatusCode);

        // A call signed with the wrong secret is refused, not mistaken for an outage.
        var wrong = await Assert.ThrowsAsync<MeetingServerException>(() => forger.ListParticipantsAsync("lms-contract-validate", CancellationToken.None));
        Assert.Equal("unauthenticated", wrong.Code);
    }
}
