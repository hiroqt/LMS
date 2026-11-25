import { describeApiError, getFile, getJson, isApiError, sendJson } from "./http";
import type { FileTypeKey, Submission, SubmittedFile } from "./overview";
import { sendForm, type UploadOptions } from "./upload";
import type { Viewer } from "./viewer";

/**
 * Assignment drafts, files, turning in, and taking work back (D-055, D-058;
 * `docs/ASSIGNMENTS_API_CONTRACT.md` §5–§8). The server decides every rule;
 * the checks here only save a student an upload that would be refused anyway.
 */

/** Each file is at most 25 MB (contract §5). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** The most files an instructor can allow per turn-in. */
export const MAX_FILES = 5;

export const FILE_TYPE_KEYS: FileTypeKey[] = ["pdf", "word", "powerpoint", "excel", "image", "text"];

/** What each accepted type is called, and the names a file of that type may have. */
export const FILE_TYPES: Record<FileTypeKey, { label: string; extensions: string[] }> = {
  pdf: { label: "PDF", extensions: [".pdf"] },
  word: { label: "Word (.docx)", extensions: [".docx"] },
  powerpoint: { label: "PowerPoint (.pptx)", extensions: [".pptx"] },
  excel: { label: "Excel (.xlsx)", extensions: [".xlsx"] },
  image: { label: "Photos (JPEG, PNG)", extensions: [".jpg", ".jpeg", ".png"] },
  text: { label: "Text (.txt)", extensions: [".txt"] },
};

/** "PDF, Word (.docx), Photos (JPEG, PNG)" */
export const fileTypeList = (types: FileTypeKey[]) => types.map((type) => FILE_TYPES[type].label).join(", ");

/**
 * The `accept` of a file input. Extensions, not MIME types, so phones offer the
 * file picker and, for photos, the camera in JPEG (the server takes no HEIC).
 */
export const acceptFor = (types: FileTypeKey[]) => types.flatMap((type) => FILE_TYPES[type].extensions).join(",");

/** The type of a stored file, from the content type the server gave it. */
export function fileTypeOf(contentType: string): FileTypeKey | undefined {
  if (contentType === "application/pdf") return "pdf";
  if (contentType.includes("wordprocessingml")) return "word";
  if (contentType.includes("presentationml")) return "powerpoint";
  if (contentType.includes("spreadsheetml")) return "excel";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("text/plain")) return "text";
  return undefined;
}

/** "PDF", "Word", "JPEG", … for a file row. */
export function fileKindLabel(file: Pick<SubmittedFile, "contentType">): string {
  if (file.contentType === "image/jpeg") return "JPEG";
  if (file.contentType === "image/png") return "PNG";
  const type = fileTypeOf(file.contentType);
  return type ? FILE_TYPES[type].label.replace(/ \(.*\)$/, "") : "File";
}

/** "183 KB", "2.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

/**
 * Why a chosen file would be refused, before it is uploaded: too big, empty, or a name the
 * assignment doesn't take. Null when it is worth sending. The server checks the bytes itself.
 */
export function refusalBeforeUpload(file: { name: string; size: number }, allowed: FileTypeKey[]): string | null {
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "This file is larger than 25 MB.";
  const extension = /\.[^.]+$/.exec(file.name)?.[0].toLowerCase() ?? "";
  if (!allowed.some((type) => FILE_TYPES[type].extensions.includes(extension))) return `This assignment takes only: ${fileTypeList(allowed)}.`;
  return null;
}

/** Proof of a turn-in: when, and exactly which files (contract §7). */
export interface Receipt {
  submissionId: number;
  attemptNumber: number;
  submittedAt: string;
  late: boolean;
  files: Array<Pick<SubmittedFile, "id" | "name" | "size" | "code">>;
}

export interface TurnInReceipt {
  submission: Submission;
  receipt: Receipt;
}

const workPath = (classId: string, courseworkId: string | number) => `/api/classes/${encodeURIComponent(classId)}/coursework/${courseworkId}`;

/** The student's rows for one assignment, oldest first: versions, any taken back, and the draft. */
export const fetchMySubmissions = (viewer: Viewer, classId: string, courseworkId: string | number, signal?: AbortSignal) =>
  getJson<Submission[]>(`${workPath(classId, courseworkId)}/my-submissions`, { identity: true, viewer, signal });

/** Returns the draft, creating it when there is none. After turned-in work it starts as a copy of that work. */
export const startDraft = (viewer: Viewer, classId: string, courseworkId: string | number) =>
  sendJson<Submission>("POST", `${workPath(classId, courseworkId)}/draft`, undefined, { viewer });

/** Autosave: both fields replace what the draft has; null clears one. */
export const saveDraft = (viewer: Viewer, classId: string, courseworkId: string | number, work: { text: string | null; link: string | null }, signal?: AbortSignal) =>
  sendJson<Submission>("PUT", `${workPath(classId, courseworkId)}/draft`, work, { viewer, signal });

export const removeDraftFile = (viewer: Viewer, classId: string, courseworkId: string | number, fileId: number) =>
  sendJson<Submission>("DELETE", `${workPath(classId, courseworkId)}/draft/files/${fileId}`, undefined, { viewer });

/** Turns the draft in. A repeat with no draft answers the receipt of the latest turned-in work. */
export const turnInDraft = (viewer: Viewer, classId: string, courseworkId: string | number, honorStatement: boolean) =>
  sendJson<TurnInReceipt>("POST", `${workPath(classId, courseworkId)}/draft/turn-in`, { honorStatement }, { viewer });

/** Takes back the latest turned-in work; the answer is the draft that takes its place. */
export const unsubmit = (viewer: Viewer, classId: string, courseworkId: string | number) =>
  sendJson<Submission>("POST", `${workPath(classId, courseworkId)}/unsubmit`, undefined, { viewer });

export type { UploadOptions } from "./upload";

/** Adds one file to the draft, reporting progress as the bytes go (see `sendForm`). */
export function uploadDraftFile(viewer: Viewer, classId: string, courseworkId: string | number, file: File, options: UploadOptions = {}): Promise<Submission> {
  const form = new FormData();
  form.append("file", file, file.name);
  return sendForm<Submission>("POST", `${workPath(classId, courseworkId)}/draft/files`, form, viewer, options);
}

/**
 * Why an upload or a change to the draft failed, in the server's own words when it gave some:
 * the sentence for the file (422), the rule that refuses (409), the upload limit (429), or the
 * virus scan being unreachable (503).
 */
export function draftFailureMessage(error: unknown): string {
  if (isApiError(error)) {
    const field = Object.values(error.fieldErrors).flat()[0];
    if ((error.status === 400 || error.status === 422) && field) return field;
    if ((error.status === 409 || error.status === 429 || error.status === 503) && error.title) return error.title;
    if (error.kind === "network" && typeof navigator !== "undefined" && navigator.onLine === false) return "You’re offline. Reconnect, then try again.";
  }
  const { title, detail } = describeApiError(error);
  return `${title}. ${detail}`;
}

export const isCancelled = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * A stored file's bytes. The identity travels in headers, so a file can't be an `href` or a
 * `src` (L-075): fetch it, then show or save the blob.
 */
export const fetchStoredFile = (viewer: Viewer, fileId: number, signal?: AbortSignal) => getFile(`/api/files/${fileId}`, { viewer, signal });

/** Saves bytes as a file through a temporary link. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
