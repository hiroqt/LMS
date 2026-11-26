import { BackgroundProcessor } from "@livekit/track-processors";
import type { LocalVideoTrack } from "livekit-client";

/*
 * Background blur (D-070, Phase 3). Loaded only when someone turns it on: this chunk, then
 * MediaPipe's WebAssembly and the selfie-segmentation model from the LMS's own
 * /meeting-blur/ folder (scripts/meeting-blur-assets.ts), never from a CDN.
 */
const base = `${import.meta.env.BASE_URL}meeting-blur`;

/** Blurs (or stops blurring) the background of the person's own camera. */
export async function applyBlur(track: LocalVideoTrack, on: boolean): Promise<void> {
  if (!on) {
    await track.stopProcessor();
    return;
  }
  await track.setProcessor(
    BackgroundProcessor({
      mode: "background-blur",
      blurRadius: 12,
      assetPaths: { tasksVisionFileSet: base, modelAssetPath: `${base}/selfie_segmenter.tflite` },
    }),
  );
}
