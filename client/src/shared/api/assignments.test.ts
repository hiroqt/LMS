import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptFor, draftFailureMessage, fileKindLabel, fileTypeList, fileTypeOf, formatBytes, isCancelled, MAX_FILE_BYTES, refusalBeforeUpload, uploadDraftFile } from "./assignments";
import { ApiError } from "./http";
import { SANDBOX_KEY } from "./viewer";

const viewer = { id: "STU-1", role: "student" } as const;

/** Stands in for XMLHttpRequest: records what was sent and lets the test answer. */
class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: FormData | undefined;
  status = 0;
  responseText = "";
  responseType = "";
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() { FakeXhr.last = this; }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send(body: FormData) { this.body = body; }
  abort() { this.onabort?.(); }
  answer(status: number, body: unknown) { this.status = status; this.responseText = JSON.stringify(body); this.onload?.(); }
}

afterEach(() => vi.unstubAllGlobals());

describe("file rules", () => {
  it("lists types and builds the accept of a file input from extensions", () => {
    expect(fileTypeList(["pdf", "image"])).toBe("PDF, Photos (JPEG, PNG)");
    expect(acceptFor(["pdf", "image", "word"])).toBe(".pdf,.jpg,.jpeg,.png,.docx");
  });

  it("names a stored file's type from the content type the server gave it", () => {
    expect(fileTypeOf("application/pdf")).toBe("pdf");
    expect(fileTypeOf("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("powerpoint");
    expect(fileTypeOf("text/plain; charset=utf-8")).toBe("text");
    expect(fileTypeOf("application/zip")).toBeUndefined();
    expect(fileKindLabel({ contentType: "image/png" })).toBe("PNG");
    expect(fileKindLabel({ contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })).toBe("Word");
    expect(fileKindLabel({ contentType: "application/octet-stream" })).toBe("File");
  });

  it("formats sizes", () => {
    expect([formatBytes(512), formatBytes(183_422), formatBytes(2_516_582), formatBytes(MAX_FILE_BYTES)]).toEqual(["512 B", "179 KB", "2.4 MB", "25 MB"]);
  });

  it("refuses a file before upload only for what the browser can know", () => {
    expect(refusalBeforeUpload({ name: "er.PDF", size: 10 }, ["pdf"])).toBeNull();
    expect(refusalBeforeUpload({ name: "er.pdf", size: 0 }, ["pdf"])).toBe("This file is empty.");
    expect(refusalBeforeUpload({ name: "er.pdf", size: MAX_FILE_BYTES + 1 }, ["pdf"])).toBe("This file is larger than 25 MB.");
    expect(refusalBeforeUpload({ name: "essay.docx", size: 10 }, ["pdf", "image"])).toBe("This assignment takes only: PDF, Photos (JPEG, PNG).");
    expect(refusalBeforeUpload({ name: "no-extension", size: 10 }, ["pdf"])).toContain("takes only");
  });
});

describe("uploadDraftFile", () => {
  const start = (options?: Parameters<typeof uploadDraftFile>[4]) => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = uploadDraftFile(viewer, "class a", 7, new File(["%PDF-1.7"], "er.pdf"), options);
    return { promise, xhr: FakeXhr.last };
  };

  it("posts the file as the `file` part with the viewer's headers and reports progress", async () => {
    localStorage.setItem(SANDBOX_KEY, "t1");
    const progress: number[] = [];
    const { promise, xhr } = start({ onProgress: (fraction) => progress.push(fraction) });
    expect([xhr.method, xhr.url]).toEqual(["POST", "http://localhost:5200/api/classes/class%20a/coursework/7/draft/files"]);
    expect(xhr.headers).toEqual({ Accept: "application/json", "X-Demo-Sandbox": "t1", "X-Demo-User-Id": "STU-1", "X-Demo-Role": "student" });
    expect(xhr.body?.get("file")).toMatchObject({ name: "er.pdf" });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 8 });
    xhr.answer(201, { id: 3, status: "in_progress", files: [{ id: 12 }] });
    await expect(promise).resolves.toMatchObject({ id: 3 });
    expect(progress).toEqual([0.5, 1]);
  });

  it("rejects with the server's sentence for the file", async () => {
    const { promise, xhr } = start();
    xhr.answer(422, { title: "One or more validation errors occurred.", errors: { file: ["Old Office files (.doc, .xls, .ppt) are not accepted."] } });
    const error = await promise.then(() => undefined, (reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, kind: "http" });
    expect(draftFailureMessage(error)).toBe("Old Office files (.doc, .xls, .ppt) are not accepted.");
  });

  it("explains a refusal by rule, the upload limit, and an unreachable scanner in the server's words", async () => {
    for (const [status, title] of [[409, "This assignment takes at most 2 files."], [429, "Too many uploads. Wait a minute and try again."], [503, "The virus scan is not available right now, so the file was not saved. Try again in a few minutes."]] as const) {
      const { promise, xhr } = start();
      xhr.answer(status, { title });
      expect(draftFailureMessage(await promise.catch((reason: unknown) => reason))).toBe(title);
    }
  });

  it("maps a lost connection to a network error and a cancel to an AbortError", async () => {
    const lost = start();
    lost.xhr.onerror?.();
    expect(await lost.promise.catch((reason: unknown) => reason)).toMatchObject({ kind: "network", status: 0 });

    const controller = new AbortController();
    const cancelled = start({ signal: controller.signal });
    controller.abort();
    const reason = await cancelled.promise.catch((error: unknown) => error);
    expect(isCancelled(reason)).toBe(true);
    expect(isCancelled(new ApiError({ kind: "network", status: 0, url: "x" }))).toBe(false);
  });
});
