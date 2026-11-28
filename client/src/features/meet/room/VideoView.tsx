import type { AudioTrack, VideoTrack } from "livekit-client";
import { useEffect, useRef } from "react";
import { cn } from "../../../shared/lib/cn";

/** One video track in a `<video>`: attached while shown, detached after. */
export function VideoView({ track, mirrored = false, fit = "cover", label }: { track: VideoTrack; mirrored?: boolean; fit?: "cover" | "contain"; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      aria-label={label}
      autoPlay
      playsInline
      muted
      className={cn("absolute inset-0 size-full", fit === "cover" ? "object-cover" : "object-contain", mirrored && "-scale-x-100")}
    />
  );
}

/** One person's sound. Not shown; the browser plays it. */
export function AudioView({ track }: { track: AudioTrack }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return <audio ref={ref} autoPlay />;
}
