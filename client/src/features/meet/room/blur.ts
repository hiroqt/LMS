import type { LocalVideoTrack } from "livekit-client";

/**
 * Can this browser blur its camera's background, smoothly enough to offer? The processor needs
 * WebGL2, OffscreenCanvas, VideoFrame, and createImageBitmap; phones are left out, where it
 * would slow the whole meeting down. Checked without loading the blur code.
 */
export function canBlur(): boolean {
  if (typeof window === "undefined") return false;
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) return false;
  if (typeof OffscreenCanvas === "undefined" || typeof VideoFrame === "undefined" || typeof createImageBitmap === "undefined") return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

/** Turns blur on or off for a camera track, loading the blur code the first time. */
export async function setBlur(track: LocalVideoTrack, on: boolean): Promise<void> {
  const { applyBlur } = await import("./meetingBlur");
  await applyBlur(track, on);
}

/** The preference key: someone who blurs once keeps blurring in later meetings (C-016). */
export const BLUR_KEY = "tmcc-meeting-blur";
