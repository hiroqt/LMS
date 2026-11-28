using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Meetings;

/// <summary>
/// The media server's webhooks (D-072): who joined and left each meeting, and when a room closed.
/// Only a request signed with our secret, carrying the SHA-256 of its body, is read. A webhook
/// can arrive twice or late; each one is applied once, by its participant session id.
/// </summary>
public static class MeetingWebhookEndpoints
{
    public const string Path = "/api/meetings/livekit-webhook";

    public static IEndpointRouteBuilder MapMeetingWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost(Path, async Task<IResult> (HttpContext http, MeetingTokens tokens, MeetingRooms rooms, IMeetingServer server, TimeProvider time,
            ILoggerFactory loggers, CancellationToken ct) =>
        {
            if (http.Request.ContentLength is > MeetingLimits.WebhookBodyBytes) return TypedResults.StatusCode(StatusCodes.Status413PayloadTooLarge);
            // Read at most the limit, also when no length was sent.
            using var buffer = new MemoryStream();
            var chunk = new byte[16 * 1024];
            int read;
            while ((read = await http.Request.Body.ReadAsync(chunk, ct)) > 0)
            {
                if (buffer.Length + read > MeetingLimits.WebhookBodyBytes) return TypedResults.StatusCode(StatusCodes.Status413PayloadTooLarge);
                buffer.Write(chunk, 0, read);
            }
            var body = buffer.ToArray();
            if (!tokens.IsGenuineWebhook(http.Request.Headers.Authorization.ToString(), body))
                return TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "This webhook isn't signed by the meeting server.");

            WebhookEvent? hook;
            try { hook = WebhookEvent.Read(body); }
            catch (JsonException) { return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "This webhook can't be read."); }
            if (hook is null || hook.Room.Length == 0) return TypedResults.Ok();

            var (db, owned) = await rooms.DatabaseForRoomAsync(hook.Room);
            try { await ApplyAsync(db, hook, time.GetUtcNow().UtcDateTime, ct, server, loggers.CreateLogger(typeof(MeetingWebhookEndpoints))); }
            finally { if (owned) await db.DisposeAsync(); }
            return TypedResults.Ok();
        }).WithName("MeetingServerWebhook");
        return app;
    }

    /// <param name="now">The API's clock. The media server's times are moved onto it (by the event's age), so a
    /// stay lines up with the meeting's own start and end even when the two clocks differ (Demo mode).</param>
    /// <param name="server">When given, someone who joined but may no longer be in the meeting (removed by the
    /// instructor, or no longer on the class list) is disconnected at once: the media server can't take back
    /// a join pass they still hold (<see cref="MeetingPresence"/>).</param>
    internal static async Task ApplyAsync(LmsDbContext db, WebhookEvent hook, DateTime now, CancellationToken ct, IMeetingServer? server = null, ILogger? logger = null)
    {
        var shift = now - hook.At;
        DateTime Here(DateTime serverTime) => serverTime + shift;
        // A room the LMS didn't make (./check.sh, another app on the same server) is not ours to record.
        var meeting = await db.Meetings.SingleOrDefaultAsync(m => m.RoomName == hook.Room, ct);
        if (meeting is null) return;

        switch (hook.Event)
        {
            case "participant_joined" when hook.Participant is { } p:
            {
                if (server is not null && !await MeetingPresence.MayBeInAsync(db, meeting, p.Identity, ct))
                {
                    // Refused at the door: disconnected, and not counted as attending.
                    try { await server.RemoveParticipantAsync(meeting.RoomName, p.Identity, ct); }
                    catch (MeetingServerException e) when (!e.Off)
                    {
                        logger?.LogWarning(e, "Couldn't disconnect someone who may not be in meeting {Id}", meeting.Id);
                    }
                    return;
                }
                if (await db.MeetingAttendance.AnyAsync(a => a.SessionId == p.Sid, ct)) return;
                db.MeetingAttendance.Add(new MeetingAttendance
                {
                    MeetingId = meeting.Id, PersonId = p.Identity, Role = await RoleAsync(db, meeting, p.Identity, ct), SessionId = p.Sid, JoinedAt = Here(p.JoinedAt ?? hook.At),
                });
                break;
            }
            case "participant_left" or "participant_connection_aborted" when hook.Participant is { } p:
            {
                var stay = await db.MeetingAttendance.SingleOrDefaultAsync(a => a.SessionId == p.Sid, ct);
                if (stay is null)
                {
                    // Someone refused at the door (above) leaves without having attended.
                    if (server is not null && !await MeetingPresence.MayBeInAsync(db, meeting, p.Identity, ct)) return;
                    // The join was missed (the API was down): record the stay from the leave.
                    db.MeetingAttendance.Add(new MeetingAttendance
                    {
                        MeetingId = meeting.Id, PersonId = p.Identity, Role = await RoleAsync(db, meeting, p.Identity, ct), SessionId = p.Sid,
                        JoinedAt = Here(p.JoinedAt ?? hook.At), LeftAt = now,
                    });
                }
                else if (stay.LeftAt is null) stay.LeftAt = now;
                break;
            }
            case "room_finished":
            {
                var at = meeting.EndedAt is { } ended && ended < now ? ended : now;
                await db.MeetingAttendance.Where(a => a.MeetingId == meeting.Id && a.LeftAt == null).ForEachAsync(a => a.LeftAt = at, ct);
                // Closed by the media server: everyone left (or nobody came) and the room's wait ran out.
                if (meeting.StartedAt is not null && meeting.EndedAt is null)
                {
                    meeting.EndedAt = now;
                    meeting.EndReason = MeetingEndReason.Empty;
                }
                break;
            }
            default:
                return;
        }
        db.Actor = LmsDbContext.SystemActor;
        try { await db.SaveChangesAsync(ct); }
        // The same join delivered twice at once: the unique session id refuses the second.
        catch (DbUpdateException) when (hook.Event == "participant_joined") { }
    }

    private static async Task<string> RoleAsync(LmsDbContext db, OnlineMeeting meeting, string identity, CancellationToken ct) =>
        await db.IsmsClasses.AnyAsync(c => c.Id == meeting.ClassId && c.InstructorId == identity, ct) ? CurrentUser.Instructor : CurrentUser.Student;
}

internal sealed record WebhookParticipant(string Sid, string Identity, DateTime? JoinedAt);

/// <summary>The parts of a LiveKit webhook event the LMS uses. Times are Unix seconds, sent as strings.</summary>
internal sealed record WebhookEvent(string Event, string Room, WebhookParticipant? Participant, DateTime At)
{
    public static WebhookEvent? Read(byte[] body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        if (root.ValueKind != JsonValueKind.Object) return null;
        var name = Str(root, "event");
        var room = root.TryGetProperty("room", out var r) && r.ValueKind == JsonValueKind.Object ? Str(r, "name") : "";
        WebhookParticipant? participant = null;
        if (root.TryGetProperty("participant", out var p) && p.ValueKind == JsonValueKind.Object && Str(p, "sid") is { Length: > 0 } sid)
        {
            var joined = Millis(p, "joinedAtMs") ?? Seconds(p, "joinedAt");
            participant = new WebhookParticipant(sid, Str(p, "identity"), joined);
        }
        return new WebhookEvent(name, room, participant, Seconds(root, "createdAt") ?? DateTime.UtcNow);
    }

    private static string Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static long? Number(JsonElement e, string name) =>
        !e.TryGetProperty(name, out var v) ? null
        : v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var n) ? n
        : v.ValueKind == JsonValueKind.String && long.TryParse(v.GetString(), out var s) ? s
        : null;

    private static DateTime? Seconds(JsonElement e, string name) =>
        Number(e, name) is { } s and > 0 ? DateTimeOffset.FromUnixTimeSeconds(s).UtcDateTime : null;

    private static DateTime? Millis(JsonElement e, string name) =>
        Number(e, name) is { } ms and > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime : null;
}
