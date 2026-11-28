using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Lms.Api.Meetings;

/// <summary>What a person may do in a meeting, as the media server enforces it (LiveKit's video grant).</summary>
public sealed record MeetingGrant
{
    [JsonPropertyName("room")] public string? Room { get; init; }
    [JsonPropertyName("roomJoin")] public bool? RoomJoin { get; init; }
    [JsonPropertyName("roomAdmin")] public bool? RoomAdmin { get; init; }
    [JsonPropertyName("roomCreate")] public bool? RoomCreate { get; init; }
    [JsonPropertyName("roomList")] public bool? RoomList { get; init; }
    [JsonPropertyName("canPublish")] public bool? CanPublish { get; init; }
    [JsonPropertyName("canSubscribe")] public bool? CanSubscribe { get; init; }
    [JsonPropertyName("canPublishData")] public bool? CanPublishData { get; init; }
    /// <summary>Which of camera, microphone, screen_share, screen_share_audio. Empty means all, so never send it empty.</summary>
    [JsonPropertyName("canPublishSources")] public IReadOnlyList<string>? CanPublishSources { get; init; }
    [JsonPropertyName("canUpdateOwnMetadata")] public bool? CanUpdateOwnMetadata { get; init; }
}

/// <summary>
/// Signed passes for the media server (HS256 JWTs, LiveKit's access-token format) and the check
/// of the webhooks it sends back. The secret never leaves the server. Times are the real clock's,
/// because the media server checks them by its own: Demo mode's clock may start in the past.
/// </summary>
public sealed class MeetingTokens(IOptions<MeetingOptions> options)
{
    private static readonly TimeProvider time = TimeProvider.System;

    private static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    private const string Header = """{"alg":"HS256","typ":"JWT"}""";

    /// <summary>A pass that lets one person join one room, with what they may do there.</summary>
    public (string Token, DateTimeOffset ExpiresAt) JoinPass(string identity, string name, MeetingGrant grant, IReadOnlyDictionary<string, string> attributes)
    {
        var now = time.GetUtcNow();
        var expires = now.AddMinutes(Math.Max(1, options.Value.JoinPassMinutes));
        var claims = new Dictionary<string, object?>
        {
            ["iss"] = options.Value.ApiKey,
            ["sub"] = identity,
            ["name"] = name,
            ["nbf"] = now.AddSeconds(-10).ToUnixTimeSeconds(),
            ["exp"] = expires.ToUnixTimeSeconds(),
            ["video"] = grant,
            ["attributes"] = attributes,
        };
        return (Sign(claims), expires);
    }

    /// <summary>A short pass for the LMS API's own calls to the server API about one room.</summary>
    public string ServerPass(string? room)
    {
        var now = time.GetUtcNow();
        var claims = new Dictionary<string, object?>
        {
            ["iss"] = options.Value.ApiKey,
            ["nbf"] = now.AddSeconds(-10).ToUnixTimeSeconds(),
            ["exp"] = now.AddMinutes(1).ToUnixTimeSeconds(),
            ["video"] = new MeetingGrant { Room = room, RoomAdmin = room is null ? null : true, RoomCreate = true, RoomList = true },
        };
        return Sign(claims);
    }

    /// <summary>
    /// True when a webhook came from our media server: the Authorization header is a JWT signed
    /// with our secret, issued by our key, with an expiry that hasn't passed, and carrying the SHA-256 of this body.
    /// </summary>
    public bool IsGenuineWebhook(string? authorization, ReadOnlySpan<byte> body)
    {
        if (string.IsNullOrWhiteSpace(authorization)) return false;
        var token = authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? authorization[7..].Trim() : authorization.Trim();
        if (!TryReadVerified(token, out var claims)) return false;
        // LiveKit signs every webhook with a short expiry; one without any could be replayed forever.
        if (!claims.TryGetProperty("exp", out var exp) || !exp.TryGetInt64(out _)) return false;
        if (!claims.TryGetProperty("iss", out var iss) || iss.ValueKind != JsonValueKind.String || iss.GetString() != options.Value.ApiKey) return false;
        if (!claims.TryGetProperty("sha256", out var hash) || hash.ValueKind != JsonValueKind.String) return false;
        var expected = Convert.ToBase64String(SHA256.HashData(body));
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(hash.GetString() ?? ""));
    }

    /// <summary>Checks the signature, the algorithm, and the time window (one minute's leeway); returns the claims.</summary>
    internal bool TryReadVerified(string token, out JsonElement claims)
    {
        claims = default;
        var parts = token.Split('.');
        if (parts.Length != 3 || options.Value.ApiSecret is not { Length: > 0 } secret) return false;
        try
        {
            using (var header = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[0])))
                if (!header.RootElement.TryGetProperty("alg", out var alg) || alg.GetString() != "HS256") return false;
            var signature = Base64Url.DecodeFromChars(parts[2]);
            var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"));
            if (!CryptographicOperations.FixedTimeEquals(signature, expected)) return false;
            using var payload = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[1]));
            var now = time.GetUtcNow().ToUnixTimeSeconds();
            var root = payload.RootElement;
            if (root.TryGetProperty("exp", out var exp) && exp.TryGetInt64(out var expSeconds) && now > expSeconds + 60) return false;
            if (root.TryGetProperty("nbf", out var nbf) && nbf.TryGetInt64(out var nbfSeconds) && now < nbfSeconds - 60) return false;
            claims = root.Clone();
            return true;
        }
        catch (Exception e) when (e is FormatException or JsonException) { return false; }
    }

    private string Sign(Dictionary<string, object?> claims)
    {
        var secret = options.Value.ApiSecret ?? throw new MeetingServerException("Lms:Meet:ApiSecret is not set.");
        var head = Base64Url.EncodeToString(Encoding.UTF8.GetBytes(Header));
        var body = Base64Url.EncodeToString(JsonSerializer.SerializeToUtf8Bytes(claims, Json));
        var signature = Base64Url.EncodeToString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes($"{head}.{body}")));
        return $"{head}.{body}.{signature}";
    }
}
