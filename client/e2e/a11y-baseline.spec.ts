import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * Accessibility baseline (WCAG 2.2 A/AA rules) for the screens being rebuilt.
 *
 * Phase 0 records today's violations without failing, so later phases can
 * prove improvement. From Phase 1, rebuilt screens move into a strict list
 * that must report zero violations. Run with --reporter=list to see counts.
 */
const screens = [
  { name: "student-today", path: "/student" },
  { name: "instructor-overview", path: "/instructor" },
] as const;

for (const screen of screens) {
  test(`a11y baseline: ${screen.name}`, async ({ page }, testInfo) => {
    await page.goto(screen.path);
    await expect(page.getByRole("main")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    await testInfo.attach(`${screen.name}-axe.json`, { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
    console.log(`[a11y] ${screen.name}: ${summary.map((v) => `${v.id}(${v.impact}) x${v.nodes}`).join(", ") || "no violations"}`);
  });
}
