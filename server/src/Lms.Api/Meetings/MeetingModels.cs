using Lms.Api.Data;

namespace Lms.Api.Meetings;

public sealed record MeetingSettingsDto(bool StudentsJoinMuted, bool StudentsMayUnmute, bool StudentsMayVideo, bool StudentsMayShareScreen,
    bool StudentsMayChat, bool SaveChat);

public sealed record MeetingDto(long Id, string ClassId, string Title, string Status, DateTime? ScheduledStart, DateTime? StartedAt,
    DateTime? EndedAt, string? EndReason, bool Locked, MeetingSettingsDto Settings, int SavedChatMessages);

/// <summary>Any field left out keeps its value (or its default on a new meeting).</summary>
public sealed record MeetingSettingsInput(bool? StudentsJoinMuted = null, bool? StudentsMayUnmute = null, bool? StudentsMayVideo = null,
    bool? StudentsMayShareScreen = null, bool? StudentsMayChat = null, bool? SaveChat = null);

/// <summary>Schedule a meeting, or start one now (<c>StartNow</c>).</summary>
public sealed record MeetingCreate(string? Title = null, DateTimeOffset? ScheduledStart = null, bool? StartNow = null, MeetingSettingsInput? Settings = null);

/// <summary>The title until the meeting ends, the time until it starts, the lock and settings while it is live.</summary>
public sealed record MeetingUpdate(string? Title = null, DateTimeOffset? ScheduledStart = null, bool? Locked = null, MeetingSettingsInput? Settings = null);

/// <summary>What the page needs to connect: the media server, a pass for this person, and the meeting.</summary>
public sealed record MeetingJoinDto(string ServerUrl, string Token, DateTimeOffset ExpiresAt, string Identity, string Name, string Role, MeetingDto Meeting);

public sealed record MeetingChatInput(string? Text);

/// <summary>
/// One chat message, as sent into the meeting (topic <c>lms.chat</c>, from the server) and as
/// saved. <c>Key</c> lets the sender's page match the broadcast to its own send.
/// </summary>
public sealed record MeetingChatMessageDto(string Key, long? Id, string SenderId, string SenderName, string SenderRole, string Text, DateTime SentAt, bool Saved);

public sealed record MeetingLetSpeakInput(bool? Allowed);

public sealed record MeetingHandInput(bool? Raised);

/// <summary>One of the viewer's meetings, with its class's name, for a dashboard.</summary>
public sealed record MyMeetingDto(MeetingDto Meeting, string ClassName);

public sealed record MeetingAttendancePersonDto(string PersonId, string Name, string Role, bool OnClassList, bool Joined,
    DateTime? FirstJoinedAt, DateTime? LastLeftAt, int Stays, int MinutesIn);

public sealed record MeetingAttendanceDto(long MeetingId, int StudentsJoined, int StudentsOnClassList, IReadOnlyList<MeetingAttendancePersonDto> People);

/// <summary>Data-message topics the page listens to. Only messages from the server (no sender) are trusted for these.</summary>
public static class MeetingTopic
{
    public const string Chat = "lms.chat";
    public const string AskUnmute = "lms.ask-unmute";
}

internal static class MeetingMapper
{
    public static string StatusOf(OnlineMeeting m) =>
        m.EndedAt is not null ? MeetingStatus.Ended : m.StartedAt is not null ? MeetingStatus.Live : MeetingStatus.Scheduled;

    public static MeetingDto ToDto(OnlineMeeting m, int savedChat) => new(m.Id, m.ClassId, m.Title, StatusOf(m), m.ScheduledStart, m.StartedAt,
        m.EndedAt, m.EndReason, m.Locked,
        new MeetingSettingsDto(m.StudentsJoinMuted, m.StudentsMayUnmute, m.StudentsMayVideo, m.StudentsMayShareScreen, m.StudentsMayChat, m.SaveChat),
        savedChat);

    public static void Apply(OnlineMeeting m, MeetingSettingsInput? s)
    {
        if (s is null) return;
        m.StudentsJoinMuted = s.StudentsJoinMuted ?? m.StudentsJoinMuted;
        m.StudentsMayUnmute = s.StudentsMayUnmute ?? m.StudentsMayUnmute;
        m.StudentsMayVideo = s.StudentsMayVideo ?? m.StudentsMayVideo;
        m.StudentsMayShareScreen = s.StudentsMayShareScreen ?? m.StudentsMayShareScreen;
        m.StudentsMayChat = s.StudentsMayChat ?? m.StudentsMayChat;
        m.SaveChat = s.SaveChat ?? m.SaveChat;
    }
}
