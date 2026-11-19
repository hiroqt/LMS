import { describe, expect, it } from "vitest";
import { nextUpload, pendingCount, uploadQueue, type QueuedUpload } from "./uploadQueue";

const file = (name: string) => new File(["x"], name);

function queueOf(...names: string[]): QueuedUpload[] {
  return uploadQueue([], { type: "add", uploads: names.map((name) => ({ key: name, file: file(name) })) });
}

describe("upload queue", () => {
  it("lists chosen files as waiting, and a file refused before upload as failed without Retry", () => {
    const queue = uploadQueue(queueOf("a.pdf"), { type: "add", uploads: [{ key: "b.zip", file: file("b.zip"), refusal: "This assignment takes only: PDF." }] });
    expect(queue.map((item) => [item.key, item.status, item.error, item.retryable])).toEqual([
      ["a.pdf", "waiting", undefined, undefined],
      ["b.zip", "failed", "This assignment takes only: PDF.", false],
    ]);
    expect(pendingCount(queue)).toBe(1);
  });

  it("sends one file at a time, in the order chosen", () => {
    let queue = queueOf("a.pdf", "b.pdf");
    expect(nextUpload(queue)?.key).toBe("a.pdf");
    queue = uploadQueue(queue, { type: "start", key: "a.pdf" });
    expect(nextUpload(queue)).toBeUndefined();
    queue = uploadQueue(queue, { type: "done", key: "a.pdf" });
    expect(nextUpload(queue)?.key).toBe("b.pdf");
  });

  it("tracks progress only while uploading, and never backwards", () => {
    let queue = uploadQueue(queueOf("a.pdf"), { type: "progress", key: "a.pdf", fraction: 0.5 });
    expect(queue[0]?.progress).toBe(0);
    queue = uploadQueue(uploadQueue(queue, { type: "start", key: "a.pdf" }), { type: "progress", key: "a.pdf", fraction: 0.6 });
    queue = uploadQueue(queue, { type: "progress", key: "a.pdf", fraction: 0.4 });
    expect(queue[0]?.progress).toBe(0.6);
  });

  it("keeps a failed file with its reason until Retry or Remove", () => {
    let queue = uploadQueue(uploadQueue(queueOf("a.pdf"), { type: "start", key: "a.pdf" }), { type: "fail", key: "a.pdf", error: "The upload did not finish.", retryable: true });
    expect(queue[0]).toMatchObject({ status: "failed", error: "The upload did not finish.", retryable: true, progress: 0 });
    expect(nextUpload(queue)).toBeUndefined();
    queue = uploadQueue(queue, { type: "retry", key: "a.pdf" });
    expect(queue[0]).toMatchObject({ status: "waiting", error: undefined });
    expect(uploadQueue(queue, { type: "remove", key: "a.pdf" })).toEqual([]);
  });
});
