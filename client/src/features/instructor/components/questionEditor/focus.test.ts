import { afterEach, describe, expect, it } from "vitest";
import { shouldTakeFocus } from "./focus";

describe("shouldTakeFocus", () => {
  afterEach(() => document.body.replaceChildren());

  it("takes focus when nothing holds it, or the closing menu does", () => {
    expect(shouldTakeFocus(null)).toBe(true);
    expect(shouldTakeFocus(document.body)).toBe(true);
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("div");
    menu.append(item);
    document.body.append(menu);
    expect(shouldTakeFocus(item)).toBe(true);
  });

  it("leaves focus alone once the person moved to another field", () => {
    const field = document.createElement("input");
    document.body.append(field);
    expect(shouldTakeFocus(field)).toBe(false);
  });
});
