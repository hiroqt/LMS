using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Demo;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Meetings;

/// <summary>
/// What each person may publish, from the meeting's settings (D-072, decision 7). The media
/// server enforces it: a source missing here is refused, and one taken away during the meeting
/// is unpublished at once.
/// </summary>
public static class MeetingRights
{
    /// <summary>Participant attributes the page reads: who is the host, and who the host let speak.</summary>
    public const string RoleAttribute = "lms.role";
    public const string LetSpeakAttribute = "lms.letSpeak";
    /// <summary>When the person raised their hand (the API's clock, ISO 8601), or absent. Late joiners see it; the order is one clock's.</summary>
    public const string HandAttribute = "lms.hand";

    public static readonly IReadOnlyList<string> AllSources =
        [MeetingSource.Camera, MeetingSource.Microphone, MeetingSource.ScreenShare, MeetingSource.ScreenShareAudio];

    public static MeetingPermission ForInstructor() => new(true, true, true, AllSources);

    /// <param name="letSpeak">The instructor let this student speak while students may not turn on their own mic.</param>
    public static MeetingPermission ForStudent(OnlineMeeting meeting, bool letSpeak = false)
    {
        var sources = new List<string>();
        if (meeting.StudentsMayVideo) sources.Add(MeetingSource.Camera);
        if (meeting.StudentsMayUnmute || letSpeak) sources.Add(MeetingSource.Microphone);
        if (meeting.StudentsMayShareScreen) sources.AddRange([MeetingSource.ScreenShare, MeetingSource.ScreenShareAudio]);
        // The media server reads an empty source list as "everything", so nothing to publish is can't-publish.
        return new MeetingPermission(true, sources.Count > 0, true, sources);
    }

    public static MeetingPermission For(string role, OnlineMeeting meeting, bool letSpeak = false) =>
        role == CurrentUser.Instructor ? ForInstructor() : ForStudent(meeting, letSpeak);

    public static MeetingGrant Grant(string room, MeetingPermission permission) => new()
    {
        Room = room,
        RoomJoin = true,
        CanSubscribe = permission.CanSubscribe,
        CanPublish = permission.CanPublish,
        CanPublishData = permission.CanPublishData,
        CanPublishSources = permission.CanPublish ? permission.Sources : null,
        CanUpdateOwnMetadata = false,
    };

    public static bool IsLetSpeak(MeetingParticipant participant) =>
        participant.Attributes.TryGetValue(LetSpeakAttribute, out var value) && value == "true";
}

/// <summary>Room names, the room metadata the page reads, and the database a webhook's room belongs to.</summary>
public sealed class MeetingRooms(IServiceProvider services, IHttpContextAccessor http, TimeProvider time)
{
    /// <summary>Between the Demo sandbox and the random part of a room name. Sandbox names never contain it.</summary>
    public const char SandboxSeparator = '.';

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public string NewRoomName()
    {
        var id = Guid.NewGuid().ToString("N");
        return services.GetService<DemoDatabases>() is null ? id : $"{DemoDatabases.SandboxOf(http.HttpContext)}{SandboxSeparator}{id}";
    }

    /// <summary>The room's metadata: what every page in the meeting shows (saving the chat, the lock, the student rights).</summary>
    public static string Metadata(OnlineMeeting m) => JsonSerializer.Serialize(new
    {
        title = m.Title,
        locked = m.Locked,
        saveChat = m.SaveChat,
        students = new
        {
            joinMuted = m.StudentsJoinMuted,
            mayUnmute = m.StudentsMayUnmute,
            mayVideo = m.StudentsMayVideo,
            mayShareScreen = m.StudentsMayShareScreen,
            mayChat = m.StudentsMayChat,
        },
    }, Json);

    /// <summary>
    /// The database that holds the meeting of a webhook's room. Webhooks carry no sandbox header,
    /// so in Demo mode the sandbox comes from the room name (L-104). Dispose it when
    /// <c>Owned</c> is true.
    /// </summary>
    public async Task<(LmsDbContext Db, bool Owned)> DatabaseForRoomAsync(string room)
    {
        if (services.GetService<DemoDatabases>() is not { } demo) return (services.GetRequiredService<LmsDbContext>(), false);
        var cut = room.IndexOf(SandboxSeparator);
        var sandbox = cut > 0 ? room[..cut] : "default";
        if (sandbox.Length > 40 || !sandbox.All(c => char.IsAsciiLetterOrDigit(c) || c == '-')) sandbox = "default";
        await demo.EnsureReadyAsync(sandbox);
        return (new LmsDbContext(new DbContextOptionsBuilder<LmsDbContext>().UseSqlite(demo.ConnectionString(sandbox)).Options, time), true);
    }
}
