#!/usr/bin/env sh
# Checks that the local meeting server forwards video and sound: two test publishers (camera and
# mic) and two viewers in one room for 10 seconds, then a summary of the tracks each one received.
# Start the server first: docker compose up -d
#
# The CLI runs inside the server's own network, because the server tells clients to send media
# to 127.0.0.1 (NODE_IP). Usage: ./check.sh [seconds]
set -eu
cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a

# The server opens no room by itself (livekit.yaml, auto_create: false), so make the test room first.
docker run --rm --network container:lms-meet-dev livekit/livekit-cli:v2.20.1 \
  room create \
  --url ws://127.0.0.1:7880 \
  --api-key "${LIVEKIT_API_KEY:-lms-dev}" \
  --api-secret "${LIVEKIT_API_SECRET:-dev_only_livekit_secret_change_me_0123}" \
  --empty-timeout 60 \
  lms-check >/dev/null

docker run --rm --network container:lms-meet-dev livekit/livekit-cli:v2.20.1 \
  load-test \
  --url ws://127.0.0.1:7880 \
  --api-key "${LIVEKIT_API_KEY:-lms-dev}" \
  --api-secret "${LIVEKIT_API_SECRET:-dev_only_livekit_secret_change_me_0123}" \
  --room lms-check \
  --video-publishers 2 \
  --audio-publishers 2 \
  --subscribers 2 \
  --duration "${1:-10}s"
