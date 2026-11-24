// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards WCAG 2.2 AA contrast for the design tokens. Reads the real token
 * file, so changing a color in tailwind.css re-runs these checks.
 */
const css = readFileSync(fileURLToPath(new URL("./tailwind.css", import.meta.url)), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match?.[1]) throw new Error(`Missing color token --color-${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5; // WCAG 1.4.3 normal text
const NON_TEXT = 3; // WCAG 1.4.11 UI components and focus indicators

describe("design token contrast (WCAG 2.2 AA)", () => {
  // primary-600 (brand green) is 4.47:1 on canvas, so green *text* uses
  // primary-700+. primary-600 stays the fill color for buttons and badges.
  const textTokens = ["ink", "muted", "primary-700", "primary-800", "accent-700", "success", "warning", "danger", "info"];

  it.each(textTokens.flatMap((fg) => ["surface", "canvas"].map((bg) => [fg, bg])))("%s text on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(["primary-600", "primary-700", "danger"])("white text on %s buttons ≥ 4.5:1", (bg) => {
    expect(contrast("#ffffff", token(bg))).toBeGreaterThanOrEqual(TEXT);
  });

  it.each([
    ["success", "success-soft"],
    ["warning", "warning-soft"],
    ["danger", "danger-soft"],
    ["info", "info-soft"],
    ["primary-700", "primary-100"],
  ])("%s text on %s badges ≥ 4.5:1", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(TEXT);
  });

  // The dashboard's filled tile (FocusTile, D-066): its secondary text, the due chip,
  // and a white focus ring, because the page's dark green ring vanishes on the fill (L-099).
  it("primary-100 text on the primary-700 tile ≥ 4.5:1", () => {
    expect(contrast(token("primary-100"), token("primary-700"))).toBeGreaterThanOrEqual(TEXT);
  });
  it("white text on the primary-800 due chip ≥ 4.5:1", () => {
    expect(contrast("#ffffff", token("primary-800"))).toBeGreaterThanOrEqual(TEXT);
  });
  it("the focus ring on the primary-700 tile is white: the page ring would be invisible there", () => {
    expect(contrast("#ffffff", token("primary-700"))).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(token("focus"), token("primary-700"))).toBeLessThan(NON_TEXT);
  });

  it.each(["surface", "canvas"])("focus ring on %s ≥ 3:1", (bg) => {
    expect(contrast(token("focus"), token(bg))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("brand green fails as text on canvas, which is why green text uses primary-700", () => {
    expect(contrast(token("primary-600"), token("canvas"))).toBeLessThan(TEXT);
  });

  it("the legacy muted gray fails AA, which is why the token was darkened", () => {
    expect(contrast("#7d8985", token("surface"))).toBeLessThan(TEXT);
  });

  it("body text never goes below 14px: text-xs is removed", () => {
    expect(css).toMatch(/--text-xs:\s*initial;/);
    expect(css).toMatch(/--text-body:\s*0\.875rem;/);
  });
});
