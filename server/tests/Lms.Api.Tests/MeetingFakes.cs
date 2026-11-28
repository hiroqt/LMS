using System.Collections.Concurrent;
using Lms.Api.Meetings;

namespace Lms.Api.Tests;

/// <summary>
/// Stands in for the LiveKit media server (D-070): rooms and the people in them, with LiveKit's
/// rules where they matter. A source taken away is unpublished; a muted track stays muted. Records
/// every call. The real server's behaviour is checked by LiveKitContractTests.
/// </summary>
public sealed class FakeMeetingServer : IMeetingServer
{
    public sealed record Call(string Method, string Room, string? Identity = null, object? Detail = null);

    public ConcurrentQueue<Call> Calls { get; } = new();
    public ConcurrentDictionary<string, string> Rooms { get; } = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, MeetingParticipant>> _people = new();

    /// <summary>Every call fails as if the server were unreachable (or turned off).</summary>
    public bool Down { get; set; }
    public bool Off { get; set; }
    /// <summary>Every call is refused because the LMS's key or secret is wrong.</summary>
    public bool RejectKey { get; set; }
    /// <summary>Only sending data fails, after everything before it worked.</summary>
    public bool FailSendData { get; set; }

    public IEnumerable<Call> CallsTo(string method) => Calls.Where(c => c.Method == method);

    /// <summary>Puts someone in a room, as if they had joined with a pass.</summary>
    public void Join(string room, string identity, MeetingPermission permission, params MeetingTrack[] tracks) =>
        People(room)[identity] = new MeetingParticipant(identity, identity, tracks, permission, new Dictionary<string, string>());

    public MeetingParticipant? Person(string room, string identity) => People(room).GetValueOrDefault(identity);

    private ConcurrentDictionary<string, MeetingParticipant> People(string room) => _people.GetOrAdd(room, _ => new());

    private void Record(string method, string room, string? identity = null, object? detail = null)
    {
        if (Off) throw new MeetingServerException("off", off: true);
        if (Down) throw new MeetingServerException("down");
        if (RejectKey) throw new MeetingServerException("refused", code: "unauthenticated");
        Calls.Enqueue(new Call(method, room, identity, detail));
    }

    public Task CreateRoomAsync(string room, string metadata, TimeSpan emptyTimeout, CancellationToken ct)
    {
        Record(nameof(CreateRoomAsync), room, detail: metadata);
        Rooms[room] = metadata;
        return Task.CompletedTask;
    }

    public Task DeleteRoomAsync(string room, CancellationToken ct)
    {
        Record(nameof(DeleteRoomAsync), room);
        Rooms.TryRemove(room, out _);
        _people.TryRemove(room, out _);
        return Task.CompletedTask;
    }

    public Task UpdateRoomMetadataAsync(string room, string metadata, CancellationToken ct)
    {
        Record(nameof(UpdateRoomMetadataAsync), room, detail: metadata);
        Rooms[room] = metadata;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<MeetingParticipant>> ListParticipantsAsync(string room, CancellationToken ct)
    {
        Record(nameof(ListParticipantsAsync), room);
        return Task.FromResult<IReadOnlyList<MeetingParticipant>>(People(room).Values.OrderBy(p => p.Identity, StringComparer.Ordinal).ToList());
    }

    public Task<MeetingParticipant?> GetParticipantAsync(string room, string identity, CancellationToken ct)
    {
        Record(nameof(GetParticipantAsync), room, identity);
        return Task.FromResult(People(room).GetValueOrDefault(identity));
    }

    public Task UpdateParticipantAsync(string room, string identity, MeetingPermission permission, IReadOnlyDictionary<string, string>? attributes, CancellationToken ct)
    {
        Record(nameof(UpdateParticipantAsync), room, identity, (permission, attributes));
        if (People(room).TryGetValue(identity, out var p))
        {
            var allowed = permission.CanPublish ? permission.Sources : [];
            var merged = new Dictionary<string, string>(p.Attributes);
            foreach (var (key, value) in attributes ?? new Dictionary<string, string>())
                if (value.Length == 0) merged.Remove(key); else merged[key] = value;
            People(room)[identity] = p with { Permission = permission, Tracks = p.Tracks.Where(t => allowed.Contains(t.Source)).ToList(), Attributes = merged };
        }
        return Task.CompletedTask;
    }

    public Task SetAttributesAsync(string room, string identity, IReadOnlyDictionary<string, string> attributes, CancellationToken ct)
    {
        Record(nameof(SetAttributesAsync), room, identity, attributes);
        if (People(room).TryGetValue(identity, out var p))
        {
            var merged = new Dictionary<string, string>(p.Attributes);
            foreach (var (key, value) in attributes)
                if (value.Length == 0) merged.Remove(key); else merged[key] = value;
            People(room)[identity] = p with { Attributes = merged };
        }
        return Task.CompletedTask;
    }

    public Task MuteTrackAsync(string room, string identity, string trackSid, CancellationToken ct)
    {
        Record(nameof(MuteTrackAsync), room, identity, trackSid);
        if (People(room).TryGetValue(identity, out var p))
            People(room)[identity] = p with { Tracks = p.Tracks.Select(t => t.Sid == trackSid ? t with { Muted = true } : t).ToList() };
        return Task.CompletedTask;
    }

    public Task RemoveParticipantAsync(string room, string identity, CancellationToken ct)
    {
        Record(nameof(RemoveParticipantAsync), room, identity);
        People(room).TryRemove(identity, out _);
        return Task.CompletedTask;
    }

    public Task SendDataAsync(string room, string topic, byte[] data, IReadOnlyList<string>? to, CancellationToken ct)
    {
        if (FailSendData) throw new MeetingServerException("down");
        Record(nameof(SendDataAsync), room, detail: (topic, System.Text.Encoding.UTF8.GetString(data), to));
        return Task.CompletedTask;
    }
}
