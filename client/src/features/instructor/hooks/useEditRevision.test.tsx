import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEditRevision } from "./useEditRevision";

describe("useEditRevision", () => {
  it("clears dirty when the save covered every change", () => {
    const { result } = renderHook(() => useEditRevision());
    act(() => result.current.touch());
    expect(result.current.dirty).toBe(true);
    const settle = result.current.begin();
    let covered = false;
    act(() => {
      covered = settle();
    });
    expect(covered).toBe(true);
    expect(result.current.dirty).toBe(false);
  });

  it("keeps an edit made during the save unsaved", () => {
    const { result } = renderHook(() => useEditRevision(true));
    const settle = result.current.begin();
    act(() => result.current.touch());
    let covered = true;
    act(() => {
      covered = settle();
    });
    expect(covered).toBe(false);
    expect(result.current.dirty).toBe(true);
    // The next save, with nothing changed during it, clears it.
    const next = result.current.begin();
    act(() => void next());
    expect(result.current.dirty).toBe(false);
  });
});
