import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { isCancelled, type UploadOptions } from "../../../shared/api/assignments";
import type { Submission } from "../../../shared/api/overview";
import { nextUpload, uploadQueue, type QueuedUpload } from "./uploadQueue";

export interface UploadQueueCallbacks {
  upload: (file: File, options: UploadOptions) => Promise<Submission>;
  /** The draft as the server answered after storing the file. */
  onStored: (draft: Submission, file: File) => void;
  /** Turns a failure into the sentence shown under the file, and whether retrying could help. */
  describe: (error: unknown) => { message: string; retryable: boolean };
  /** Told about each failure (not a cancel), after it is listed. */
  onFailed?: (file: File, message: string) => void;
}

/**
 * Uploads chosen files one at a time (see `uploadQueue`), with progress, Cancel, Retry and Remove.
 * Nothing starts while `paused` (offline): waiting files stay listed and go once it is false.
 */
export function useUploadQueue(callbacks: UploadQueueCallbacks, paused: boolean) {
  const [queue, dispatch] = useReducer(uploadQueue, [] as QueuedUpload[]);
  const latest = useRef(callbacks);
  useLayoutEffect(() => {
    latest.current = callbacks;
  });
  const controllers = useRef(new Map<string, AbortController>());
  const inFlight = useRef<string | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    const next = nextUpload(queue);
    if (!next || paused || inFlight.current) return;
    const { key, file } = next;
    inFlight.current = key;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    dispatch({ type: "start", key });
    // Freed before the state changes, so the effect that change triggers can start the next file.
    const settle = () => {
      controllers.current.delete(key);
      inFlight.current = null;
    };
    latest.current.upload(file, { signal: controller.signal, onProgress: (fraction) => dispatch({ type: "progress", key, fraction }) }).then(
      (draft) => {
        settle();
        latest.current.onStored(draft, file);
        dispatch({ type: "done", key });
      },
      (error: unknown) => {
        settle();
        if (isCancelled(error)) dispatch({ type: "remove", key });
        else {
          const { message, retryable } = latest.current.describe(error);
          dispatch({ type: "fail", key, error: message, retryable });
          latest.current.onFailed?.(file, message);
        }
      },
    );
  }, [queue, paused]);

  useEffect(() => {
    const open = controllers.current;
    return () => open.forEach((controller) => controller.abort());
  }, []);

  const add = useCallback((files: Array<{ file: File; refusal: string | null }>) => {
    dispatch({ type: "add", uploads: files.map(({ file, refusal }) => ({ key: `upload-${(counter.current += 1)}`, file, refusal })) });
  }, []);
  const cancel = useCallback((key: string) => controllers.current.get(key)?.abort(), []);
  const retry = useCallback((key: string) => dispatch({ type: "retry", key }), []);
  const remove = useCallback((key: string) => dispatch({ type: "remove", key }), []);

  return { queue, add, cancel, retry, remove };
}
