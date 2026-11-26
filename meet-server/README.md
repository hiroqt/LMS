# Meeting server (LiveKit), local development

The media server behind class meetings: live video, sound, and screen sharing (D-070,
[`client/docs/MEETINGS_PLAN.md`](../client/docs/MEETINGS_PLAN.md)). It is
[LiveKit](https://github.com/livekit/livekit), an open-source SFU (Apache 2.0) that forwards each
person's streams to everyone else without re-encoding them. It holds no LMS data. The LMS API
decides who may join and gives each person a short-lived join pass signed with this server's key.

This folder runs it for local development only. Going live needs a server with a public IP, a
domain with TLS, and open UDP ports (see "Going live" in the plan).

## Start, check, stop

```sh
cd meet-server
docker compose up -d     # LiveKit 1.13.11 on ws://localhost:7880
./check.sh               # 2 test publishers (camera + mic) and 2 viewers for 10 s
docker compose down      # stop; nothing is kept
```

`./check.sh` passes when both viewers report `4/4` tracks and no errors:

```
│ Sub 0  │ 4/4    │ 2.0mbps │ 0 (0%) │ - │
│ Sub 1  │ 4/4    │ 2.0mbps │ 0 (0%) │ - │
```

## Ports

| Port | What |
|---|---|
| 7880 TCP | Signalling (WebSocket) and the server API the LMS API calls |
| 7881 TCP | Media over TCP, when a network blocks UDP |
| 7882 UDP | Media over UDP: one port for every participant |

All three are bound to `127.0.0.1`, and the server tells browsers to send media to
`127.0.0.1`. So only browsers on this computer can join, which is all that development and the
tests need.

**To join from a phone on the same Wi-Fi**, put your computer's LAN address in `meet-server/.env`
and restart the server:

```sh
MEET_BIND_IP=0.0.0.0
MEET_NODE_IP=192.168.1.12   # your computer's address on the Wi-Fi
```

The phone also needs the LMS over HTTPS, because browsers allow the camera and mic only on HTTPS
pages (or `localhost`). Undo this when you're done: it opens the server to your network.

## Key and secret

`docker-compose.yml` has an obvious dev-only placeholder (`lms-dev` and a `dev_only_…` secret).
Override them in an untracked `meet-server/.env`:

```sh
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...   # at least 32 characters
```

The LMS API needs the same key and secret, in its user-secrets or environment variables
(`Lms:Meet:*`, see "Class meetings" in [`server/README.md`](../server/README.md)). Never commit a
real secret.

## Settings (`livekit.yaml`)

- No limit on a meeting's length. A room closes 5 minutes after the last person leaves, so an
  instructor whose connection drops can come back to the same meeting.
- `enable_remote_unmute: false`: nobody can switch on someone else's mic or camera (decision 7).
  The instructor can mute people, and can ask them to unmute.
- Webhooks go to the LMS API at `http://host.docker.internal:5200/api/meetings/livekit-webhook`
  (joined, left, and room closed, for meeting attendance). They are signed with the API key, so
  the LMS API reads only ours. If the API isn't running, LiveKit logs that the webhook failed, and
  the meeting still works.
- The LMS API creates each meeting's room with its own close delay (`Lms:Meet:EmptyRoomMinutes`),
  which replaces the two room timeouts above for meetings.
