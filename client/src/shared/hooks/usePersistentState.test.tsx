import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePersistentState } from "./usePersistentState";

describe("usePersistentState", () => {
  beforeEach(() => localStorage.clear());

  it("starts from the default and remembers a change", () => {
    const first = renderHook(() => usePersistentState<boolean>("k", false));
    expect(first.result.current[0]).toBe(false);
    act(() => first.result.current[1](true));
    expect(first.result.current[0]).toBe(true);
    const second = renderHook(() => usePersistentState<boolean>("k", false));
    expect(second.result.current[0]).toBe(true);
  });

  it("ignores a stored value of the wrong type or unreadable JSON", () => {
    localStorage.setItem("view", "true");
    expect(renderHook(() => usePersistentState<string>("view", "cards")).result.current[0]).toBe("cards");
    localStorage.setItem("view", "{oops");
    expect(renderHook(() => usePersistentState<string>("view", "cards")).result.current[0]).toBe("cards");
  });
});
