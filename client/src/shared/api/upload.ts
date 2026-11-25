import { ApiError, apiUrl, kindForStatus } from "./http";
import { identityHeaders, type Viewer } from "./viewer";

export interface UploadOptions {
  /** 0 to 1, as the bytes leave the browser. */
  onProgress?: (fraction: number) => void;
  /** Cancels the upload. */
  signal?: AbortSignal;
}

/**
 * Sends multipart form data and resolves with the JSON reply. `fetch` cannot report upload
 * progress, so this uses XMLHttpRequest; it rejects with the same `ApiError` as the JSON calls, or
 * an `AbortError` when cancelled. There is no timeout: a large file on a slow connection is allowed
 * to take its time, and the person can cancel.
 */
export function sendForm<T>(method: "POST" | "PUT", path: string, form: FormData, viewer: Viewer, options: UploadOptions = {}): Promise<T> {
  const url = apiUrl(path);
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "text";
    xhr.setRequestHeader("Accept", "application/json");
    for (const [name, value] of Object.entries(identityHeaders(viewer))) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(1, event.loaded / event.total));
    };
    const cancel = () => xhr.abort();
    const done = () => options.signal?.removeEventListener("abort", cancel);
    xhr.onload = () => {
      done();
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body && typeof body === "object") {
        options.onProgress?.(1);
        resolve(body as T);
        return;
      }
      const problem = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      reject(new ApiError({
        kind: xhr.status >= 200 && xhr.status < 300 ? "invalid-response" : kindForStatus(xhr.status), status: xhr.status, url,
        title: typeof problem.title === "string" && problem.title ? problem.title : undefined,
        detail: typeof problem.detail === "string" && problem.detail ? problem.detail : undefined,
        fieldErrors: problem.errors && typeof problem.errors === "object" ? (problem.errors as Record<string, string[]>) : undefined,
        problem,
      }));
    };
    xhr.onerror = () => {
      done();
      reject(new ApiError({ kind: "network", status: 0, url }));
    };
    xhr.onabort = () => {
      done();
      reject(new DOMException("The upload was cancelled.", "AbortError"));
    };
    if (options.signal?.aborted) {
      reject(new DOMException("The upload was cancelled.", "AbortError"));
      return;
    }
    options.signal?.addEventListener("abort", cancel, { once: true });
    xhr.send(form);
  });
}
