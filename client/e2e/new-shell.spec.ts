import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

// The rebuilt Student and Instructor shells behind ?ui=new (Phase 1), and the
// /ui-kit design-system reference. Accessibility here is strict: zero axe
// violations, including color contrast.

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Every visible text node is ≥14px, except short uppercase eyebrow labels (D-005). */
async function expectReadableText(page: Page) {
  const tooSmall = await page.evaluate(() => {
    const offenders: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest("[aria-hidden=true], .sr-only")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.getClientRects().length === 0) continue;
      const size = Number.parseFloat(style.fontSize);
      const eyebrow = style.textTransform === "uppercase" && size >= 12;
      if (size < 14 && !eyebrow) offenders.push(`${size}px "${text.slice(0, 30)}"`);
    }
    return offenders;
  });
  expect(tooSmall).toEqual([]);
}

test.describe("New Student shell", () => {
  test("landmarks, skip link, nav state, and focus on page change", async ({ page }) => {
    await page.goto("/student?ui=new");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();

    const nav = page.getByRole("navigation", { name: "Student navigation" });
    await expect(nav.getByRole("button", { name: "Today" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: "Tasks" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeFocused();
    await expect(nav.getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  });

  test("the choice is remembered, and Use classic view returns to the current UI", async ({ page }) => {
    await page.goto("/student?ui=new");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await page.goto("/student");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

    await page.getByRole("button", { name: "Profile: Alex Rivera" }).click();
    await page.getByRole("menuitem", { name: "Use classic view" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
    await expect(page).toHaveURL(/\/student$/);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
  });

  test("switching workspace keeps the new UI; Admin always stays classic", async ({ page }) => {
    await page.goto("/student?ui=new");
    await page.getByRole("button", { name: "Profile: Alex Rivera" }).click();
    await page.getByRole("menuitem", { name: "Instructor workspace" }).click();
    await expect(page).toHaveURL(/\/instructor$/);
    await expect(page.getByRole("navigation", { name: "Instructor navigation" })).toBeVisible();

    await page.goto("/admin?ui=new");
    await expect(page.getByRole("navigation", { name: "admin navigation" })).toBeVisible();
  });

  test("an offline connection is announced and clears when back online", async ({ page, context }) => {
    await page.goto("/student?ui=new");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "You’re offline." })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("You’re offline.")).toBeHidden();
  });

  test("bottom navigation on phones, and no sideways scroll at 320px @mobile", async ({ page }) => {
    await page.goto("/student?ui=new");
    const nav = page.getByRole("navigation", { name: "Student navigation" });
    await expect(nav).toHaveCount(1); // the sidebar copy is hidden on phones
    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y + box.height).toBeGreaterThan((viewport?.height ?? 0) - 120);

    await nav.getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Academic calendar" })).toBeFocused();

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("zero axe violations and readable text sizes @all", async ({ page }) => {
    await page.goto("/student?ui=new");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
  });
});

test.describe("New Instructor shell", () => {
  test("drawer navigation on phones closes after choosing a page @mobile", async ({ page }) => {
    await page.goto("/instructor?ui=new");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("button", { name: "Gradebook" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Gradebook" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("sidebar navigation on desktop", async ({ page }) => {
    await page.goto("/instructor?ui=new");
    const nav = page.getByRole("navigation", { name: "Instructor navigation" });
    await nav.getByRole("button", { name: "My classes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "My classes" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });

  test("zero axe violations and readable text sizes @all", async ({ page }) => {
    await page.goto("/instructor?ui=new");
    await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
  });
});

test.describe("Design system reference (/ui-kit)", () => {
  test("zero axe violations, 44px controls, readable text @all", async ({ page }) => {
    await page.goto("/ui-kit");
    await expect(page.getByRole("heading", { level: 1, name: "TMCC design system" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);

    // Utilities must beat legacy element rules such as button { min-height: 24px } (D-010).
    for (const name of ["Save and publish", "Notifications", "Cancel"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box?.height, name).toBeGreaterThanOrEqual(44);
    }
    const inputSize = await page.getByRole("textbox", { name: /Section/ }).evaluate((el) => getComputedStyle(el).fontSize);
    expect(inputSize).toBe("16px");
  });

  test("dialog traps focus, closes on Escape, and returns focus", async ({ page }) => {
    await page.goto("/ui-kit");
    const trigger = page.getByRole("button", { name: "Submit assessment" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Submit this assessment?" });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("toasts are announced and can be dismissed", async ({ page }) => {
    await page.goto("/ui-kit");
    await page.getByRole("button", { name: "Show success toast" }).click();
    const toast = page.getByRole("status").filter({ hasText: "Grade saved" });
    await expect(toast).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Grade saved")).toBeHidden();
  });
});
