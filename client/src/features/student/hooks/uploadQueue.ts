/**
 * The files a student chose that are not on the draft yet, without React so it can be tested.
 * Files upload one at a time, in the order chosen: the first upload may create the draft, and a
 * second one at the same moment would race it. A file leaves the queue once it is stored; a file
 * that failed stays, with the reason, until the student retries or removes it.
 */

export interface QueuedUpload {
  key: string;
  file: File;
  status: "waiting" | "uploading" | "failed";
  /** 0 to 1 while uploading. */
  progress: number;
  /** Why it failed, in the server's words when it gave some. */
  error?: string;
  /** Trying again could help (the connection, a busy server), unlike a refused file. */
  retryable?: boolean;
}

export type UploadAction =
  | { type: "add"; uploads: Array<{ key: string; file: File; refusal?: string | null }> }
  | { type: "start"; key: string }
  | { type: "progress"; key: string; fraction: number }
  | { type: "done"; key: string }
  | { type: "fail"; key: string; error: string; retryable: boolean }
  | { type: "retry"; key: string }
  | { type: "remove"; key: string };

const update = (queue: QueuedUpload[], key: string, change: (item: QueuedUpload) => QueuedUpload) =>
  queue.map((item) => (item.key === key ? change(item) : item));

export function uploadQueue(queue: QueuedUpload[], action: UploadAction): QueuedUpload[] {
  switch (action.type) {
    case "add":
      // A file refused before upload (too big, a type the assignment doesn't take) is listed as failed at once.
      return [...queue, ...action.uploads.map(({ key, file, refusal }): QueuedUpload =>
        refusal ? { key, file, status: "failed", progress: 0, error: refusal, retryable: false } : { key, file, status: "waiting", progress: 0 })];
    case "start":
      return update(queue, action.key, (item) => ({ ...item, status: "uploading", progress: 0, error: undefined, retryable: undefined }));
    case "progress":
      return update(queue, action.key, (item) => (item.status === "uploading" ? { ...item, progress: Math.max(item.progress, Math.min(1, action.fraction)) } : item));
    case "fail":
      return update(queue, action.key, (item) => ({ ...item, status: "failed", progress: 0, error: action.error, retryable: action.retryable }));
    case "retry":
      return update(queue, action.key, (item) => (item.status === "failed" ? { ...item, status: "waiting", error: undefined, retryable: undefined } : item));
    case "done":
    case "remove":
      return queue.filter((item) => item.key !== action.key);
  }
}

/** The next file to send, when none is uploading. */
export function nextUpload(queue: QueuedUpload[]): QueuedUpload | undefined {
  if (queue.some((item) => item.status === "uploading")) return undefined;
  return queue.find((item) => item.status === "waiting");
}

/** Files that will take a place on the draft: waiting or uploading, not failed. */
export const pendingCount = (queue: QueuedUpload[]) => queue.filter((item) => item.status !== "failed").length;
