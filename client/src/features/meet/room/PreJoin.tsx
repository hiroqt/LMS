import { createLocalAudioTrack, createLocalVideoTrack, VideoPresets, type LocalAudioTrack, type LocalTrack, type LocalVideoTrack } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "../../../shared/hooks/useNetworkStatus";
import { Button } from "../../../shared/ui/Button";
import type { Meeting } from "../api/meetings";
import { MediaToggle } from "./MediaToggle";
import { notAllowedText, rightsBeforeJoin } from "./rights";
import { VideoView } from "./VideoView";

const blocked = {
  camera: "Your browser didn't give the page your camera. Allow it from the address bar, or join without it.",
  microphone: "Your browser didn't give the page your microphone. Allow it from the address bar, or join without it.",
};

/**
 * Before joining: see yourself, choose mic and camera, and join. The meeting's settings decide
 * what a student may turn on (D-070, decision 7); students start with the mic off by default.
 * The tracks made here are handed to the meeting, so the camera doesn't blink or ask again.
 */
export function PreJoin({ meeting, role, name, busy, onJoin }: {
  meeting: Meeting;
  role: "instructor" | "student";
  name: string;
  busy: boolean;
  onJoin: (tracks: LocalTrack[], options: { start: boolean }) => void;
}) {
  const rights = rightsBeforeJoin(role, meeting.settings);
  const network = useNetworkStatus();
  const [camera, setCamera] = useState<LocalVideoTrack | null>(null);
  const [mic, setMic] = useState<LocalAudioTrack | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** A camera or mic still starting: Join waits for it, so it isn't left behind (and left on). */
  const [starting, setStarting] = useState(false);
  const handedOver = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const live = useRef<{ camera: LocalVideoTrack | null; mic: LocalAudioTrack | null }>({ camera: null, mic: null });
  useEffect(() => {
    live.current = { camera, mic };
  }, [camera, mic]);

  // The instructor starts with the mic on; a student only when the meeting lets them.
  const micByDefault = role === "instructor" || (rights.microphone && !meeting.settings.studentsJoinMuted);
  useEffect(() => {
    if (!micByDefault) return;
    let cancelled = false;
    createLocalAudioTrack().then(
      (track) => (cancelled ? track.stop() : setMic(track)),
      () => !cancelled && setProblem(blocked.microphone),
    );
    return () => {
      cancelled = true;
    };
  }, [micByDefault]);

  // Tracks not handed to the meeting are stopped when the screen goes away.
  useEffect(
    () => () => {
      if (handedOver.current) return;
      live.current.camera?.stop();
      live.current.mic?.stop();
    },
    [],
  );

  const toggleCamera = async () => {
    if (!rights.camera) return setProblem(notAllowedText.camera);
    setProblem(null);
    if (camera) {
      camera.stop();
      setCamera(null);
      return;
    }
    setStarting(true);
    try {
      const track = await createLocalVideoTrack({ resolution: VideoPresets.h540.resolution });
      // The screen went away while the camera started: turn it off again.
      if (!alive.current) track.stop();
      else setCamera(track);
    } catch {
      if (alive.current) setProblem(blocked.camera);
    } finally {
      if (alive.current) setStarting(false);
    }
  };

  const toggleMic = async () => {
    if (!rights.microphone) return setProblem(notAllowedText.microphone);
    setProblem(null);
    if (mic) {
      mic.stop();
      setMic(null);
      return;
    }
    setStarting(true);
    try {
      const track = await createLocalAudioTrack();
      if (!alive.current) track.stop();
      else setMic(track);
    } catch {
      if (alive.current) setProblem(blocked.microphone);
    } finally {
      if (alive.current) setStarting(false);
    }
  };

  const startsIt = role === "instructor" && meeting.status === "scheduled";
  const join = () => {
    handedOver.current = true;
    onJoin([camera, mic].filter((track): track is LocalVideoTrack | LocalAudioTrack => track !== null), { start: startsIt });
  };

  return (
    <section aria-labelledby="prejoin-title" className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 p-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:items-center sm:p-6">
      <div className="relative aspect-video overflow-hidden rounded-card bg-primary-900">
        {camera ? (
          <VideoView track={camera} mirrored label="Your camera preview" />
        ) : (
          <p className="absolute inset-0 m-0 flex items-center justify-center text-body text-primary-100">Your camera is off</p>
        )}
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-3">
          <MediaToggle label="Microphone" on={mic !== null} allowed={rights.microphone} onIcon={<Mic />} offIcon={<MicOff />} onPress={() => void toggleMic()} />
          <MediaToggle label="Camera" on={camera !== null} allowed={rights.camera} onIcon={<Video />} offIcon={<VideoOff />} onPress={() => void toggleCamera()} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 id="prejoin-title" className="m-0 text-section font-semibold">Ready to join?</h2>
        <p className="m-0 text-body text-muted">Joining as <strong className="font-semibold text-ink">{name}</strong></p>
        {meeting.status === "scheduled" && role === "student" && (
          <p className="m-0 text-body">The instructor hasn't started this meeting yet. You'll join as soon as they do.</p>
        )}
        {problem && <p role="status" className="m-0 rounded-control bg-warning-soft p-3 text-body text-warning">{problem}</p>}
        {!network.online && (
          <p role="status" className="m-0 flex items-start gap-2 rounded-control bg-warning-soft p-3 text-body text-warning">
            <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />A meeting needs a connection. Reconnect, then join.
          </p>
        )}
        <Button onClick={join} loading={busy || starting} loadingLabel={starting ? "Getting your devices ready" : startsIt ? "Starting the meeting" : "Joining"} disabled={!network.online} className="self-start">
          {startsIt ? "Start meeting" : "Join now"}
        </Button>
      </div>
    </section>
  );
}
