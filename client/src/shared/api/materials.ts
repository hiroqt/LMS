import { FILE_TYPES, MAX_FILE_BYTES } from "./assignments";
import { getFile, sendJson } from "./http";
import type { FileTypeKey } from "./overview";
import { sendForm, type UploadOptions } from "./upload";
import type { Viewer } from "./viewer";

/**
 * A class material's file and its preview (D-067; `server/README.md`, Class material files).
 * The server checks and scans every file; the checks here only save an upload it would refuse.
 */

/** How an Office file's PDF copy turned out. */
export type PreviewStatus = "ready" | "failed" | "off";

export interface MaterialFile {
  id: number;
  name: string;
  contentType: string;
  /** Null for a type the client does not know (never sent today). */
  type: FileTypeKey | null;
  size: number;
  /** Null when the file is its own preview (PDF, image, text). */
  preview: PreviewStatus | null;
  /** The bytes of an Office file's PDF copy, which its preview downloads instead. Null without one. */
  previewSize?: number | null;
}

/** The material as the server sends it after an upload, a replacement, or a removal. */
export interface MaterialDto {
  id: number;
  moduleId: number;
  title: string;
  kind: string;
  description: string | null;
  status: "active" | "archived";
  createdAt: string;
  file: MaterialFile | null;
}

/** Previews load by themselves up to this size; bigger files wait for a tap (decision 4). */
export const PREVIEW_AUTO_BYTES = 5 * 1024 * 1024;
/** Text files show this much; the rest is a download away. */
export const TEXT_PREVIEW_BYTES = 200 * 1024;

/** Every type a material may be: the same as turn-ins (decision 3). */
export const MATERIAL_ACCEPT = Object.values(FILE_TYPES).flatMap((type) => type.extensions).join(",");

/** What the preview shows, and where its bytes come from. */
export type PreviewPlan =
  | { kind: "pdf" | "image" | "text"; source: "file" | "preview" }
  | { kind: "none"; reason: "failed" | "off" | "unknown" };

export function previewPlan(file: Pick<MaterialFile, "type" | "preview">): PreviewPlan {
  switch (file.type) {
    case "pdf":
      return { kind: "pdf", source: "file" };
    case "image":
      return { kind: "image", source: "file" };
    case "text":
      return { kind: "text", source: "file" };
    case "word":
    case "powerpoint":
    case "excel":
      return file.preview === "ready" ? { kind: "pdf", source: "preview" } : { kind: "none", reason: file.preview === "off" ? "off" : "failed" };
    default:
      return { kind: "none", reason: "unknown" };
  }
}

/** What the preview downloads: an Office file's PDF copy (which can be the bigger one), else the file itself. */
export function previewBytes(file: Pick<MaterialFile, "size" | "previewSize">, plan: PreviewPlan): number {
  return plan.kind !== "none" && plan.source === "preview" ? (file.previewSize ?? file.size) : file.size;
}

/**
 * Whether a preview waits for a tap: what it would download is over 5 MB, or the phone's data
 * saver is on. Text too: the whole file downloads even though only its start is shown.
 */
export function previewWaits(file: Pick<MaterialFile, "size" | "previewSize">, plan: PreviewPlan, saveData: boolean): boolean {
  if (plan.kind === "none") return false;
  return saveData || previewBytes(file, plan) > PREVIEW_AUTO_BYTES;
}

/** The phone's data saver ("Lite mode"), where the browser tells us. */
export function dataSaverOn(): boolean {
  const connection = (globalThis.navigator as (Navigator & { connection?: { saveData?: boolean } }) | undefined)?.connection;
  return connection?.saveData === true;
}

/** "1 page", "12 slides": the length of a drawn PDF, or of a PowerPoint's PDF copy. */
export const pageCountLabel = (count: number, type: MaterialFile["type"]) => `${count} ${type === "powerpoint" ? "slide" : "page"}${count === 1 ? "" : "s"}`;

/** Why a chosen file would be refused before it is sent. Null when it is worth sending. */
export function materialFileRefusal(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "This file is larger than 25 MB.";
  const extension = /\.[^.]+$/.exec(file.name)?.[0].toLowerCase() ?? "";
  if (!MATERIAL_ACCEPT.split(",").includes(extension)) return "Use a PDF, Word, PowerPoint, Excel, JPEG, PNG, or text file.";
  return null;
}

const materialsPath = (classId: string) => `/api/classes/${encodeURIComponent(classId)}/materials`;

/** The file, or the PDF copy of an Office file. Fetched with the viewer's headers (L-075). */
export const fetchMaterialFile = (viewer: Viewer, classId: string, materialId: number | string, source: "file" | "preview", signal?: AbortSignal) =>
  getFile(`${materialsPath(classId)}/${materialId}/${source}`, { viewer, signal });

export interface MaterialFields {
  moduleId: string;
  title: string;
  kind: string;
  description: string;
}

/** A new material with its file: both are saved, or neither. The fields go first so a missing title is refused before the bytes. */
export function uploadMaterial(viewer: Viewer, classId: string, fields: MaterialFields, file: File, options: UploadOptions = {}): Promise<MaterialDto> {
  const form = new FormData();
  form.append("moduleId", fields.moduleId);
  form.append("title", fields.title);
  form.append("kind", fields.kind);
  form.append("description", fields.description);
  form.append("file", file, file.name);
  return sendForm<MaterialDto>("POST", `${materialsPath(classId)}/upload`, form, viewer, options);
}

/** Adds a file to a material, or replaces its file. */
export function replaceMaterialFile(viewer: Viewer, classId: string, materialId: number | string, file: File, options: UploadOptions = {}): Promise<MaterialDto> {
  const form = new FormData();
  form.append("file", file, file.name);
  return sendForm<MaterialDto>("PUT", `${materialsPath(classId)}/${materialId}/file`, form, viewer, options);
}

export const removeMaterialFile = (viewer: Viewer, classId: string, materialId: number | string) =>
  sendJson<MaterialDto>("DELETE", `${materialsPath(classId)}/${materialId}/file`, undefined, { viewer });
