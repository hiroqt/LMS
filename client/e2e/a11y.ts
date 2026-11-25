import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "./fixtures";

/** Strict accessibility checks for rebuilt screens (D-012). */
const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

export async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Every visible text node is ≥14px, except short uppercase eyebrow labels (D-005). */
export async function expectReadableText(page: Page) {
  const tooSmall = await page.evaluate(() => {
    const offenders: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest("[aria-hidden=true], .sr-only")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.getClientRects().length === 0) continue;
      // Transparent text is not seen, e.g. the text pdf.js lays over a drawn page so it can be read aloud (D-067).
      if (style.color === "transparent" || /^rgba\(.*,\s*0\)$/.test(style.color)) continue;
      const size = Number.parseFloat(style.fontSize);
      const eyebrow = style.textTransform === "uppercase" && size >= 12;
      if (size < 14 && !eyebrow) offenders.push(`${size}px "${text.slice(0, 30)}"`);
    }
    return offenders;
  });
  expect(tooSmall).toEqual([]);
}
