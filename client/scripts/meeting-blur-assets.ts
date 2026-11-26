/**
 * Background blur in meetings (D-070, Phase 3) runs Google's MediaPipe in the browser. Its
 * WebAssembly (about 2.9 MB gzipped, one of two builds per browser) is served by the LMS itself,
 * never from a CDN, so no third party sees who turns blur on. This copies it from node_modules
 * into public/meeting-blur/ before `dev` and `build`; the copy is not committed (.gitignore).
 * The segmentation model (selfie_segmenter.tflite, Apache-2.0) is committed beside it.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const from = join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(process.cwd(), "public", "meeting-blur");
mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((name) => name.startsWith("vision_wasm"));
for (const name of files) copyFileSync(join(from, name), join(to, name));
console.log(`meeting-blur: copied ${files.length} MediaPipe files to public/meeting-blur/`);
