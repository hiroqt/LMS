import { afterEach, describe, expect, it } from "vitest";
import { LEGACY_UI_VERSION_KEY, readStoredUiVersion, resolveUiVersion, storeUiVersion } from "./uiVersion";

afterEach(() => localStorage.clear());

describe("resolveUiVersion", () => {
  it("defaults to classic until cutover", () => {
    expect(resolveUiVersion("", null)).toEqual({ version: "classic", fromUrl: false });
  });

  it("uses the remembered choice", () => {
    expect(resolveUiVersion("", "new")).toEqual({ version: "new", fromUrl: false });
  });

  it("lets the URL override and ignores unknown values", () => {
    expect(resolveUiVersion("?ui=NEW", "classic")).toEqual({ version: "new", fromUrl: true });
    expect(resolveUiVersion("?ui=beta", "new")).toEqual({ version: "new", fromUrl: false });
    expect(resolveUiVersion("?role=student&ui=classic", "new")).toEqual({ version: "classic", fromUrl: true });
  });
});

describe("per-role storage", () => {
  it("keeps Student and Instructor choices separate", () => {
    storeUiVersion("student", "new");
    expect(readStoredUiVersion("student")).toBe("new");
    expect(readStoredUiVersion("instructor")).toBeNull();
  });

  it("falls back to the Phase 1 single choice", () => {
    localStorage.setItem(LEGACY_UI_VERSION_KEY, "new");
    expect(readStoredUiVersion("instructor")).toBe("new");
    storeUiVersion("instructor", "classic");
    expect(readStoredUiVersion("instructor")).toBe("classic");
  });
});
