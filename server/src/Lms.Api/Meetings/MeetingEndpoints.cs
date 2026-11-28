using System.Text;
using System.Text.Json;
using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Files;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Lms.Api.Meetings;

/// <summary>
/// Class meetings (D-072, docs/MEETINGS_PLAN.md). The class's instructor schedules, starts, runs,
/// and ends them; the instructor and the students on the class list join them. Everyone else gets
/// the same 404 as for a class they can't see. The media server enforces what each person may
/// publish; these endpoints decide it.
/// </summary>
public static class MeetingEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapMeetingEndpoints(this IEndpointRouteBuilder app)
    {
        // The viewer's live meetings and the next two weeks', across their classes: for the dashboards, polled.
        app.MapGroup("/api/me").RequireDemoUser().MapGet("/meetings", async (HttpContext http, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var classes = await (user.IsInstructor
                ? db.IsmsClasses.AsNoTracking().Where(c => c.IsActive && c.InstructorId == user.Id)
                : db.IsmsClasses.AsNoTracking().Where(c => c.IsActive && db.IsmsClassStudents.Any(s => s.ClassId == c.Id && s.StudentId == user.Id && s.IsActive)))
                .Select(c => new { c.Id, c.SubjectName }).ToListAsync(ct);
            var ids = classes.Select(c => c.Id).ToList();
            var now = time.GetUtcNow().UtcDateTime;
            var until = now.AddDays(14);
            var meetings = await db.Meetings.AsNoTracking()
                .Where(m => ids.Contains(m.ClassId) && m.EndedAt == null && (m.StartedAt != null || (m.ScheduledStart != null && m.ScheduledStart >= now.AddHours(-1) && m.ScheduledStart <= until)))
                .ToListAsync(ct);
            var names = classes.ToDictionary(c => c.Id, c => c.SubjectName);
            return TypedResults.Ok(meetings
                .OrderBy(m => m.StartedAt == null).ThenBy(m => m.StartedAt == null ? m.ScheduledStart : null).ThenByDescending(m => m.StartedAt).ThenBy(m => m.Id)
                .Take(10)
                .Select(m => new MyMeetingDto(MeetingMapper.ToDto(m, 0), names.GetValueOrDefault(m.ClassId, ""))).ToList());
        }).WithName("ListMyMeetings");

        var group = app.MapGroup("/api/classes/{classId}/meetings").RequireDemoUser();

        group.MapGet("", async Task<IResult> (string classId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForReadAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var meetings = await db.Meetings.AsNoTracking().Where(m => m.ClassId == classId).ToListAsync(ct);
            var ids = meetings.Select(m => m.Id).ToList();
            var saved = await db.MeetingChatMessages.AsNoTracking().Where(c => ids.Contains(c.MeetingId))
                .GroupBy(c => c.MeetingId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count, ct);
            // Live first, then upcoming soonest first, then past newest first.
            var live = meetings.Where(m => MeetingMapper.StatusOf(m) == MeetingStatus.Live).OrderByDescending(m => m.StartedAt);
            var upcoming = meetings.Where(m => MeetingMapper.StatusOf(m) == MeetingStatus.Scheduled).OrderBy(m => m.ScheduledStart ?? DateTime.MaxValue).ThenBy(m => m.Id);
            var past = meetings.Where(m => MeetingMapper.StatusOf(m) == MeetingStatus.Ended).OrderByDescending(m => m.EndedAt).ThenByDescending(m => m.Id);
            return TypedResults.Ok(live.Concat(upcoming).Concat(past).Select(m => MeetingMapper.ToDto(m, saved.GetValueOrDefault(m.Id))).ToList());
        }).WithName("ListMeetings");

        group.MapGet("/{meetingId:long}", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForReadAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            return meeting is null ? MeetingNotFound() : TypedResults.Ok(await DtoAsync(db, meeting, ct));
        }).WithName("GetMeeting");

        group.MapPost("", async Task<IResult> (string classId, MeetingCreate input, HttpContext http, ClassAccess access, LmsDbContext db,
            IMeetingServer server, MeetingRooms rooms, IOptions<MeetingOptions> options, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (room, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var now = time.GetUtcNow().UtcDateTime;
            var errors = new Errors();
            var title = errors.Optional("title", input.Title, MeetingLimits.TitleLength) ?? $"{room!.SubjectName} meeting";
            var startNow = input.StartNow == true;
            var scheduled = input.ScheduledStart?.UtcDateTime;
            if (!startNow && scheduled is null) errors.Add("scheduledStart", "Choose when the meeting starts, or start it now.");
            else if (scheduled is { } at && !startNow && (at < now.AddMinutes(-5) || at > now.AddDays(366)))
                errors.Add("scheduledStart", "Choose a time from now to a year ahead.");
            if (errors.Any) return errors.Result();

            var meeting = new OnlineMeeting { ClassId = classId, Title = title, ScheduledStart = scheduled, RoomName = rooms.NewRoomName() };
            MeetingMapper.Apply(meeting, input.Settings);
            if (startNow)
            {
                if (await LiveMeetingAsync(db, classId, ct) is { } live) return AlreadyLive(live);
                // The room first: if the media server refuses, nothing is saved.
                await server.CreateRoomAsync(meeting.RoomName, MeetingRooms.Metadata(meeting), EmptyTimeout(options), ct);
                meeting.StartedAt = now;
            }
            await ContentEndpoints.SaveWithAuditAsync(db, user, meeting, startNow ? "started" : "scheduled", "Meeting", () => meeting.Id, ct, "meetings");
            return TypedResults.Created($"/api/classes/{classId}/meetings/{meeting.Id}", MeetingMapper.ToDto(meeting, 0));
        }).WithName("CreateMeeting");

        group.MapPatch("/{meetingId:long}", async Task<IResult> (string classId, long meetingId, MeetingUpdate input, HttpContext http, ClassAccess access,
            LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            if (meeting is null) return MeetingNotFound();
            if (meeting.EndedAt is not null) return Conflict("This meeting has ended, so it can't be changed.", "ended");

            var errors = new Errors();
            if (input.Title is not null) meeting.Title = errors.Required("title", input.Title, MeetingLimits.TitleLength, "a title") ?? meeting.Title;
            if (input.ScheduledStart is { } at)
            {
                if (meeting.StartedAt is not null) errors.Add("scheduledStart", "The meeting has already started.");
                else meeting.ScheduledStart = at.UtcDateTime;
            }
            if (errors.Any) return errors.Result();

            var before = (meeting.StudentsMayUnmute, meeting.StudentsMayVideo, meeting.StudentsMayShareScreen);
            meeting.Locked = input.Locked ?? meeting.Locked;
            MeetingMapper.Apply(meeting, input.Settings);
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "updated", "Meeting", () => meeting.Id, ct, "meetings");

            // A live meeting changes at once: every student's rights, then what every page shows.
            if (meeting.StartedAt is not null)
            {
                if (before != (meeting.StudentsMayUnmute, meeting.StudentsMayVideo, meeting.StudentsMayShareScreen))
                    await ApplyStudentRightsAsync(server, meeting, await InstructorOfAsync(db, classId, ct), ct);
                await server.UpdateRoomMetadataAsync(meeting.RoomName, MeetingRooms.Metadata(meeting), ct);
            }
            return TypedResults.Ok(await DtoAsync(db, meeting, ct));
        }).WithName("UpdateMeeting");

        group.MapDelete("/{meetingId:long}", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            if (meeting is null) return MeetingNotFound();
            if (meeting.StartedAt is not null) return Conflict("Only a meeting that hasn't started can be deleted.", "started");
            db.Meetings.Remove(meeting);
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "deleted", "Meeting", () => meetingId, ct, "meetings");
            return TypedResults.NoContent();
        }).WithName("DeleteMeeting");

        group.MapPost("/{meetingId:long}/start", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db,
            IMeetingServer server, IOptions<MeetingOptions> options, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            if (meeting is null) return MeetingNotFound();
            if (meeting.EndedAt is not null) return Conflict("This meeting has ended. Start a new one.", "ended");
            if (meeting.StartedAt is not null) return TypedResults.Ok(await DtoAsync(db, meeting, ct));
            if (await LiveMeetingAsync(db, classId, ct) is { } live) return AlreadyLive(live);
            await server.CreateRoomAsync(meeting.RoomName, MeetingRooms.Metadata(meeting), EmptyTimeout(options), ct);
            meeting.StartedAt = time.GetUtcNow().UtcDateTime;
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "started", "Meeting", () => meeting.Id, ct, "meetings");
            return TypedResults.Ok(await DtoAsync(db, meeting, ct));
        }).WithName("StartMeeting");

        group.MapPost("/{meetingId:long}/end", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db,
            IMeetingServer server, TimeProvider time, ILoggerFactory loggers, CancellationToken ct) =>
        {
            var (meeting, denied) = await HostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            if (meeting!.EndedAt is not null) return TypedResults.Ok(await DtoAsync(db, meeting, ct));
            if (meeting.StartedAt is null) return Conflict("This meeting hasn't started.", "not_started");
            // The meeting ends here even if the media server can't be reached: nobody gets a new pass.
            try { await server.DeleteRoomAsync(meeting.RoomName, ct); }
            catch (MeetingServerException e) when (!e.Off)
            {
                loggers.CreateLogger(typeof(MeetingEndpoints)).LogWarning(e, "Meeting {Id} ended, but its room couldn't be closed", meeting.Id);
            }
            var now = time.GetUtcNow().UtcDateTime;
            meeting.EndedAt = now;
            meeting.EndReason = MeetingEndReason.Instructor;
            await db.MeetingAttendance.Where(a => a.MeetingId == meeting.Id && a.LeftAt == null).ForEachAsync(a => a.LeftAt = now, ct);
            await ContentEndpoints.SaveWithAuditAsync(db, http.CurrentUser(), null, "ended", "Meeting", () => meeting.Id, ct, "meetings");
            return TypedResults.Ok(await DtoAsync(db, meeting, ct));
        }).WithName("EndMeeting");

        group.MapPost("/{meetingId:long}/join", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db,
            MeetingTokens tokens, IOptions<MeetingOptions> options, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (room, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            if (meeting is null) return MeetingNotFound();
            if (!options.Value.Configured) throw new MeetingServerException("Class meetings are off on this server.", off: true);
            if (meeting.EndedAt is not null) return Conflict("This meeting has ended.", "ended");
            if (meeting.StartedAt is null) return Conflict("The instructor hasn't started this meeting yet.", "not_started");
            if (user.IsStudent)
            {
                if (Removed(meeting).Contains(user.Id))
                    return Forbidden("The instructor removed you from this meeting.", "removed");
                // A locked meeting still lets back in whoever was already in it (a reload, a new device).
                if (meeting.Locked && !await db.MeetingAttendance.AnyAsync(a => a.MeetingId == meeting.Id && a.PersonId == user.Id, ct))
                    return Forbidden("The instructor has locked this meeting.", "locked");
            }
            var name = user.IsInstructor ? room!.InstructorName : await StudentNameAsync(db, classId, user.Id, ct) ?? user.Id;
            var permission = MeetingRights.For(user.Role, meeting);
            var (token, expires) = tokens.JoinPass(user.Id, name, MeetingRights.Grant(meeting.RoomName, permission),
                new Dictionary<string, string> { [MeetingRights.RoleAttribute] = user.Role });
            return TypedResults.Ok(new MeetingJoinDto(options.Value.Url!, token, expires, user.Id, name, user.Role, await DtoAsync(db, meeting, ct)));
        }).WithName("JoinMeeting");

        // ---------------------------------------------------------------- host controls

        group.MapPost("/{meetingId:long}/people/{personId}/mute", async Task<IResult> (string classId, long meetingId, string personId, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            var person = await server.GetParticipantAsync(meeting!.RoomName, personId, ct);
            if (person is null) return NotInMeeting();
            foreach (var mic in person.Tracks.Where(t => t.Source == MeetingSource.Microphone && !t.Muted))
                await server.MuteTrackAsync(meeting.RoomName, personId, mic.Sid, ct);
            return TypedResults.NoContent();
        }).WithName("MuteMeetingPerson");

        group.MapPost("/{meetingId:long}/mute-all", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access,
            LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            var host = http.CurrentUser().Id;
            var muted = 0;
            foreach (var person in await server.ListParticipantsAsync(meeting!.RoomName, ct))
            {
                if (person.Identity == host) continue;
                foreach (var mic in person.Tracks.Where(t => t.Source == MeetingSource.Microphone && !t.Muted))
                {
                    await server.MuteTrackAsync(meeting.RoomName, person.Identity, mic.Sid, ct);
                    muted++;
                }
            }
            return TypedResults.Ok(new { muted });
        }).WithName("MuteEveryone");

        group.MapPost("/{meetingId:long}/people/{personId}/let-speak", async Task<IResult> (string classId, long meetingId, string personId, MeetingLetSpeakInput input,
            HttpContext http, ClassAccess access, LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            if (meeting!.StudentsMayUnmute) return Conflict("Students may already turn on their own mic in this meeting.", "students_may_unmute");
            var person = await server.GetParticipantAsync(meeting.RoomName, personId, ct);
            if (person is null || person.Identity == http.CurrentUser().Id) return NotInMeeting();
            var allowed = input.Allowed ?? true;
            await server.UpdateParticipantAsync(meeting.RoomName, personId, MeetingRights.ForStudent(meeting, allowed),
                new Dictionary<string, string> { [MeetingRights.LetSpeakAttribute] = allowed ? "true" : "" }, ct);
            return TypedResults.NoContent();
        }).WithName("LetMeetingPersonSpeak");

        group.MapPost("/{meetingId:long}/people/{personId}/ask-unmute", async Task<IResult> (string classId, long meetingId, string personId, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            var person = await server.GetParticipantAsync(meeting!.RoomName, personId, ct);
            if (person is null || person.Identity == http.CurrentUser().Id) return NotInMeeting();
            if (!meeting.StudentsMayUnmute && !MeetingRights.IsLetSpeak(person))
                return Conflict("Let them speak first: students can't turn on their mic in this meeting.", "may_not_unmute");
            var from = await InstructorNameAsync(db, classId, ct);
            await server.SendDataAsync(meeting.RoomName, MeetingTopic.AskUnmute, JsonSerializer.SerializeToUtf8Bytes(new { from }, Json), [personId], ct);
            return TypedResults.NoContent();
        }).WithName("AskMeetingPersonToUnmute");

        group.MapPost("/{meetingId:long}/people/{personId}/stop-share", async Task<IResult> (string classId, long meetingId, string personId, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            var person = await server.GetParticipantAsync(meeting!.RoomName, personId, ct);
            if (person is null || person.Identity == http.CurrentUser().Id) return NotInMeeting();
            if (!person.Tracks.Any(t => t.Source is MeetingSource.ScreenShare or MeetingSource.ScreenShareAudio))
                return Conflict("They aren't sharing their screen.", "not_sharing");
            // Taking the screen away unpublishes it at once; giving it back lets them share again later.
            var rights = MeetingRights.ForStudent(meeting, MeetingRights.IsLetSpeak(person));
            var noScreen = rights.Sources.Where(s => s is not (MeetingSource.ScreenShare or MeetingSource.ScreenShareAudio)).ToList();
            await server.UpdateParticipantAsync(meeting.RoomName, personId, rights with { Sources = noScreen, CanPublish = noScreen.Count > 0 }, null, ct);
            await server.UpdateParticipantAsync(meeting.RoomName, personId, rights, null, ct);
            return TypedResults.NoContent();
        }).WithName("StopMeetingPersonShare");

        group.MapPost("/{meetingId:long}/people/{personId}/remove", async Task<IResult> (string classId, long meetingId, string personId, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            if (!await db.IsmsClassStudents.AnyAsync(s => s.ClassId == classId && s.StudentId == personId, ct)) return NotInMeeting();
            await server.RemoveParticipantAsync(meeting!.RoomName, personId, ct);
            var removed = Removed(meeting);
            if (removed.Add(personId)) meeting.RemovedJson = JsonSerializer.Serialize(removed.Order(StringComparer.Ordinal));
            await ContentEndpoints.SaveWithAuditAsync(db, http.CurrentUser(), null, "removed a person", "Meeting", () => meeting.Id, ct, "meetings");
            return TypedResults.NoContent();
        }).WithName("RemoveMeetingPerson");

        // ---------------------------------------------------------------- hands

        // Raise or lower one's own hand. Kept as a participant attribute, so people who join later see it.
        group.MapPost("/{meetingId:long}/hand", async Task<IResult> (string classId, long meetingId, MeetingHandInput input, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            if (meeting is null) return MeetingNotFound();
            if (meeting.StartedAt is null || meeting.EndedAt is not null) return Conflict("This meeting isn't on now.", "not_live");
            if (await server.GetParticipantAsync(meeting.RoomName, user.Id, ct) is null) return Conflict("Join the meeting first.", "not_in_meeting");
            var raised = input.Raised ?? true;
            var value = raised ? time.GetUtcNow().UtcDateTime.ToString("O", System.Globalization.CultureInfo.InvariantCulture) : "";
            await server.SetAttributesAsync(meeting.RoomName, user.Id, new Dictionary<string, string> { [MeetingRights.HandAttribute] = value }, ct);
            return TypedResults.NoContent();
        }).WithName("RaiseMeetingHand").RequireRateLimiting(MeetingOptions.HandPolicy)
          .WithMetadata(new RateLimitTitle("Too many hand changes. Wait a minute and try again."));

        // The instructor lowers someone's hand (after answering them).
        group.MapPost("/{meetingId:long}/people/{personId}/lower-hand", async Task<IResult> (string classId, long meetingId, string personId, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, CancellationToken ct) =>
        {
            var (meeting, denied) = await LiveHostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            if (await server.GetParticipantAsync(meeting!.RoomName, personId, ct) is null) return NotInMeeting();
            await server.SetAttributesAsync(meeting.RoomName, personId, new Dictionary<string, string> { [MeetingRights.HandAttribute] = "" }, ct);
            return TypedResults.NoContent();
        }).WithName("LowerMeetingPersonHand");

        // ---------------------------------------------------------------- chat

        group.MapPost("/{meetingId:long}/chat", async Task<IResult> (string classId, long meetingId, MeetingChatInput input, HttpContext http,
            ClassAccess access, LmsDbContext db, IMeetingServer server, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (room, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
            if (meeting is null) return MeetingNotFound();
            if (meeting.StartedAt is null || meeting.EndedAt is not null) return Conflict("Chat is open only while the meeting is on.", "not_live");
            if (user.IsStudent && !meeting.StudentsMayChat) return Forbidden("The instructor has turned off chat for students.", "chat_off");
            var errors = new Errors();
            var text = errors.Required("text", input.Text, MeetingLimits.ChatLength, "a message");
            if (errors.Any) return errors.Result();
            if (await server.GetParticipantAsync(meeting.RoomName, user.Id, ct) is null) return Conflict("Join the meeting to chat.", "not_in_meeting");

            var name = user.IsInstructor ? room!.InstructorName : await StudentNameAsync(db, classId, user.Id, ct) ?? user.Id;
            var row = new MeetingChatMessage
            {
                MeetingId = meeting.Id, SenderId = user.Id, SenderRole = user.Role, SenderName = name, Text = text!, SentAt = time.GetUtcNow().UtcDateTime,
            };
            if (meeting.SaveChat)
            {
                db.MeetingChatMessages.Add(row);
                await db.SaveChangesAsync(ct);
            }
            var message = new MeetingChatMessageDto(Guid.NewGuid().ToString("N"), meeting.SaveChat ? row.Id : null, row.SenderId, row.SenderName,
                row.SenderRole, row.Text, row.SentAt, meeting.SaveChat);
            try { await server.SendDataAsync(meeting.RoomName, MeetingTopic.Chat, JsonSerializer.SerializeToUtf8Bytes(message, Json), null, ct); }
            catch (MeetingServerException)
            {
                // Not delivered, so not kept either: the saved chat holds only what people saw.
                if (meeting.SaveChat)
                {
                    db.MeetingChatMessages.Remove(row);
                    await db.SaveChangesAsync(CancellationToken.None);
                }
                throw;
            }
            return TypedResults.Ok(message);
        }).WithName("SendMeetingChat").RequireRateLimiting(MeetingOptions.ChatPolicy)
          .WithMetadata(new RateLimitTitle("Too many messages. Wait a minute and try again."));

        group.MapGet("/{meetingId:long}/chat", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForReadAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            if (!await db.Meetings.AnyAsync(m => m.ClassId == classId && m.Id == meetingId, ct)) return MeetingNotFound();
            var rows = await db.MeetingChatMessages.AsNoTracking().Where(c => c.MeetingId == meetingId).OrderBy(c => c.SentAt).ThenBy(c => c.Id).ToListAsync(ct);
            return TypedResults.Ok(rows.Select(c => new MeetingChatMessageDto($"saved-{c.Id}", c.Id, c.SenderId, c.SenderName, c.SenderRole, c.Text, c.SentAt, true)).ToList());
        }).WithName("ListSavedMeetingChat");

        group.MapDelete("/{meetingId:long}/chat", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (meeting, denied) = await HostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            await db.MeetingChatMessages.Where(c => c.MeetingId == meeting!.Id).ExecuteDeleteAsync(ct);
            await ContentEndpoints.SaveWithAuditAsync(db, http.CurrentUser(), null, "deleted the saved chat", "Meeting", () => meeting!.Id, ct, "meetings");
            return TypedResults.NoContent();
        }).WithName("DeleteSavedMeetingChat");

        // ---------------------------------------------------------------- attendance

        group.MapGet("/{meetingId:long}/attendance", async Task<IResult> (string classId, long meetingId, HttpContext http, ClassAccess access,
            LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (meeting, denied) = await HostAsync(classId, meetingId, http, access, db, ct);
            if (denied is not null) return denied;
            return TypedResults.Ok(await MeetingAttendanceReport.BuildAsync(db, meeting!, time.GetUtcNow().UtcDateTime, ct));
        }).WithName("GetMeetingAttendance");

        return app;
    }

    // ---------------------------------------------------------------- helpers

    private static TimeSpan EmptyTimeout(IOptions<MeetingOptions> options) => TimeSpan.FromMinutes(Math.Max(1, options.Value.EmptyRoomMinutes));

    /// <summary>The class's instructor, acting on one of its meetings. Allowed after ISMS stops offering the class, so a live meeting can still be run and ended.</summary>
    private static async Task<(OnlineMeeting? Meeting, IResult? Denied)> HostAsync(string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct)
    {
        var user = http.CurrentUser();
        var (_, denied) = await access.ForReadAsync(classId, user, ct);
        if (denied is not null) return (null, denied);
        if (!user.IsInstructor)
            return (null, TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only the class's instructor can run its meetings."));
        db.Actor = user.Id;
        var meeting = await db.Meetings.SingleOrDefaultAsync(m => m.ClassId == classId && m.Id == meetingId, ct);
        return meeting is null ? (null, MeetingNotFound()) : (meeting, null);
    }

    private static async Task<(OnlineMeeting? Meeting, IResult? Denied)> LiveHostAsync(string classId, long meetingId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct)
    {
        var (meeting, denied) = await HostAsync(classId, meetingId, http, access, db, ct);
        if (denied is not null) return (null, denied);
        if (meeting!.StartedAt is null || meeting.EndedAt is not null) return (null, Conflict("This meeting isn't on now.", "not_live"));
        return (meeting, null);
    }

    /// <summary>Gives every student in the room the rights of the current settings, keeping who was let speak while that still matters.</summary>
    internal static async Task ApplyStudentRightsAsync(IMeetingServer server, OnlineMeeting meeting, string instructorId, CancellationToken ct)
    {
        foreach (var person in await server.ListParticipantsAsync(meeting.RoomName, ct))
        {
            if (person.Identity == instructorId) continue;
            var letSpeak = !meeting.StudentsMayUnmute && MeetingRights.IsLetSpeak(person);
            IReadOnlyDictionary<string, string>? attributes = meeting.StudentsMayUnmute && MeetingRights.IsLetSpeak(person)
                ? new Dictionary<string, string> { [MeetingRights.LetSpeakAttribute] = "" }
                : null;
            await server.UpdateParticipantAsync(meeting.RoomName, person.Identity, MeetingRights.ForStudent(meeting, letSpeak), attributes, ct);
        }
    }

    private static async Task<OnlineMeeting?> LiveMeetingAsync(LmsDbContext db, string classId, CancellationToken ct) =>
        await db.Meetings.AsNoTracking().FirstOrDefaultAsync(m => m.ClassId == classId && m.StartedAt != null && m.EndedAt == null, ct);

    private static async Task<MeetingDto> DtoAsync(LmsDbContext db, OnlineMeeting meeting, CancellationToken ct) =>
        MeetingMapper.ToDto(meeting, await db.MeetingChatMessages.CountAsync(c => c.MeetingId == meeting.Id, ct));

    internal static HashSet<string> Removed(OnlineMeeting meeting) =>
        JsonSerializer.Deserialize<HashSet<string>>(meeting.RemovedJson) ?? [];

    private static async Task<string> InstructorOfAsync(LmsDbContext db, string classId, CancellationToken ct) =>
        await db.IsmsClasses.Where(c => c.Id == classId).Select(c => c.InstructorId).SingleAsync(ct);

    private static async Task<string> InstructorNameAsync(LmsDbContext db, string classId, CancellationToken ct) =>
        await db.IsmsClasses.Where(c => c.Id == classId).Select(c => c.InstructorName).SingleAsync(ct);

    internal static async Task<string?> StudentNameAsync(LmsDbContext db, string classId, string studentId, CancellationToken ct) =>
        await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == classId && s.StudentId == studentId)
            .Select(s => (s.FirstName + " " + s.LastName).Trim()).FirstOrDefaultAsync(ct);

    private static IResult MeetingNotFound() =>
        TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Meeting not found", detail: "No meeting with this id exists in this class.");

    private static IResult NotInMeeting() =>
        TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "That person isn't in this meeting.");

    private static IResult AlreadyLive(OnlineMeeting live) =>
        Conflict($"\"{live.Title}\" is already on in this class. End it before starting another.", "already_live", live.Id);

    private static IResult Conflict(string title, string code, long? meetingId = null) =>
        TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title,
            extensions: meetingId is null ? new Dictionary<string, object?> { ["code"] = code } : new Dictionary<string, object?> { ["code"] = code, ["meetingId"] = meetingId });

    private static IResult Forbidden(string title, string code) =>
        TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: title, extensions: new Dictionary<string, object?> { ["code"] = code });
}

/// <summary>Who came to a meeting and for how long: every stay of each person, overlaps counted once.</summary>
internal static class MeetingAttendanceReport
{
    public static async Task<MeetingAttendanceDto> BuildAsync(LmsDbContext db, OnlineMeeting meeting, DateTime now, CancellationToken ct)
    {
        var room = await db.IsmsClasses.AsNoTracking().SingleAsync(c => c.Id == meeting.ClassId, ct);
        var roster = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == meeting.ClassId).ToListAsync(ct);
        var stays = (await db.MeetingAttendance.AsNoTracking().Where(a => a.MeetingId == meeting.Id).ToListAsync(ct))
            .GroupBy(a => a.PersonId).ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);
        var openUntil = meeting.EndedAt ?? now;

        MeetingAttendancePersonDto Person(string id, string name, string role, bool onList)
        {
            var mine = stays.GetValueOrDefault(id) ?? [];
            var minutes = (int)Math.Round(Covered(mine.Select(s => (s.JoinedAt, s.LeftAt ?? openUntil))).TotalMinutes);
            return new MeetingAttendancePersonDto(id, name, role, onList, mine.Count > 0,
                mine.Count > 0 ? mine.Min(s => s.JoinedAt) : null,
                mine.Count > 0 && mine.All(s => s.LeftAt is not null) ? mine.Max(s => s.LeftAt) : null,
                mine.Count, minutes);
        }

        var people = new List<MeetingAttendancePersonDto> { Person(room.InstructorId, room.InstructorName, CurrentUser.Instructor, true) };
        var active = roster.Where(s => s.IsActive).OrderBy(s => s.LastName, StringComparer.OrdinalIgnoreCase).ThenBy(s => s.FirstName, StringComparer.OrdinalIgnoreCase).ToList();
        people.AddRange(active.Select(s => Person(s.StudentId, $"{s.FirstName} {s.LastName}".Trim(), CurrentUser.Student, true)));
        // Someone who joined but is no longer on the active class list still shows, marked as such.
        foreach (var id in stays.Keys.Where(id => id != room.InstructorId && active.All(s => s.StudentId != id)).Order(StringComparer.Ordinal))
        {
            var known = roster.FirstOrDefault(s => s.StudentId == id);
            people.Add(Person(id, known is null ? id : $"{known.FirstName} {known.LastName}".Trim(), stays[id][0].Role, false));
        }
        var students = people.Where(p => p.Role == CurrentUser.Student && p.OnClassList).ToList();
        return new MeetingAttendanceDto(meeting.Id, students.Count(p => p.Joined), students.Count, people);
    }

    /// <summary>The time covered by a set of stays, counting overlapping stays (two tabs) once.</summary>
    internal static TimeSpan Covered(IEnumerable<(DateTime From, DateTime To)> spans)
    {
        var total = TimeSpan.Zero;
        DateTime? start = null, end = null;
        foreach (var (from, to) in spans.Where(s => s.To > s.From).OrderBy(s => s.From))
        {
            if (end is null || from > end) { if (end is not null) total += end.Value - start!.Value; start = from; end = to; }
            else if (to > end) end = to;
        }
        if (end is not null) total += end.Value - start!.Value;
        return total;
    }
}
