import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerInput } from "../../../shared/components/quiz/types";
import { createAutosaver, retryDelayMs, type SaveStatus } from "./autosave";

const typed = (questionId: number, text: string): AnswerInput => ({ questionId, text });

function setup(save: (answers: AnswerInput[]) => Promise<unknown> = () => Promise.resolve(), shouldRetry?: (error: unknown) => boolean) {
  const statuses: SaveStatus[] = [];
  const spy = vi.fn(save);
  const onFailure = vi.fn();
  const autosaver = createAutosaver({ save: spy, onStatus: (status) => statuses.push(status), onFailure, shouldRetry });
  return { autosaver, save: spy, statuses, onFailure };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("autosave", () => {
  it("saves typed answers once, about a second after the last keystroke, with the latest text", async () => {
    const { autosaver, save, statuses } = setup();
    autosaver.change(typed(1, "B"), false);
    await vi.advanceTimersByTimeAsync(600);
    autosaver.change(typed(1, "Bab"), false);
    await vi.advanceTimersByTimeAsync(600);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([typed(1, "Bab")]);
    expect(statuses).toEqual(["saving", "saved"]);
    expect(autosaver.hasUnsaved()).toBe(false);
  });

  it("saves a choice at once, together with typing still waiting", async () => {
    const { autosaver, save } = setup();
    autosaver.change(typed(1, "Babbage"), false);
    autosaver.change({ questionId: 2, optionId: 7 }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledWith([typed(1, "Babbage"), { questionId: 2, optionId: 7 }]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush saves waiting typing now (Previous, Next), and does nothing when all is saved", async () => {
    const { autosaver, save } = setup();
    autosaver.change(typed(1, "Babbage"), false);
    await expect(autosaver.flush()).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    await expect(autosaver.flush()).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("never runs two saves at once", async () => {
    let release: () => void = () => {};
    const { autosaver, save } = setup(() => new Promise<void>((resolve) => (release = resolve)));
    autosaver.change({ questionId: 1, optionId: 1 }, true);
    await vi.advanceTimersByTimeAsync(0);
    autosaver.change({ questionId: 1, optionId: 2 }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith([{ questionId: 1, optionId: 2 }]);
  });

  it("retries a failed save with a growing wait, keeping newer text, until it succeeds", async () => {
    let fail = 2;
    const { autosaver, save, statuses } = setup(() => (fail-- > 0 ? Promise.reject(new Error("offline")) : Promise.resolve()));
    autosaver.change(typed(1, "Bab"), false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses.at(-1)).toBe("retrying");
    autosaver.change(typed(1, "Babbage"), false);
    await vi.advanceTimersByTimeAsync(retryDelayMs(1));
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe("retrying");
    await vi.advanceTimersByTimeAsync(retryDelayMs(2) - 1);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith([typed(1, "Babbage")]);
    expect(statuses.at(-1)).toBe("saved");
    expect(retryDelayMs(10)).toBe(15_000);
  });

  it("stops retrying when a retry cannot help, and reports it", async () => {
    const refused = new Error("Time is up");
    const { autosaver, save, statuses, onFailure } = setup(() => Promise.reject(refused), () => false);
    autosaver.change({ questionId: 1, optionId: 1 }, true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe("failed");
    expect(onFailure).toHaveBeenCalledWith(refused);
    expect(autosaver.hasUnsaved()).toBe(true);
  });

  it("stop waits for a save in flight and pauses; resume saves what is left", async () => {
    let release: () => void = () => {};
    const { autosaver, save } = setup(() => new Promise<void>((resolve) => (release = resolve)));
    autosaver.change({ questionId: 1, optionId: 1 }, true);
    await vi.advanceTimersByTimeAsync(0);
    let stopped = false;
    void autosaver.stop().then(() => (stopped = true));
    autosaver.change(typed(2, "late"), false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(stopped).toBe(false);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    autosaver.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith([typed(2, "late")]);
  });
});
