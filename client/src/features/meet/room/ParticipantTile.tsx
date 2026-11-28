import { Track, type Participant, type VideoTrack } from "livekit-client";
import { AudioLines, Hand, MicOff, Pin, PinOff } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { handRaisedAt, isHost } from "./rights";
import type { ShownReaction } from "./useReactions";
import { VideoView } from "./VideoView";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";

/**
 * One person: their camera, or their initials when it is off or paused by Data saver. Their
 * name, mic, hand, and reaction sit on solid strips (C-019), as icons with words, not color
 * alone. `size` is the grid, the large spot (pinned or speaking), or the strip beside a screen.
 */
export function ParticipantTile({ participant, isLocal, reaction, dataSaver = false, pinned = false, onPin, size = "grid" }: {
  participant: Participant;
  isLocal: boolean;
  reaction?: ShownReaction;
  dataSaver?: boolean;
  pinned?: boolean;
  onPin?: () => void;
  size?: "grid" | "focus" | "strip";
}) {
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const video = camera && !camera.isMuted ? (camera.track as VideoTrack | undefined) : undefined;
  const paused = !isLocal && dataSaver && camera !== undefined && !camera.isMuted;
  const mic = participant.getTrackPublication(Track.Source.Microphone);
  const micOn = Boolean(mic && !mic.isMuted && mic.track);
  const name = participant.name || participant.identity;
  const host = isHost(participant);
  const hand = handRaisedAt(participant);
  const Tag = size === "focus" ? "div" : "li";
  return (
    <Tag
      role={size === "focus" ? "group" : undefined}
      aria-label={`${name}${isLocal ? " (you)" : ""}${host ? ", instructor" : ""}${hand ? ", hand raised" : ""}`}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-card bg-primary-900",
        size === "focus" ? "size-full min-h-48" : "aspect-video",
        size === "strip" && "w-44 shrink-0",
        participant.isSpeaking && "outline-3 outline-offset-2 outline-primary-400",
      )}
    >
      {video && !paused ? (
        <VideoView track={video} mirrored={isLocal} label={`${name}'s camera`} />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className={cn("flex items-center justify-center rounded-full bg-primary-700 font-semibold text-white", size === "strip" ? "size-10 text-body" : "size-16 text-section")}>{initials(name)}</span>
        </span>
      )}
      <span className="absolute top-2 left-2 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5">
        {hand && (
          <span className="flex items-center gap-1 rounded-chip bg-surface px-2 py-1 text-body font-semibold text-ink">
            <Hand aria-hidden className="size-4" />
            {/* A strip tile is small: the icon, with the words read. */}
            <span className={size === "strip" ? "sr-only" : undefined}>Hand raised</span>
          </span>
        )}
        {reaction && <span className="rounded-chip bg-surface px-2 py-1 text-body"><span aria-hidden>{reaction.emoji}</span><span className="sr-only">{reaction.label}</span></span>}
        {paused && size !== "strip" && <span className="rounded-chip bg-surface px-2 py-1 text-body text-ink">Video paused (Data saver)</span>}
      </span>
      {onPin && (
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
          title={pinned ? "Unpin" : "Pin"}
          onClick={onPin}
          className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-control bg-surface text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
        >
          {pinned ? <PinOff aria-hidden className="size-4" /> : <Pin aria-hidden className="size-4" />}
        </button>
      )}
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] min-w-0 items-center gap-1.5 rounded-chip bg-ink px-2 py-1 text-body text-white">
        {!micOn && <MicOff aria-hidden className="size-4 shrink-0" />}
        {participant.isSpeaking && <AudioLines aria-hidden className="size-4 shrink-0" />}
        <span className="truncate">{name}{isLocal && " (you)"}</span>
        {host && size !== "strip" && <span className="shrink-0 text-primary-100">· Instructor</span>}
        <span className="sr-only">{micOn ? (participant.isSpeaking ? ", speaking" : "") : ", microphone off"}</span>
      </span>
    </Tag>
  );
}
