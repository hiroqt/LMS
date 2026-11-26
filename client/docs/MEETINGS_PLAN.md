# Class meetings plan: live video like Google Meet, inside the LMS

An instructor starts a live meeting for a class, and the class's students join from the LMS. It
works like Google Meet: video and voice, screen sharing, chat, raised hands, reactions, and host
controls. There is no time limit, and the delay is as short as Meet's. The meeting is its own
module and its own full-screen page. People can open it only from the LMS, and only members of
the class can join. Decision: D-070, approved 2026-11-26 (see Decisions). D-068 is still held by
the offline plan.

## What "no time limit" and "no delay" mean

| Goal | How we meet it | What still limits it |
|---|---|---|
| No time limit | We run our own media server, so no vendor sets a cap and the code sets none. A meeting stays open while anyone is in it and closes 5 minutes after the last person leaves | Server size and bandwidth (the school pays for these), and students' mobile data and battery |
| Real time | WebRTC, the same technology Meet uses. Sound and video go over UDP through a media server (an SFU) that forwards streams without re-encoding them. The usual delay is 100–300 ms in the same country | The server must be near the users. On school networks that block UDP, the call goes over TCP port 443 (TURN): it still connects, with a little more delay |
| Weak connections | Simulcast (each camera is sent at 3 qualities), adaptive streams (each person gets the quality their connection can take), automatic reconnect, and a Data saver mode | A 2G-like connection gets audio and screen share only |

No call has zero delay. "No delay" here means a delay people don't notice in a conversation.

## What people get

**Everyone in a meeting** (computer, Android, or iPhone browser; nothing to install)
1. **Pre-join screen:** a camera and mic preview, device choice, and their LMS name, which they
   can't change.
2. **Grid and speaker views**, the active speaker highlighted, and pinning anyone.
3. **Mic and camera** on and off, within the instructor's settings (below).
4. **Screen share** from a computer, including tab audio in Chrome. Phone browsers can't share a
   screen. Phones can still watch a share.
5. **Chat** with the whole meeting, links you can click, and an unread count. When the
   instructor saves the chat, everyone sees "This chat is being saved".
6. **Raise hand** (shown in order), and **reactions** (👍 👏 😂 ❤️ 🎉 ❓).
7. **People list:** who is in, mic and camera state, raised hands.
8. **Data saver:** turns off everyone else's video and keeps audio and the shared screen. It is
   suggested when the connection is weak.
9. **Reconnects by itself** after a network drop, and shows "Reconnecting…" meanwhile.

**Instructor (host)**
1. **Start a meeting now** from the class page, or **schedule one** (title, date, time; the
   class's ISMS schedule fills in the default time).
2. **Meeting settings**, set when scheduling and changeable during the meeting:

   | Setting | Default |
   |---|---|
   | Students join with the mic off | On |
   | Students may turn on their own mic | On |
   | Students may turn on their camera | On |
   | Students may share their screen | Off |
   | Students may chat | On |
   | Save the chat | Off |
   | Record the whole meeting (Phase 4) | Off |

   When "may turn on their own mic" is off, a student speaks only after the instructor taps
   **Let speak** (for example, after a raised hand). The instructor can **mute** anyone, or
   everyone at once, and **ask a student to unmute**: the student sees "Ms. Reyes asks you to
   turn on your mic" with Turn on and Not now. Nobody can switch on someone else's mic. Browsers
   turn a mic on only when its owner taps.
3. **Other host controls:** stop someone's screen share, remove someone, lock the meeting, and end
   the meeting for everyone.
4. **After the meeting:** attendance (who joined, when they first joined, how long they stayed in
   total) with a CSV download, and the saved chat if saving was on.

**Student**
1. A **"Live now · Join"** banner on the class page and on the dashboard while a meeting is on.
   Upcoming meetings are listed with their times.
2. Before the instructor arrives, a "Waiting for the instructor" screen that joins by itself when
   the meeting starts.
3. Saved chats and, from Phase 4, recordings of the class's past meetings.

## Where it lives

```
Class page (instructor)                       Class page (student)
[▶ Start meeting] [Schedule]                  ● Live now: Programming 1 lecture  [Join]
Meetings: upcoming · live · past              Upcoming: Fri 27 Nov, 9:00

            both open ↓ in a new tab
/meet/{meetingId}   full screen, outside the sidebar shell
┌────────────────────────────────────────────┬────────────┐
│  video grid / shared screen                │ Chat │People│
│                                            │            │
├────────────────────────────────────────────┴────────────┤
│ 🎤  📷  🖥 Share  ✋  😀  ⋯ Data saver        [Leave]   │
└──────────────────────────────────────────────────────────┘
```

On a phone the side panel becomes a sheet that slides up. The controls stay at the bottom and
are large enough to tap.

## Recording (designed now, built in Phase 4)

The first version doesn't record, but the meeting page is built so recording slots in without
changing anything else. Recording is optional. When the instructor records, the recording covers
the whole meeting, everyone in it, and keeps going until the instructor pauses or stops it. This
is how it will look:

```
During a meeting (everyone sees the same sign)
┌──────────────────────────────────────────────────────────┐
│ ⏺ REC 00:42:10    This meeting is being recorded.        │
│                   Ms. Reyes started the recording.        │
├──────────────────────────────────────────────────────────┤
│  video grid / shared screen                              │
├──────────────────────────────────────────────────────────┤
│ 🎤  📷  🖥 Share  ✋  😀  ⏸ Pause  ⏹ Stop  ⋯  [Leave]    │  (Pause and Stop: instructor only)
└──────────────────────────────────────────────────────────┘

While paused:  ⏸ Recording paused. Nothing is being recorded.   [⏺ Resume]

Past meeting page (instructor and the class's students)
Programming 1 lecture · Fri 27 Nov, 9:00–10:35
┌──────────────────────────────┐  Recording   1 h 28 min (paused 7 min) · 1.9 GB
│        ▶  video player       │  Chat        Saved (48 messages)  [Open]
│                              │  Attendance  31 of 34 joined      [Open]   (instructor only)
└──────────────────────────────┘
```

- **Recording is optional, and only the instructor controls it.** It starts in one of two ways:
  the instructor taps **Record** at any time, or the meeting setting **Record the whole meeting**
  is on, so recording starts the moment the meeting starts.
- **It runs until the instructor pauses or stops it, or the meeting ends.** There is no time limit.
  It doesn't stop when the instructor's tab closes or their connection drops, because the server
  makes the recording, not the instructor's computer.
- **Pause, Resume, Stop.** While paused, nothing is captured at all, and everyone sees "Recording
  paused". Resume carries on. After Stop, the instructor can tap Record again.
- **One video per meeting.** Everything recorded in a meeting becomes one video, in order. Paused
  and stopped stretches are left out.
- **What's recorded is the whole meeting:** everyone's sound, a grid of everyone's cameras, and the
  shared screen shown large with the cameras beside it whenever someone shares. The chat isn't in
  the video.
- **Everyone knows.** Before recording starts, everyone already in the meeting sees the notice
  above. Anyone who joins later sees "This meeting is being recorded" on the pre-join screen. The
  REC or paused sign stays on for everyone until the recording stops.
- **How:** LiveKit's recording service (Egress) records each stretch on the server. Each Resume
  or new Record starts a new stretch, and when the meeting ends the LMS API joins the stretches into
  one MP4 without re-encoding (ffmpeg).
- **Where it goes:** the LMS file store, the same as materials. The past meeting page plays it
  inside the LMS for the instructor and the class's students. The instructor can download it and
  delete it.
- **Size:** about 1.3 GB per hour at 720p. Storage and how long recordings are kept are settled in
  Phase 4, before it is built.

## How it works

```
Browser ──HTTPS──> LMS API (.NET)          checks the class roster, issues a join pass,
   │                    ▲                  relays and saves chat, runs host actions
   │ WebRTC (UDP/443)   │ webhooks: joined / left / meeting ended → attendance
   ▼                    │
LiveKit media server ───┘                  our own server; open source (Apache 2.0)
```

- **Media server: LiveKit, which we host ourselves** (decision 1). It is an open-source SFU with
  simulcast, adaptive streams, screen share, data messages, a built-in TURN server, webhooks, and
  a recording service for Phase 4. It runs as its own service (`meet-server/`, a Docker Compose
  file like the ISMS API's). It holds no LMS data.
- **The LMS API decides who gets in.** `server/src/Lms.Api/Meetings/` stores meetings, settings,
  attendance, and saved chat. `POST /api/meetings/{id}/join` checks the class, as `ClassAccess`
  does today: the class's instructor, or a student active on the class list. Anyone else gets a
  404. The API returns a pass that lasts 10 minutes and is signed with the media server's secret.
  The pass carries the person's LMS id and name, and their rights from the meeting settings.
- **Settings are enforced by the media server.** When the instructor changes a setting, the LMS
  API updates every student's rights in the meeting. For example, with "may turn on their own
  mic" off, a student's mic is refused by the server, not only hidden in the page. Mute, let
  speak, remove, lock, and end all go through the LMS API, so only the class's instructor can do
  them.
- **Chat goes through the LMS API** (decision 4). The API checks "Students may chat", saves the
  message only while "Save the chat" is on, and passes it into the meeting. That adds about one
  tenth of a second, which nobody notices in a chat. Only messages sent while saving is on are
  kept. Saved chat stays until the instructor deletes it. Hands and reactions go straight through
  the meeting as data messages and are never saved.
- **Attendance** comes from the media server's signed webhooks (joined, left, meeting ended),
  stored as join and leave times per person. It doesn't depend on anyone's browser.
- **The meeting page loads only when it is opened** (`client/src/features/meet/`, a lazy route).
  The video code (`livekit-client`) is about 140 KB gzipped, so it is a recorded exception to the
  screen budget, like the PDF viewer (D-067). The other screens stay as they are.
- **Live status** on class pages and the dashboard comes from the existing queries, refreshed
  every 20 seconds while the page is open. The LMS API needs no WebSocket.
- **One migration**, `Meetings`: `meetings` (class, title, scheduled time, started, ended,
  locked, the six settings), `meeting_attendance` (meeting, person, joined, left), and
  `meeting_chat_messages` (meeting, sender, text, sent at). Phase 4 adds `meeting_recordings`.
  You apply them like the others.

## Safety and privacy

- Camera and mic need HTTPS. `localhost` works for development.
- There are no guest links. Only the class's instructor and its students can join (decision 3).
- Join passes are personal, short-lived, and tied to one meeting. A pass that has leaked stops
  working after 10 minutes, and the host can remove anyone.
- Saving the chat and recording are always visible: everyone sees "This chat is being saved" and
  the REC sign while they are on. Saved chat and recordings are open only to the class.
- Today identity is the demo header (no real sign-in), so meetings are safe for demos only. Real
  classes need real sign-in first, as for the rest of the LMS.

## Phases (one PR each, with a review)

| Phase | What | Done when |
|---|---|---|
| 0 | This plan and D-070. `meet-server/` Compose file running LiveKit in dev mode | Two browsers on one computer see and hear each other |
| 1 | API: the `Meetings` migration, start, schedule, end, settings, join pass, host actions, chat relay and saving, webhook → attendance. Unit and API tests | Someone who isn't on the class list is refused. A student without mic rights can't publish sound. Chat is saved only while saving is on. The attendance rows are right |
| 2 | The meeting page: pre-join, grid and speaker views, mic and camera, screen share, chat, people list, hand, reactions, data saver, reconnect, host controls and settings. Entry points on both roles' class pages and the dashboard. Playwright with fake camera and mic, and the axe checks | The core features of a Meet call work at desktop and 320 px widths |
| 3 | The past meeting page (attendance and CSV, saved chat), pinning, background blur, and a load test (`lk load-test`) to size the server | One class of 50 holds a 2-hour meeting with the server under 60% CPU |
| 4 | Recording, as designed above: Record, Pause, Resume, Stop, the "Record the whole meeting" setting, the Egress service, the notice and REC sign, joining the stretches, and the player on the past meeting page. First settle storage and how long recordings are kept | A 1-hour recording with a pause in it plays in the LMS as one video, on a phone and a computer, and the paused part isn't in it |
| Later | Live captions, breakout rooms | Separate plans |

**Going live needs a server from the school:** a Linux machine with a public IP near the users,
a domain with TLS, and these ports open: 443 TCP, 3478 UDP, 7881 TCP, and 50000–60000 UDP.
Rough size to start: 4–8 vCPUs. Phase 3's load test gives the real number. Recording (Phase 4)
needs extra CPU and disk on top of that. Most of the cost is outgoing bandwidth: a 40-student
meeting with video can use 20–60 Mbit/s at the server.

## Decisions (approved 2026-11-26)

| # | Decision | Why |
|---|---|---|
| 1 | Self-hosted **LiveKit**, with our own meeting UI in the LMS design | No time limit and no per-minute fees. It is built for classes on weak phones. Our own UI matches the LMS and enforces the class list |
| 2 | Only the class's instructor starts a meeting. Students can't start one, and they wait until it starts | Same as a teacher's Meet link. It stops meetings nobody is running |
| 3 | Only the instructor and the class's students. No guest links | Keeps outsiders out. A co-teacher or guest speaker can come later |
| 4 | The chat isn't saved unless the instructor turns on "Save the chat" for that meeting. Everyone sees when it is on | Saving is optional, and nobody's messages are kept without them knowing |
| 5 | No recording in v1. Recording is designed now and built in Phase 4. It is optional and records the whole meeting until the instructor pauses or stops it, or the meeting ends. The instructor can also set a meeting to record from its start | It needs storage and a rule for how long recordings are kept. The page leaves room for it, so adding it changes nothing else |
| 6 | Meeting attendance is a report for the instructor. It doesn't change monthly attendance | Monthly attendance counts days present (D-035). The instructor stays the one who records it |
| 7 | Students join with the mic off by default. The instructor's settings decide whether students may turn on their mic and camera, and the instructor can mute, let speak, and ask to unmute | Meet's classroom default, with the instructor in control. Turning someone's mic on still needs that person's tap |
