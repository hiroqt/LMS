import { Track, type Participant, type VideoTrack } from "livekit-client";
import { AudioLines, MicOff } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { isHost } from "./rights";
import { VideoView } from "./VideoView";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";

/**
 * One person in the grid: their camera, or their initials when it is off. The name sits on a
 * solid strip (C-019); the mic state and "speaking" are icons with words, not color alone.
 */
export function ParticipantTile({ participant, isLocal }: { participant: Participant; isLocal: boolean }) {
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const video = camera && !camera.isMuted ? (camera.track as VideoTrack | undefined) : undefined;
  const mic = participant.getTrackPublication(Track.Source.Microphone);
  const micOn = Boolean(mic && !mic.isMuted && mic.track);
  const name = participant.name || participant.identity;
  const host = isHost(participant);
  return (
    <li
      aria-label={`${name}${isLocal ? " (you)" : ""}${host ? ", instructor" : ""}`}
      className={cn("relative aspect-video min-w-0 overflow-hidden rounded-card bg-primary-900", participant.isSpeaking && "outline-3 outline-offset-2 outline-primary-400")}
    >
      {video ? (
        <VideoView track={video} mirrored={isLocal} label={`${name}'s camera`} />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-700 text-section font-semibold text-white">{initials(name)}</span>
        </span>
      )}
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] min-w-0 items-center gap-1.5 rounded-chip bg-ink px-2 py-1 text-body text-white">
        {!micOn && <MicOff aria-hidden className="size-4 shrink-0" />}
        {participant.isSpeaking && <AudioLines aria-hidden className="size-4 shrink-0" />}
        <span className="truncate">{name}{isLocal && " (you)"}</span>
        {host && <span className="shrink-0 text-primary-100">· Instructor</span>}
        <span className="sr-only">{micOn ? (participant.isSpeaking ? ", speaking" : "") : ", microphone off"}</span>
      </span>
    </li>
  );
}
