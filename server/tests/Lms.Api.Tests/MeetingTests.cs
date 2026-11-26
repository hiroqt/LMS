using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Demo;
using Lms.Api.Identity;
using Lms.Api.Meetings;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Lms.Api.Tests;

/// <summary>Class meetings (D-070): who may join, what each person may publish, chat, attendance, and the host's controls.</summary>
public sealed class MeetingTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string OtherTeacher = "EMP-2";
    private const string Lia = "STU-1";
    private const string Max = "STU-2";
    private const string Dropped = "STU-3";
    private const string Outsider = "STU-9";
    private const string Base = "/api/classes/class-a/meetings";

    private FakeMeetingServer Meet => _factory.Meet;

    private async Task SeedAsync() => await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.AddRange(
            new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true },
            new IsmsClass { Id = "class-b", ScheduleId = "SCH-2", SubjectName = "Web Development 1", InstructorId = OtherTeacher, InstructorName = "Ben Cruz", IsActive = true });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Lia, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Max, EnrollmentId = "E-2", FirstName = "Max", LastName = "Bautista", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Dropped, EnrollmentId = "E-3", FirstName = "Mia", LastName = "Cruz", IsActive = false });
        return await db.SaveChangesAsync();
    });

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient Instructor => As(Teacher, CurrentUser.Instructor);
    private HttpClient Student(string id = Lia) => As(id, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static string? Code(JsonElement problem) => problem.TryGetProperty("code", out var c) ? c.GetString() : null;

    /// <summary>Starts a meeting now and returns its id and room name.</summary>
    private async Task<(long Id, string Room)> StartAsync(object? settings = null)
    {
        var response = await Instructor.PostAsJsonAsync(Base, new { title = "Lecture 7", startNow = true, settings });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = (await Json(response)).GetProperty("id").GetInt64();
        return (id, await _factory.WithDbAsync(db => db.Meetings.Where(m => m.Id == id).Select(m => m.RoomName).SingleAsync()));
    }

    /// <summary>The claims of a join pass, read without trusting the code that made it.</summary>
    private static JsonElement Claims(string token)
    {
        var parts = token.Split('.');
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(LmsApiFactory.MeetSecret), Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"));
        Assert.Equal(expected, Base64Url.DecodeFromChars(parts[2]));
        return JsonDocument.Parse(Base64Url.DecodeFromChars(parts[1])).RootElement;
    }

    private static string[] Sources(JsonElement claims) =>
        claims.GetProperty("video").TryGetProperty("canPublishSources", out var s) ? s.EnumerateArray().Select(x => x.GetString()!).ToArray() : [];

    private async Task<JsonElement> JoinAsync(long id, HttpClient client)
    {
        var response = await client.PostAsync($"{Base}/{id}/join", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await Json(response);
    }

    // ---------------------------------------------------------------- webhooks, signed as LiveKit signs them

    /// <summary>Signs as LiveKit does, at the API's clock (the test clock unless <paramref name="at"/> says otherwise).</summary>
    private string Sign(byte[] body, string key = LmsApiFactory.MeetKey, string secret = LmsApiFactory.MeetSecret, long? expires = null, DateTimeOffset? at = null)
    {
        var now = (at ?? _factory.Time.Now).ToUnixTimeSeconds();
        var head = Base64Url.EncodeToString("""{"alg":"HS256","typ":"JWT"}"""u8);
        var claims = JsonSerializer.SerializeToUtf8Bytes(new { iss = key, nbf = now - 5, exp = expires ?? now + 300, sha256 = Convert.ToBase64String(SHA256.HashData(body)) });
        var payload = Base64Url.EncodeToString(claims);
        var signature = Base64Url.EncodeToString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes($"{head}.{payload}")));
        return $"{head}.{payload}.{signature}";
    }

    /// <summary>A webhook body shaped like the ones LiveKit 1.13 sends (captured 2026-11-26, trimmed).</summary>
    private static byte[] Hook(string name, string room, string? identity = null, string? sid = null, long at = 1795696911, long? joinedAtMs = null) =>
        JsonSerializer.SerializeToUtf8Bytes(identity is null
            ? (object)new { @event = name, room = new { sid = "RM_test", name = room, emptyTimeout = 300 }, id = $"EV_{Guid.NewGuid():N}", createdAt = at.ToString() }
            : new
            {
                @event = name,
                room = new { sid = "RM_test", name = room, emptyTimeout = 300, numParticipants = 1 },
                participant = new
                {
                    sid, identity, state = name == "participant_left" ? "DISCONNECTED" : "ACTIVE", joinedAt = ((joinedAtMs ?? at * 1000) / 1000).ToString(),
                    joinedAtMs = (joinedAtMs ?? at * 1000).ToString(), name = identity, permission = new { canSubscribe = true, canPublish = true, canPublishData = true },
                },
                id = $"EV_{Guid.NewGuid():N}",
                createdAt = at.ToString(),
            });

    private async Task<HttpStatusCode> PostHookAsync(byte[] body, string? authorization)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, MeetingWebhookEndpoints.Path) { Content = new ByteArrayContent(body) };
        request.Content.Headers.ContentType = new("application/webhook+json");
        if (authorization is not null) request.Headers.TryAddWithoutValidation("Authorization", authorization);
        return (await _factory.CreateClient().SendAsync(request)).StatusCode;
    }

    // ---------------------------------------------------------------- tests

    [Fact]
    public async Task The_instructor_schedules_and_starts_and_only_people_in_the_class_get_a_join_pass()
    {
        await SeedAsync();
        var at = _factory.Time.Now.AddDays(1);
        var scheduled = await Instructor.PostAsJsonAsync(Base, new { title = "Lecture 7", scheduledStart = at });
        Assert.Equal(HttpStatusCode.Created, scheduled.StatusCode);
        var meeting = await Json(scheduled);
        var id = meeting.GetProperty("id").GetInt64();
        Assert.Equal("scheduled", meeting.GetProperty("status").GetString());
        Assert.Empty(Meet.CallsTo(nameof(IMeetingServer.CreateRoomAsync)));

        // Before it starts, a student waits.
        var early = await Student().PostAsync($"{Base}/{id}/join", null);
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal("not_started", Code(await Json(early)));
        // Students can't start a meeting.
        Assert.Equal(HttpStatusCode.Forbidden, (await Student().PostAsync($"{Base}/{id}/start", null)).StatusCode);

        var started = await Instructor.PostAsync($"{Base}/{id}/start", null);
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        Assert.Equal("live", (await Json(started)).GetProperty("status").GetString());
        var room = await _factory.WithDbAsync(db => db.Meetings.Select(m => m.RoomName).SingleAsync());
        Assert.Matches("^[0-9a-f]{32}$", room);
        var create = Assert.Single(Meet.CallsTo(nameof(IMeetingServer.CreateRoomAsync)));
        Assert.Equal(room, create.Room);
        Assert.Contains("\"saveChat\":false", (string)create.Detail!);

        // A student on the class list gets a pass for this room only, with their LMS name and the default rights.
        var join = await JoinAsync(id, Student());
        Assert.Equal("ws://meet.test", join.GetProperty("serverUrl").GetString());
        Assert.Equal("Lia Abad", join.GetProperty("name").GetString());
        var claims = Claims(join.GetProperty("token").GetString()!);
        Assert.Equal((Lia, "Lia Abad", LmsApiFactory.MeetKey), (claims.GetProperty("sub").GetString(), claims.GetProperty("name").GetString(), claims.GetProperty("iss").GetString()));
        Assert.Equal(room, claims.GetProperty("video").GetProperty("room").GetString());
        Assert.True(claims.GetProperty("video").GetProperty("roomJoin").GetBoolean());
        Assert.False(claims.GetProperty("video").TryGetProperty("roomAdmin", out _));
        Assert.Equal(["camera", "microphone"], Sources(claims));
        Assert.Equal("student", claims.GetProperty("attributes").GetProperty(MeetingRights.RoleAttribute).GetString());
        Assert.Equal(600, claims.GetProperty("exp").GetInt64() - _factory.Time.Now.ToUnixTimeSeconds());
        // Students join with the mic off by default; the page reads it from the settings.
        Assert.True(join.GetProperty("meeting").GetProperty("settings").GetProperty("studentsJoinMuted").GetBoolean());

        // The instructor may publish everything.
        Assert.Equal(["camera", "microphone", "screen_share", "screen_share_audio"], Sources(Claims((await JoinAsync(id, Instructor)).GetProperty("token").GetString()!)));

        // Nobody outside the class gets in, and they can't tell the meeting exists.
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Outsider).PostAsync($"{Base}/{id}/join", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Dropped).PostAsync($"{Base}/{id}/join", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, CurrentUser.Instructor).PostAsync($"{Base}/{id}/join", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Student(Outsider).GetAsync(Base)).StatusCode);
        // A meeting id from another class is not found.
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, CurrentUser.Instructor).PostAsync($"/api/classes/class-b/meetings/{id}/join", null)).StatusCode);

        // Students see the class's meetings.
        Assert.Equal(id, Assert.Single((await Json(await Student().GetAsync(Base))).EnumerateArray()).GetProperty("id").GetInt64());

        var audit = await _factory.WithDbAsync(db => db.AuditLog.OrderBy(a => a.Id).ToListAsync());
        Assert.Equal(["scheduled", "started"], audit.Select(a => a.Action).ToArray());
        Assert.All(audit, a => Assert.Equal(("meetings", "Meeting", Teacher), (a.Category, a.Target, a.ActorId)));
    }

    [Fact]
    public async Task The_settings_decide_what_students_may_publish_and_a_change_reaches_everyone_in_the_meeting()
    {
        await SeedAsync();
        var (id, room) = await StartAsync(new { studentsMayUnmute = false });
        Assert.Equal(["camera"], Sources(Claims((await JoinAsync(id, Student())).GetProperty("token").GetString()!)));

        // With nothing to publish, a pass says can't-publish: an empty source list would mean "everything" to the media server.
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { studentsMayVideo = false } })).StatusCode);
        var claims = Claims((await JoinAsync(id, Student())).GetProperty("token").GetString()!);
        Assert.False(claims.GetProperty("video").GetProperty("canPublish").GetBoolean());
        Assert.Empty(Sources(claims));
        Assert.True(claims.GetProperty("video").GetProperty("canPublishData").GetBoolean());
        Assert.True(claims.GetProperty("video").GetProperty("canSubscribe").GetBoolean());

        // Turning the mic on for everyone while two students and the instructor are in the room.
        Meet.Join(room, Teacher, MeetingRights.ForInstructor());
        Meet.Join(room, Lia, new MeetingPermission(true, false, true, []));
        Meet.Join(room, Max, new MeetingPermission(true, false, true, []));
        while (Meet.Calls.TryDequeue(out _)) { }
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { studentsMayUnmute = true } })).StatusCode);
        var updates = Meet.CallsTo(nameof(IMeetingServer.UpdateParticipantAsync)).ToList();
        Assert.Equal([Lia, Max], updates.Select(u => u.Identity!).ToArray());
        Assert.All(updates, u => Assert.Equal(["microphone"], (((MeetingPermission, IReadOnlyDictionary<string, string>?))u.Detail!).Item1.Sources));
        Assert.Contains("\"mayUnmute\":true", (string)Meet.CallsTo(nameof(IMeetingServer.UpdateRoomMetadataAsync)).Single().Detail!);

        // Saving the chat changes no rights; only what the pages show.
        while (Meet.Calls.TryDequeue(out _)) { }
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { saveChat = true } })).StatusCode);
        Assert.Empty(Meet.CallsTo(nameof(IMeetingServer.UpdateParticipantAsync)));
        Assert.Contains("\"saveChat\":true", (string)Meet.CallsTo(nameof(IMeetingServer.UpdateRoomMetadataAsync)).Single().Detail!);

        // Only the instructor changes settings.
        Assert.Equal(HttpStatusCode.Forbidden, (await Student().PatchAsJsonAsync($"{Base}/{id}", new { settings = new { studentsMayShareScreen = true } })).StatusCode);
    }

    [Fact]
    public async Task One_class_has_one_live_meeting_at_a_time()
    {
        await SeedAsync();
        var (id, _) = await StartAsync();
        var second = await Instructor.PostAsJsonAsync(Base, new { startNow = true });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var problem = await Json(second);
        Assert.Equal("already_live", Code(problem));
        Assert.Equal(id, problem.GetProperty("meetingId").GetInt64());
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Meetings.CountAsync()));
        // Another class can have its own live meeting at the same time.
        var other = await As(OtherTeacher, CurrentUser.Instructor).PostAsJsonAsync("/api/classes/class-b/meetings", new { startNow = true });
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
        Assert.Equal("Web Development 1 meeting", (await Json(other)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Chat_is_saved_only_while_saving_is_on_and_only_people_in_the_meeting_can_send()
    {
        await SeedAsync();
        var (id, room) = await StartAsync();
        Meet.Join(room, Teacher, MeetingRights.ForInstructor());
        Meet.Join(room, Lia, new MeetingPermission(true, true, true, ["camera", "microphone"]));

        var sent = await Student().PostAsJsonAsync($"{Base}/{id}/chat", new { text = "  Is the quiz on Friday?  " });
        Assert.Equal(HttpStatusCode.OK, sent.StatusCode);
        var message = await Json(sent);
        Assert.Equal(("Is the quiz on Friday?", "Lia Abad", false), (message.GetProperty("text").GetString(), message.GetProperty("senderName").GetString(), message.GetProperty("saved").GetBoolean()));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.MeetingChatMessages.CountAsync()));
        var data = Assert.Single(Meet.CallsTo(nameof(IMeetingServer.SendDataAsync)));
        var (topic, json, to) = ((string, string, IReadOnlyList<string>?))data.Detail!;
        Assert.Equal(MeetingTopic.Chat, topic);
        Assert.Null(to);
        Assert.Contains("\"text\":\"Is the quiz on Friday?\"", json);

        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { saveChat = true } })).StatusCode);
        var kept = await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/chat", new { text = "Yes, at 9." }));
        Assert.True(kept.GetProperty("saved").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { saveChat = false } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Student().PostAsJsonAsync($"{Base}/{id}/chat", new { text = "Thanks!" })).StatusCode);

        // Only the message sent while saving was on is kept, and the class can read it.
        var saved = await Json(await Student().GetAsync($"{Base}/{id}/chat"));
        var only = Assert.Single(saved.EnumerateArray());
        Assert.Equal(("Yes, at 9.", "Ana Reyes", "instructor"), (only.GetProperty("text").GetString(), only.GetProperty("senderName").GetString(), only.GetProperty("senderRole").GetString()));
        Assert.Equal(1, (await Json(await Student().GetAsync($"{Base}/{id}"))).GetProperty("savedChatMessages").GetInt32());

        // Someone on the class list who isn't in the meeting can't post into it.
        var notIn = await Student(Max).PostAsJsonAsync($"{Base}/{id}/chat", new { text = "hello" });
        Assert.Equal(HttpStatusCode.Conflict, notIn.StatusCode);
        Assert.Equal("not_in_meeting", Code(await Json(notIn)));
        Assert.Equal(HttpStatusCode.BadRequest, (await Student().PostAsJsonAsync($"{Base}/{id}/chat", new { text = new string('a', MeetingLimits.ChatLength + 1) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Student().PostAsJsonAsync($"{Base}/{id}/chat", new { text = "   " })).StatusCode);

        // Chat off for students: they can't send; the instructor still can.
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { studentsMayChat = false } })).StatusCode);
        var off = await Student().PostAsJsonAsync($"{Base}/{id}/chat", new { text = "hello?" });
        Assert.Equal(HttpStatusCode.Forbidden, off.StatusCode);
        Assert.Equal("chat_off", Code(await Json(off)));
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PostAsJsonAsync($"{Base}/{id}/chat", new { text = "Questions after class, please." })).StatusCode);

        // Only the instructor deletes the saved chat.
        Assert.Equal(HttpStatusCode.Forbidden, (await Student().DeleteAsync($"{Base}/{id}/chat")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{Base}/{id}/chat")).StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.MeetingChatMessages.CountAsync()));
    }

    [Fact]
    public async Task A_message_the_media_server_did_not_deliver_is_not_kept()
    {
        await SeedAsync();
        var (id, room) = await StartAsync(new { saveChat = true });
        Meet.Join(room, Lia, new MeetingPermission(true, true, true, ["camera", "microphone"]));
        Meet.FailSendData = true;
        var response = await Student().PostAsJsonAsync($"{Base}/{id}/chat", new { text = "Lost?" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("meeting_server_unavailable", Code(await Json(response)));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.MeetingChatMessages.CountAsync()));
    }

    [Fact]
    public async Task Webhooks_record_attendance_once_and_only_when_signed_by_the_media_server()
    {
        await SeedAsync();
        var (id, room) = await StartAsync();
        const long t0 = 1795696000;

        // Unsigned, wrongly signed, signed with another key, expired, or a body that was changed: refused and ignored.
        var joined = Hook("participant_joined", room, Lia, "PA_lia1", t0);
        Assert.Equal(HttpStatusCode.Unauthorized, await PostHookAsync(joined, null));
        Assert.Equal(HttpStatusCode.Unauthorized, await PostHookAsync(joined, Sign(joined, secret: "wrong_secret_wrong_secret_wrong_secret_00")));
        Assert.Equal(HttpStatusCode.Unauthorized, await PostHookAsync(joined, Sign(joined, key: "someone-else")));
        Assert.Equal(HttpStatusCode.Unauthorized, await PostHookAsync(joined, Sign(joined, expires: _factory.Time.Now.AddMinutes(-5).ToUnixTimeSeconds())));
        Assert.Equal(HttpStatusCode.Unauthorized, await PostHookAsync(Hook("participant_joined", room, Max, "PA_max1", t0), Sign(joined)));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.MeetingAttendance.CountAsync()));
        // A body over the limit is refused before it is read, signed or not.
        var huge = new byte[MeetingLimits.WebhookBodyBytes + 1];
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, await PostHookAsync(huge, Sign(huge)));

        // Signed: recorded once, even when delivered twice.
        Assert.Equal(HttpStatusCode.OK, await PostHookAsync(joined, Sign(joined)));
        Assert.Equal(HttpStatusCode.OK, await PostHookAsync(joined, Sign(joined)));
        var teacherIn = Hook("participant_joined", room, Teacher, "PA_teacher", t0 - 60);
        Assert.Equal(HttpStatusCode.OK, await PostHookAsync(teacherIn, Sign(teacherIn)));
        var stays = await _factory.WithDbAsync(db => db.MeetingAttendance.OrderBy(a => a.Id).ToListAsync());
        Assert.Equal([(Lia, "student"), (Teacher, "instructor")], stays.Select(s => (s.PersonId, s.Role)).ToArray());
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(t0).UtcDateTime, stays[0].JoinedAt);

        // Lia leaves after 20 minutes and comes back for 10 more; a second tab overlapping her stay counts once.
        foreach (var body in new[]
        {
            Hook("participant_left", room, Lia, "PA_lia1", t0 + 20 * 60, joinedAtMs: t0 * 1000),
            Hook("participant_joined", room, Lia, "PA_lia2", t0 + 30 * 60),
            Hook("participant_joined", room, Lia, "PA_lia3", t0 + 32 * 60),
            Hook("participant_left", room, Lia, "PA_lia3", t0 + 35 * 60, joinedAtMs: (t0 + 32 * 60) * 1000),
            Hook("participant_left", room, Lia, "PA_lia2", t0 + 40 * 60, joinedAtMs: (t0 + 30 * 60) * 1000),
            // A leave whose join was missed is still recorded.
            Hook("participant_left", room, Max, "PA_max9", t0 + 5 * 60, joinedAtMs: t0 * 1000),
            // A room the LMS didn't make is ignored.
            Hook("participant_joined", "lms-check", "pemam_pub_0", "PA_load", t0),
        })
            Assert.Equal(HttpStatusCode.OK, await PostHookAsync(body, Sign(body)));

        // Everyone leaves and the media server closes the room: the meeting ends and open stays close.
        var finished = Hook("room_finished", room, at: t0 + 45 * 60);
        Assert.Equal(HttpStatusCode.OK, await PostHookAsync(finished, Sign(finished)));
        var meeting = await _factory.WithDbAsync(db => db.Meetings.SingleAsync());
        Assert.Equal((DateTimeOffset.FromUnixTimeSeconds(t0 + 45 * 60).UtcDateTime, MeetingEndReason.Empty), (meeting.EndedAt!.Value, meeting.EndReason));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.MeetingAttendance.CountAsync(a => a.LeftAt == null)));

        var report = await Json(await Instructor.GetAsync($"{Base}/{id}/attendance"));
        Assert.Equal((2, 2), (report.GetProperty("studentsJoined").GetInt32(), report.GetProperty("studentsOnClassList").GetInt32()));
        var people = report.GetProperty("people").EnumerateArray().ToDictionary(p => p.GetProperty("personId").GetString()!);
        Assert.Equal((30, 3), (people[Lia].GetProperty("minutesIn").GetInt32(), people[Lia].GetProperty("stays").GetInt32()));
        Assert.Equal(5, people[Max].GetProperty("minutesIn").GetInt32());
        Assert.Equal(46, people[Teacher].GetProperty("minutesIn").GetInt32());
        Assert.Equal("Ana Reyes", people[Teacher].GetProperty("name").GetString());
        // Attendance is the instructor's report; it doesn't touch monthly attendance (D-035).
        Assert.Equal(HttpStatusCode.Forbidden, (await Student().GetAsync($"{Base}/{id}/attendance")).StatusCode);
        Assert.Equal(0, await _factory.WithDbAsync(db => db.AttendanceEntries.CountAsync()));
    }

    [Fact]
    public async Task A_locked_meeting_keeps_new_students_out_and_a_removed_student_stays_out()
    {
        await SeedAsync();
        var (id, room) = await StartAsync();
        var liaIn = Hook("participant_joined", room, Lia, "PA_lia1");
        Assert.Equal(HttpStatusCode.OK, await PostHookAsync(liaIn, Sign(liaIn)));

        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { locked = true })).StatusCode);
        var locked = await Student(Max).PostAsync($"{Base}/{id}/join", null);
        Assert.Equal(HttpStatusCode.Forbidden, locked.StatusCode);
        Assert.Equal("locked", Code(await Json(locked)));
        // Someone already in (a reload) gets back in, and so does the instructor.
        await JoinAsync(id, Student());
        await JoinAsync(id, Instructor);

        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { locked = false })).StatusCode);
        Meet.Join(room, Max, MeetingRights.ForStudent(new OnlineMeeting()));
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsync($"{Base}/{id}/people/{Max}/remove", null)).StatusCode);
        Assert.Null(Meet.Person(room, Max));
        var removed = await Student(Max).PostAsync($"{Base}/{id}/join", null);
        Assert.Equal(HttpStatusCode.Forbidden, removed.StatusCode);
        Assert.Equal("removed", Code(await Json(removed)));
        // Only people on the class list can be removed, and only by the instructor.
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.PostAsync($"{Base}/{id}/people/{Outsider}/remove", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Student().PostAsync($"{Base}/{id}/people/{Max}/remove", null)).StatusCode);
    }

    [Fact]
    public async Task The_instructor_mutes_lets_speak_asks_to_unmute_and_stops_a_screen_share()
    {
        await SeedAsync();
        var (id, room) = await StartAsync(new { studentsMayShareScreen = true });
        Meet.Join(room, Teacher, MeetingRights.ForInstructor(), new MeetingTrack("TR_tmic", "microphone", false));
        Meet.Join(room, Lia, new MeetingPermission(true, true, true, ["camera", "microphone", "screen_share", "screen_share_audio"]),
            new MeetingTrack("TR_lmic", "microphone", false), new MeetingTrack("TR_lscreen", "screen_share", false));
        Meet.Join(room, Max, new MeetingPermission(true, true, true, ["camera", "microphone"]), new MeetingTrack("TR_mmic", "microphone", false));

        // Mute one, then everyone but the instructor.
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsync($"{Base}/{id}/people/{Lia}/mute", null)).StatusCode);
        Assert.Equal(["TR_lmic"], Meet.CallsTo(nameof(IMeetingServer.MuteTrackAsync)).Select(c => (string)c.Detail!).ToArray());
        var all = await Json(await Instructor.PostAsync($"{Base}/{id}/mute-all", null));
        Assert.Equal(1, all.GetProperty("muted").GetInt32());
        Assert.False(Meet.Person(room, Teacher)!.Tracks.Single().Muted);
        Assert.True(Meet.Person(room, Max)!.Tracks.Single().Muted);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.PostAsync($"{Base}/{id}/people/{Outsider}/mute", null)).StatusCode);

        // Students may unmute themselves, so asking works and "let speak" isn't needed.
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsync($"{Base}/{id}/people/{Lia}/ask-unmute", null)).StatusCode);
        var (topic, json, to) = ((string, string, IReadOnlyList<string>?))Meet.CallsTo(nameof(IMeetingServer.SendDataAsync)).Single().Detail!;
        Assert.Equal((MeetingTopic.AskUnmute, Lia), (topic, Assert.Single(to!)));
        Assert.Contains("Ana Reyes", json);
        Assert.Equal(HttpStatusCode.Conflict, (await Instructor.PostAsJsonAsync($"{Base}/{id}/people/{Lia}/let-speak", new { allowed = true })).StatusCode);

        // Stop Lia's screen share: taken away (unpublished), then given back so she can share again.
        while (Meet.Calls.TryDequeue(out _)) { }
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsync($"{Base}/{id}/people/{Lia}/stop-share", null)).StatusCode);
        var steps = Meet.CallsTo(nameof(IMeetingServer.UpdateParticipantAsync)).Select(c => (((MeetingPermission, IReadOnlyDictionary<string, string>?))c.Detail!).Item1.Sources).ToList();
        Assert.Equal(2, steps.Count);
        Assert.DoesNotContain("screen_share", steps[0]);
        Assert.Contains("screen_share", steps[1]);
        Assert.DoesNotContain(Meet.Person(room, Lia)!.Tracks, t => t.Source == "screen_share");
        Assert.Equal(HttpStatusCode.Conflict, (await Instructor.PostAsync($"{Base}/{id}/people/{Lia}/stop-share", null)).StatusCode);

        // Now students may not turn on their own mic: their mics are taken away, asking needs "let speak" first.
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { studentsMayUnmute = false } })).StatusCode);
        Assert.DoesNotContain(Meet.Person(room, Max)!.Tracks, t => t.Source == "microphone");
        var ask = await Instructor.PostAsync($"{Base}/{id}/people/{Max}/ask-unmute", null);
        Assert.Equal(HttpStatusCode.Conflict, ask.StatusCode);
        Assert.Equal("may_not_unmute", Code(await Json(ask)));
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsJsonAsync($"{Base}/{id}/people/{Max}/let-speak", new { allowed = true })).StatusCode);
        Assert.Contains("microphone", Meet.Person(room, Max)!.Permission!.Sources);
        Assert.Equal("true", Meet.Person(room, Max)!.Attributes[MeetingRights.LetSpeakAttribute]);
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsync($"{Base}/{id}/people/{Max}/ask-unmute", null)).StatusCode);

        // Another setting changes while Max may speak: he keeps the mic; Lia doesn't get one.
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { settings = new { studentsMayVideo = false } })).StatusCode);
        Assert.Equal(["microphone", "screen_share", "screen_share_audio"], Meet.Person(room, Max)!.Permission!.Sources);
        Assert.Equal(["screen_share", "screen_share_audio"], Meet.Person(room, Lia)!.Permission!.Sources);
        // Then taken back.
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.PostAsJsonAsync($"{Base}/{id}/people/{Max}/let-speak", new { allowed = false })).StatusCode);
        Assert.DoesNotContain("microphone", Meet.Person(room, Max)!.Permission!.Sources);
        Assert.False(Meet.Person(room, Max)!.Attributes.ContainsKey(MeetingRights.LetSpeakAttribute));

        // Students have none of these controls.
        foreach (var path in new[] { $"people/{Max}/mute", "mute-all", $"people/{Max}/ask-unmute", $"people/{Max}/stop-share" })
            Assert.Equal(HttpStatusCode.Forbidden, (await Student().PostAsync($"{Base}/{id}/{path}", null)).StatusCode);
    }

    [Fact]
    public async Task Ending_closes_the_room_and_open_stays_even_when_the_media_server_is_down()
    {
        await SeedAsync();
        var (id, room) = await StartAsync();
        var liaIn = Hook("participant_joined", room, Lia, "PA_lia1");
        Assert.Equal(HttpStatusCode.OK, await PostHookAsync(liaIn, Sign(liaIn)));
        Meet.Down = true;
        _factory.Time.Now = _factory.Time.Now.AddMinutes(50);
        var ended = await Instructor.PostAsync($"{Base}/{id}/end", null);
        Assert.Equal(HttpStatusCode.OK, ended.StatusCode);
        Assert.Equal("ended", (await Json(ended)).GetProperty("status").GetString());
        Meet.Down = false;
        var stay = await _factory.WithDbAsync(db => db.MeetingAttendance.SingleAsync());
        Assert.Equal(_factory.Time.Now.UtcDateTime, stay.LeftAt);
        Assert.Equal(MeetingEndReason.Instructor, await _factory.WithDbAsync(db => db.Meetings.Select(m => m.EndReason).SingleAsync()));

        var late = await Student().PostAsync($"{Base}/{id}/join", null);
        Assert.Equal("ended", Code(await Json(late)));
        Assert.Equal(HttpStatusCode.Conflict, (await Instructor.PostAsync($"{Base}/{id}/start", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { title = "Renamed" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Instructor.DeleteAsync($"{Base}/{id}")).StatusCode);

        // With the server back, ending deletes the room.
        var (next, nextRoom) = await StartAsync();
        Assert.Equal(HttpStatusCode.OK, (await Instructor.PostAsync($"{Base}/{next}/end", null)).StatusCode);
        Assert.Equal(nextRoom, Meet.CallsTo(nameof(IMeetingServer.DeleteRoomAsync)).Single().Room);
    }

    [Fact]
    public async Task Scheduling_checks_the_time_and_a_meeting_that_has_not_started_can_be_moved_or_deleted()
    {
        await SeedAsync();
        var missing = await Instructor.PostAsJsonAsync(Base, new { title = "No time" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PostAsJsonAsync(Base, new { scheduledStart = _factory.Time.Now.AddHours(-1) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor.PostAsJsonAsync(Base, new { scheduledStart = _factory.Time.Now.AddYears(2) })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Student().PostAsJsonAsync(Base, new { startNow = true })).StatusCode);

        var later = await Json(await Instructor.PostAsJsonAsync(Base, new { scheduledStart = _factory.Time.Now.AddDays(2) }));
        var soon = await Json(await Instructor.PostAsJsonAsync(Base, new { title = "Review", scheduledStart = _factory.Time.Now.AddDays(1) }));
        Assert.Equal("Database Systems 1 meeting", later.GetProperty("title").GetString());
        // Upcoming meetings are listed soonest first.
        Assert.Equal(["Review", "Database Systems 1 meeting"], (await Json(await Student().GetAsync(Base))).EnumerateArray().Select(m => m.GetProperty("title").GetString()!).ToArray());

        var moved = await Instructor.PatchAsJsonAsync($"{Base}/{soon.GetProperty("id").GetInt64()}", new { scheduledStart = _factory.Time.Now.AddDays(3) });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Instructor.DeleteAsync($"{Base}/{later.GetProperty("id").GetInt64()}")).StatusCode);
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Meetings.CountAsync()));
    }

    [Fact]
    public async Task Without_a_media_server_meetings_can_be_scheduled_but_not_started_or_joined()
    {
        await SeedAsync();
        Meet.Off = true;
        var start = await Instructor.PostAsJsonAsync(Base, new { startNow = true });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, start.StatusCode);
        Assert.Equal("meetings_off", Code(await Json(start)));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Meetings.CountAsync()));
        Assert.Equal(HttpStatusCode.Created, (await Instructor.PostAsJsonAsync(Base, new { scheduledStart = _factory.Time.Now.AddDays(1) })).StatusCode);

        // A wrong key or secret is a server setting to fix, not an outage and not the instructor's fault.
        Meet.Off = false;
        Meet.RejectKey = true;
        var rejected = await Instructor.PostAsJsonAsync(Base, new { startNow = true });
        Assert.Equal(HttpStatusCode.BadGateway, rejected.StatusCode);
        Assert.Equal("meeting_server_rejected_key", Code(await Json(rejected)));
    }

    [Fact]
    public async Task Without_settings_the_api_says_meetings_are_off_and_never_hands_out_a_pass()
    {
        using var off = new LmsApiFactory().With("Lms:Meet:Url", "").With("Lms:Meet:ApiKey", "").With("Lms:Meet:ApiSecret", "");
        await off.WithDbAsync(async db =>
        {
            db.IsmsClasses.Add(new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true });
            db.Meetings.Add(new OnlineMeeting { ClassId = "class-a", Title = "Live", RoomName = "r1", StartedAt = DateTime.UtcNow });
            return await db.SaveChangesAsync();
        });
        var client = off.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, Teacher);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, CurrentUser.Instructor);
        var id = await off.WithDbAsync(db => db.Meetings.Select(m => m.Id).SingleAsync());
        var join = await client.PostAsync($"{Base}/{id}/join", null);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, join.StatusCode);
        Assert.Equal("meetings_off", Code(await Json(join)));
    }

    [Fact]
    public void A_secret_too_short_for_the_media_server_stops_the_api_from_starting()
    {
        using var bad = new LmsApiFactory().With("Lms:Meet:ApiSecret", "short");
        var error = Assert.ThrowsAny<Exception>(() => bad.CreateClient());
        Assert.Contains("Lms:Meet:ApiSecret", error.ToString());
    }

    [Fact]
    public void Overlapping_stays_count_once()
    {
        var t = new DateTime(2026, 11, 26, 9, 0, 0, DateTimeKind.Utc);
        Assert.Equal(TimeSpan.FromMinutes(50), MeetingAttendanceReport.Covered([(t, t.AddMinutes(30)), (t.AddMinutes(10), t.AddMinutes(20)), (t.AddMinutes(40), t.AddMinutes(60))]));
        Assert.Equal(TimeSpan.Zero, MeetingAttendanceReport.Covered([]));
        Assert.Equal(TimeSpan.FromMinutes(30), MeetingAttendanceReport.Covered([(t, t.AddMinutes(20)), (t.AddMinutes(20), t.AddMinutes(30))]));
    }

    [Fact]
    public async Task In_Demo_mode_a_webhook_finds_the_meeting_in_its_own_sandbox()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"lms-demo-meet-{Guid.NewGuid():N}");
        var fake = new FakeMeetingServer();
        using var demo = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b
            .UseEnvironment("Demo")
            .UseSetting("Lms:Demo:DataDirectory", dir)
            .UseSetting("Lms:Meet:Url", "ws://meet.test")
            .UseSetting("Lms:Meet:ApiKey", LmsApiFactory.MeetKey)
            .UseSetting("Lms:Meet:ApiSecret", LmsApiFactory.MeetSecret)
            .ConfigureTestServices(s => { s.RemoveAll<IMeetingServer>(); s.AddSingleton<IMeetingServer>(fake); }));
        try
        {
            var teacher = demo.CreateClient();
            teacher.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, "instructor-1");
            teacher.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, CurrentUser.Instructor);
            teacher.DefaultRequestHeaders.Add(DemoOptions.SandboxHeader, "sandbox-a");
            var started = await teacher.PostAsJsonAsync("/api/classes/biology/meetings", new { startNow = true });
            Assert.Equal(HttpStatusCode.Created, started.StatusCode);
            var room = fake.CallsTo(nameof(IMeetingServer.CreateRoomAsync)).Single().Room;
            Assert.StartsWith("sandbox-a.", room);

            var body = Hook("participant_joined", room, "s0", "PA_s0");
            using var request = new HttpRequestMessage(HttpMethod.Post, MeetingWebhookEndpoints.Path) { Content = new ByteArrayContent(body) };
            request.Headers.TryAddWithoutValidation("Authorization", Sign(body, at: DateTimeOffset.UtcNow));
            // No sandbox header: the room name says which sandbox.
            Assert.Equal(HttpStatusCode.OK, (await demo.CreateClient().SendAsync(request)).StatusCode);

            var id = (await Json(started)).GetProperty("id").GetInt64();
            var report = await Json(await teacher.GetAsync($"/api/classes/biology/meetings/{id}/attendance"));
            Assert.True(report.GetProperty("people").EnumerateArray().Single(p => p.GetProperty("personId").GetString() == "s0").GetProperty("joined").GetBoolean());
        }
        finally
        {
            demo.Dispose();
            try { Directory.Delete(dir, recursive: true); } catch (IOException) { }
        }
    }
}
