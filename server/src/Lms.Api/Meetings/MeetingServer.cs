using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Lms.Api.Meetings;

/// <summary>Media sources, as the media server names them in join passes.</summary>
public static class MeetingSource
{
    public const string Camera = "camera";
    public const string Microphone = "microphone";
    public const string ScreenShare = "screen_share";
    public const string ScreenShareAudio = "screen_share_audio";
}

public sealed record MeetingTrack(string Sid, string Source, bool Muted);

/// <summary>What one person may do, as the media server holds it. <see cref="Sources"/> is never empty when <see cref="CanPublish"/> is true.</summary>
public sealed record MeetingPermission(bool CanSubscribe, bool CanPublish, bool CanPublishData, IReadOnlyList<string> Sources);

public sealed record MeetingParticipant(string Identity, string Name, IReadOnlyList<MeetingTrack> Tracks, MeetingPermission? Permission,
    IReadOnlyDictionary<string, string> Attributes);

/// <summary>The media server's room API (LiveKit's RoomService).</summary>
public interface IMeetingServer
{
    Task CreateRoomAsync(string room, string metadata, TimeSpan emptyTimeout, CancellationToken ct);
    /// <summary>Disconnects everyone. A room that is already gone is fine.</summary>
    Task DeleteRoomAsync(string room, CancellationToken ct);
    Task UpdateRoomMetadataAsync(string room, string metadata, CancellationToken ct);
    /// <summary>Everyone in the room now; empty when the room doesn't exist.</summary>
    Task<IReadOnlyList<MeetingParticipant>> ListParticipantsAsync(string room, CancellationToken ct);
    /// <summary>Null when the person isn't in the room.</summary>
    Task<MeetingParticipant?> GetParticipantAsync(string room, string identity, CancellationToken ct);
    /// <summary>Replaces what the person may publish. A source taken away is unpublished at once.</summary>
    Task UpdateParticipantAsync(string room, string identity, MeetingPermission permission, IReadOnlyDictionary<string, string>? attributes, CancellationToken ct);
    /// <summary>Changes only the person's attributes (an empty value removes one); what they may publish stays as it is.</summary>
    Task SetAttributesAsync(string room, string identity, IReadOnlyDictionary<string, string> attributes, CancellationToken ct);
    /// <summary>Mutes one published track. Unmuting someone else is not possible (remote unmute is off).</summary>
    Task MuteTrackAsync(string room, string identity, string trackSid, CancellationToken ct);
    /// <summary>Disconnects one person. Someone who already left is fine.</summary>
    Task RemoveParticipantAsync(string room, string identity, CancellationToken ct);
    /// <summary>A reliable message from the server, to everyone or to the given people.</summary>
    Task SendDataAsync(string room, string topic, byte[] data, IReadOnlyList<string>? to, CancellationToken ct);
}

/// <summary>The media server is off, unreachable, or refused a call. Becomes a 503 (or 409 for a refusal).</summary>
public sealed class MeetingServerException(string message, bool off = false, string? code = null, Exception? inner = null) : Exception(message, inner)
{
    public bool Off { get; } = off;
    /// <summary>The media server's own error code, e.g. <c>failed_precondition</c>.</summary>
    public string? Code { get; } = code;
}

/// <summary>Meetings are off on this server (no Lms:Meet settings).</summary>
internal sealed class MeetingServerOff : IMeetingServer
{
    private static MeetingServerException Off() => new("Class meetings are off on this server.", off: true);
    public Task CreateRoomAsync(string room, string metadata, TimeSpan emptyTimeout, CancellationToken ct) => throw Off();
    public Task DeleteRoomAsync(string room, CancellationToken ct) => throw Off();
    public Task UpdateRoomMetadataAsync(string room, string metadata, CancellationToken ct) => throw Off();
    public Task<IReadOnlyList<MeetingParticipant>> ListParticipantsAsync(string room, CancellationToken ct) => throw Off();
    public Task<MeetingParticipant?> GetParticipantAsync(string room, string identity, CancellationToken ct) => throw Off();
    public Task UpdateParticipantAsync(string room, string identity, MeetingPermission permission, IReadOnlyDictionary<string, string>? attributes, CancellationToken ct) => throw Off();
    public Task SetAttributesAsync(string room, string identity, IReadOnlyDictionary<string, string> attributes, CancellationToken ct) => throw Off();
    public Task MuteTrackAsync(string room, string identity, string trackSid, CancellationToken ct) => throw Off();
    public Task RemoveParticipantAsync(string room, string identity, CancellationToken ct) => throw Off();
    public Task SendDataAsync(string room, string topic, byte[] data, IReadOnlyList<string>? to, CancellationToken ct) => throw Off();
}

/// <summary>
/// LiveKit's RoomService over Twirp: POST /twirp/livekit.RoomService/{Method} with JSON and a
/// short server pass per call. Field names are the protobuf names (snake_case).
/// </summary>
internal sealed class LiveKitMeetingServer(HttpClient http, MeetingTokens tokens) : IMeetingServer
{
    public Task CreateRoomAsync(string room, string metadata, TimeSpan emptyTimeout, CancellationToken ct) =>
        CallAsync(room, "CreateRoom", new JsonObject
        {
            ["name"] = room,
            ["empty_timeout"] = (uint)emptyTimeout.TotalSeconds,
            ["departure_timeout"] = (uint)emptyTimeout.TotalSeconds,
            ["metadata"] = metadata,
        }, ct);

    public Task DeleteRoomAsync(string room, CancellationToken ct) =>
        CallAsync(room, "DeleteRoom", new JsonObject { ["room"] = room }, ct, notFoundIsFine: true);

    public Task UpdateRoomMetadataAsync(string room, string metadata, CancellationToken ct) =>
        CallAsync(room, "UpdateRoomMetadata", new JsonObject { ["room"] = room, ["metadata"] = metadata }, ct);

    public async Task<IReadOnlyList<MeetingParticipant>> ListParticipantsAsync(string room, CancellationToken ct)
    {
        var body = await CallAsync(room, "ListParticipants", new JsonObject { ["room"] = room }, ct, notFoundIsFine: true);
        if (body is null || !body.Value.TryGetProperty("participants", out var list) || list.ValueKind != JsonValueKind.Array) return [];
        return list.EnumerateArray().Select(ReadParticipant).ToList();
    }

    public async Task<MeetingParticipant?> GetParticipantAsync(string room, string identity, CancellationToken ct)
    {
        var body = await CallAsync(room, "GetParticipant", new JsonObject { ["room"] = room, ["identity"] = identity }, ct, notFoundIsFine: true);
        return body is { } p ? ReadParticipant(p) : null;
    }

    public Task UpdateParticipantAsync(string room, string identity, MeetingPermission permission, IReadOnlyDictionary<string, string>? attributes, CancellationToken ct)
    {
        var request = new JsonObject
        {
            ["room"] = room,
            ["identity"] = identity,
            ["permission"] = new JsonObject
            {
                ["can_subscribe"] = permission.CanSubscribe,
                ["can_publish"] = permission.CanPublish,
                ["can_publish_data"] = permission.CanPublishData,
                ["can_publish_sources"] = new JsonArray(permission.Sources.Select(s => (JsonNode)s.ToUpperInvariant()).ToArray()),
                ["can_update_metadata"] = false,
            },
        };
        if (attributes is not null)
            request["attributes"] = new JsonObject(attributes.Select(a => KeyValuePair.Create(a.Key, (JsonNode?)a.Value)));
        return CallAsync(room, "UpdateParticipant", request, ct);
    }

    public Task SetAttributesAsync(string room, string identity, IReadOnlyDictionary<string, string> attributes, CancellationToken ct) =>
        CallAsync(room, "UpdateParticipant", new JsonObject
        {
            ["room"] = room,
            ["identity"] = identity,
            ["attributes"] = new JsonObject(attributes.Select(a => KeyValuePair.Create(a.Key, (JsonNode?)a.Value))),
        }, ct);

    public Task MuteTrackAsync(string room, string identity, string trackSid, CancellationToken ct) =>
        CallAsync(room, "MutePublishedTrack", new JsonObject { ["room"] = room, ["identity"] = identity, ["track_sid"] = trackSid, ["muted"] = true }, ct);

    public Task RemoveParticipantAsync(string room, string identity, CancellationToken ct) =>
        CallAsync(room, "RemoveParticipant", new JsonObject { ["room"] = room, ["identity"] = identity }, ct, notFoundIsFine: true);

    public Task SendDataAsync(string room, string topic, byte[] data, IReadOnlyList<string>? to, CancellationToken ct)
    {
        var request = new JsonObject { ["room"] = room, ["data"] = Convert.ToBase64String(data), ["kind"] = "RELIABLE", ["topic"] = topic };
        if (to is { Count: > 0 }) request["destination_identities"] = new JsonArray(to.Select(t => (JsonNode)t).ToArray());
        return CallAsync(room, "SendData", request, ct);
    }

    private async Task<JsonElement?> CallAsync(string room, string method, JsonObject request, CancellationToken ct, bool notFoundIsFine = false)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, $"twirp/livekit.RoomService/{method}")
        {
            Content = new StringContent(request.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens.ServerPass(room));
        HttpResponseMessage response;
        string text;
        try
        {
            response = await http.SendAsync(message, ct);
            text = await response.Content.ReadAsStringAsync(ct);
        }
        catch (Exception e) when (e is HttpRequestException || (e is TaskCanceledException && !ct.IsCancellationRequested))
        {
            throw new MeetingServerException($"The media server didn't answer {method}.", inner: e);
        }
        using (response)
        {
            if (response.IsSuccessStatusCode)
                return string.IsNullOrWhiteSpace(text) ? null : JsonDocument.Parse(text).RootElement.Clone();
            // A bad signature comes back as plain text, not a Twirp error.
            var code = TwirpCode(text) ?? response.StatusCode switch
            {
                HttpStatusCode.Unauthorized => "unauthenticated",
                HttpStatusCode.Forbidden => "permission_denied",
                _ => null,
            };
            if (notFoundIsFine && (response.StatusCode == HttpStatusCode.NotFound || code == "not_found")) return null;
            throw new MeetingServerException($"The media server refused {method} ({(int)response.StatusCode} {code}).", code: code);
        }
    }

    private static string? TwirpCode(string text)
    {
        try { return JsonDocument.Parse(text).RootElement.TryGetProperty("code", out var c) ? c.GetString() : null; }
        catch (JsonException) { return null; }
    }

    internal static MeetingParticipant ReadParticipant(JsonElement p)
    {
        string Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
        bool Bool(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

        var tracks = p.TryGetProperty("tracks", out var t) && t.ValueKind == JsonValueKind.Array
            ? t.EnumerateArray().Select(x => new MeetingTrack(Str(x, "sid"), Str(x, "source").ToLowerInvariant(), Bool(x, "muted"))).ToList()
            : [];
        MeetingPermission? permission = null;
        if (p.TryGetProperty("permission", out var perm) && perm.ValueKind == JsonValueKind.Object)
        {
            var sources = perm.TryGetProperty("can_publish_sources", out var s) && s.ValueKind == JsonValueKind.Array
                ? s.EnumerateArray().Select(x => (x.GetString() ?? "").ToLowerInvariant()).ToList()
                : [];
            permission = new MeetingPermission(Bool(perm, "can_subscribe"), Bool(perm, "can_publish"), Bool(perm, "can_publish_data"), sources);
        }
        var attributes = p.TryGetProperty("attributes", out var a) && a.ValueKind == JsonValueKind.Object
            ? a.EnumerateObject().ToDictionary(x => x.Name, x => x.Value.GetString() ?? "", StringComparer.Ordinal)
            : new Dictionary<string, string>(StringComparer.Ordinal);
        return new MeetingParticipant(Str(p, "identity"), Str(p, "name"), tracks, permission, attributes);
    }
}

/// <summary>Meeting server problems as problem details: off or unreachable is 503, a wrong key 502, any other refusal 409.</summary>
internal sealed class MeetingExceptionHandler(IProblemDetailsService problemDetails, ILogger<MeetingExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not MeetingServerException ex) return false;
        logger.LogWarning(ex, "Meeting server: {Message}", ex.Message);
        var (status, code, title) = ex switch
        {
            { Off: true } => (StatusCodes.Status503ServiceUnavailable, "meetings_off", "Class meetings are turned off on this server."),
            { Code: null } => (StatusCodes.Status503ServiceUnavailable, "meeting_server_unavailable", "The meeting server isn't answering. Try again in a moment."),
            // The LMS server's own key or secret is wrong: a setting to fix, not the person's fault (like ISMS's 401, D-031).
            { Code: "unauthenticated" or "permission_denied" } => (StatusCodes.Status502BadGateway, "meeting_server_rejected_key",
                "The meeting server refused the LMS's key. Check Lms:Meet:ApiKey and Lms:Meet:ApiSecret against the media server."),
            _ => (StatusCodes.Status409Conflict, "meeting_server_refused", "The meeting server refused that. Reload and try again."),
        };
        context.Response.StatusCode = status;
        if (status == StatusCodes.Status503ServiceUnavailable) context.Response.Headers.RetryAfter = "10";
        var problem = new ProblemDetails { Status = status, Title = title };
        problem.Extensions["code"] = code;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem, Exception = exception });
    }
}
