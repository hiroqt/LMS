#!/bin/sh
# Sizes the meeting server (D-070, Phase 3): four classes of 50 (a lecture, a discussion, many
# cameras, sound only), 2 minutes each, on a throwaway LiveKit set up like docker-compose.yml.
# Prints the server's own CPU and memory and what each viewer receives. Needs Docker and python3.
#   ./load-test.sh [output folder]        (default: ./load-results)
# Results on an Apple M5 are in client/docs/MEETINGS_PLAN.md, "Going live". Run it on the server
# you mean to buy for real numbers.
set -u
OUT="${1:-./load-results}"; mkdir -p "$OUT"
KEY=lms-dev; SECRET=dev_only_livekit_secret_change_me_0123
docker rm -f lk-load >/dev/null 2>&1
docker run -d --rm --name lk-load -e LIVEKIT_KEYS="$KEY: $SECRET" -e NODE_IP=127.0.0.1 \
  -e LIVEKIT_CONFIG="$(printf 'port: 7880\nrtc:\n  tcp_port: 7881\n  udp_port: 7882\n  use_external_ip: false\nlogging:\n  level: warn\n')" \
  livekit/livekit-server:v1.13.11 >/dev/null
sleep 3
scenario() {
  name="$1"; shift
  : > "$OUT/$name.samples"
  ( while true; do docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}}' lk-load >> "$OUT/$name.samples" 2>/dev/null; sleep 3; done ) &
  sampler=$!
  docker run --rm --network container:lk-load livekit/livekit-cli:v2.20.1 load-test --url ws://127.0.0.1:7880 --api-key $KEY --api-secret $SECRET \
    --room "load-$name" --duration 120s --num-per-second 10 "$@" > "$OUT/$name.out" 2>&1
  kill $sampler 2>/dev/null; wait $sampler 2>/dev/null
  python3 -I - "$OUT/$name.samples" "$name" <<'PY'
import sys, re
rows = [l.split() for l in open(sys.argv[1]) if l.strip()]
cpu = [float(r[0].rstrip('%')) for r in rows if r and r[0].endswith('%')]
mem = []
for r in rows:
    m = re.match(r'([\d.]+)(MiB|GiB|KiB)', r[1]) if len(r) > 1 else None
    if m: mem.append(float(m.group(1)) * {'KiB': 1/1024, 'MiB': 1, 'GiB': 1024}[m.group(2)])
busy = cpu[3:] or cpu  # skip the ramp-up samples
print(f"{sys.argv[2]}: server CPU avg {sum(busy)/len(busy):.0f}% max {max(cpu):.0f}% (100% = one core), memory max {max(mem):.0f} MiB, {len(cpu)} samples")
PY
  grep -E 'Total|Sub 0 ' "$OUT/$name.out" | head -2
}
scenario lecture --video-publishers 1 --subscribers 49 --layout speaker
scenario discussion --video-publishers 10 --subscribers 40 --layout 3x3
scenario all-cameras --video-publishers 25 --subscribers 25 --layout 5x5
scenario sound-only --audio-publishers 10 --subscribers 40
docker stop lk-load >/dev/null
echo DONE
