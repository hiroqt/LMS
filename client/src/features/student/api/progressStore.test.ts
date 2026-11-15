import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, PROGRESS_KEY, resetProgress, saveAnswer, subscribeProgress } from "./progressStore";

afterEach(() => resetProgress());

describe("progress store", () => {
  it("saves answers under the classic key and shape", () => {
    saveAnswer("math-0", 2, 1);
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}")).toEqual({ answers: { "math-0": { 2: 1 } }, completed: [] });
  });

  it("uses one storage listener however many components subscribe", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const stops = [subscribeProgress(() => {}), subscribeProgress(() => {}), subscribeProgress(() => {})];
    expect(add.mock.calls.filter(([type]) => type === "storage")).toHaveLength(1);
    stops.forEach((stop) => stop());
    expect(remove.mock.calls.filter(([type]) => type === "storage")).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it("picks up changes made in another tab", () => {
    const listener = vi.fn();
    const stop = subscribeProgress(listener);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ answers: {}, completed: ["english-0"] }));
    window.dispatchEvent(new StorageEvent("storage", { key: PROGRESS_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getProgress().completed).toEqual(["english-0"]);
    stop();
  });
});
