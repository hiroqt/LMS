import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("drops falsy values and merges conflicting utilities", () => {
    const hidden = false;
    expect(cn("px-2", hidden && "hidden", "px-4")).toBe("px-4");
  });

  it("keeps a custom font size and a text color together", () => {
    expect(cn("text-body", "text-primary-700")).toBe("text-body text-primary-700");
  });

  it("lets a later custom font size win", () => {
    expect(cn("text-body", "text-section")).toBe("text-section");
  });
});
