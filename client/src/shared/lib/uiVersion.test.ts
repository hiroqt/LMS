import { describe, expect, it } from "vitest";
import { resolveUiVersion } from "./uiVersion";

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
