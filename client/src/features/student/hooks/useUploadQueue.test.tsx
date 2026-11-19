import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UploadOptions } from "../../../shared/api/assignments";
import type { Submission } from "../../../shared/api/overview";
import { useUploadQueue } from "./useUploadQueue";

const draft = { id: 1, files: [] } as unknown as Submission;
const file = (name: string) => new File(["x"], name);

/** An upload the test finishes by hand. */
function controlledUpload() {
  const calls: Array<{ file: File; options: UploadOptions; resolve: (row: Submission) => void; reject: (error: unknown) => void }> = [];
  const upload = vi.fn((chosen: File, options: UploadOptions) => new Promise<Submission>((resolve, reject) => {
    calls.push({ file: chosen, options, resolve, reject });
    options.signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
  }));
  return { upload, calls };
}

describe("useUploadQueue", () => {
  it("uploads one file at a time and lists only the files not stored yet", async () => {
    const { upload, calls } = controlledUpload();
    const onStored = vi.fn();
    const { result } = renderHook(() => useUploadQueue({ upload, onStored, describe: () => ({ message: "", retryable: true }) }, false));
    act(() => result.current.add([{ file: file("a.pdf"), refusal: null }, { file: file("b.pdf"), refusal: null }]));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(result.current.queue.map((item) => item.status)).toEqual(["uploading", "waiting"]);
    act(() => calls[0]!.options.onProgress?.(0.5));
    expect(result.current.queue[0]?.progress).toBe(0.5);
    await act(async () => calls[0]!.resolve(draft));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(calls[1]!.file.name).toBe("b.pdf");
    expect(onStored).toHaveBeenCalledWith(draft, calls[0]!.file);
    expect(result.current.queue.map((item) => item.file.name)).toEqual(["b.pdf"]);
  });

  it("drops a cancelled file, keeps a failed one with its sentence, and waits while paused", async () => {
    const { upload, calls } = controlledUpload();
    const onFailed = vi.fn();
    const { result, rerender } = renderHook(({ paused }) => useUploadQueue({ upload, onStored: () => {}, onFailed, describe: () => ({ message: "This assignment takes at most 2 files.", retryable: true }) }, paused), { initialProps: { paused: true } });
    act(() => result.current.add([{ file: file("a.pdf"), refusal: null }, { file: file("b.pdf"), refusal: null }]));
    expect(upload).not.toHaveBeenCalled();
    rerender({ paused: false });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    act(() => result.current.cancel(result.current.queue[0]!.key));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(result.current.queue.map((item) => item.file.name)).toEqual(["b.pdf"]);
    await act(async () => calls[1]!.reject(new Error("refused")));
    expect(result.current.queue[0]).toMatchObject({ status: "failed", error: "This assignment takes at most 2 files.", retryable: true });
    expect(onFailed).toHaveBeenCalledWith(calls[1]!.file, "This assignment takes at most 2 files.");
  });

  it("cancels a file that is still waiting its turn, or waiting for a connection, by taking it off the list", async () => {
    const { upload, calls } = controlledUpload();
    const onCancelled = vi.fn();
    const { result, rerender } = renderHook(({ paused }) => useUploadQueue({ upload, onStored: () => {}, onCancelled, describe: () => ({ message: "", retryable: true }) }, paused), { initialProps: { paused: false } });
    act(() => result.current.add([{ file: file("a.pdf"), refusal: null }, { file: file("b.pdf"), refusal: null }, { file: file("c.pdf"), refusal: null }]));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    // b.pdf has not started: Cancel removes it, and it is never sent.
    act(() => result.current.cancel(result.current.queue[1]!.key));
    expect(result.current.queue.map((item) => item.file.name)).toEqual(["a.pdf", "c.pdf"]);
    expect(onCancelled).not.toHaveBeenCalled();
    await act(async () => calls[0]!.resolve(draft));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(calls[1]!.file.name).toBe("c.pdf");

    // Cancelling the one that is uploading tells the caller, whose draft may already hold the file.
    act(() => result.current.cancel(result.current.queue[0]!.key));
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(calls[1]!.file));
    expect(result.current.queue).toEqual([]);

    // Offline: nothing starts, and Cancel still works.
    rerender({ paused: true });
    act(() => result.current.add([{ file: file("d.pdf"), refusal: null }]));
    act(() => result.current.cancel(result.current.queue[0]!.key));
    expect(result.current.queue).toEqual([]);
    expect(upload).toHaveBeenCalledTimes(2);
  });
});
