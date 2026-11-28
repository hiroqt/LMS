using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Meetings;

/// <summary>
/// Who may be in a meeting's room, checked when they arrive and when the class list changes, not
/// only when their join pass was issued. The media server can't take a pass back, and it hands
/// connected people fresh passes, so a student removed from the meeting or dropped from the class
/// list could otherwise come back with one they already hold (D-072).
/// </summary>
internal static class MeetingPresence
{
    /// <summary>The class's instructor, or a student on the active class list whom the instructor hasn't removed from this meeting.</summary>
    public static async Task<bool> MayBeInAsync(LmsDbContext db, OnlineMeeting meeting, string identity, CancellationToken ct)
    {
        if (await db.IsmsClasses.AnyAsync(c => c.Id == meeting.ClassId && c.InstructorId == identity, ct)) return true;
        if (meeting.EndedAt is not null || MeetingEndpoints.Removed(meeting).Contains(identity)) return false;
        return await db.IsmsClassStudents.AnyAsync(s => s.ClassId == meeting.ClassId && s.StudentId == identity && s.IsActive, ct);
    }

    /// <summary>
    /// Disconnects students who just left a class list from that class's live meetings. A media
    /// server that can't be reached is logged, not fatal: the webhook check refuses them if they
    /// come back.
    /// </summary>
    public static async Task RemoveDroppedAsync(LmsDbContext db, IMeetingServer server, IReadOnlyCollection<(string ClassId, string StudentId)> dropped,
        ILogger logger, CancellationToken ct)
    {
        if (dropped.Count == 0) return;
        var classIds = dropped.Select(d => d.ClassId).Distinct().ToList();
        var live = await db.Meetings.AsNoTracking()
            .Where(m => classIds.Contains(m.ClassId) && m.StartedAt != null && m.EndedAt == null)
            .Select(m => new { m.ClassId, m.RoomName }).ToListAsync(ct);
        foreach (var meeting in live)
            foreach (var (_, studentId) in dropped.Where(d => d.ClassId == meeting.ClassId))
            {
                try { await server.RemoveParticipantAsync(meeting.RoomName, studentId, ct); }
                catch (MeetingServerException e)
                {
                    if (!e.Off) logger.LogWarning(e, "Couldn't disconnect a student who left the class list from a live meeting");
                }
            }
    }
}
