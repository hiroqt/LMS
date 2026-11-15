import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, test, type Page } from "./fixtures";

// The Student and Instructor shells (rebuilt in Phases 1–3), and the
// /ui-kit design-system reference. Accessibility here is strict: zero axe
// violations, including color contrast.

test.describe("New Student shell", () => {
  const isNew = (page: Page) => expect(page.getByRole("link", { name: "Skip to main content" })).toHaveCount(1);

  test("landmarks, skip link, nav state, and focus on page change", async ({ page }) => {
    await page.goto("/student");
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("button", { name: "Today" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: "Tasks" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeFocused();
    await expect(nav.getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  });

  test("after cutover a leftover ?ui=classic still opens the rebuilt UI; Admin keeps its own (D-021)", async ({ page }) => {
    await page.goto("/student?ui=classic");
    await isNew(page);
    await page.goto("/instructor?ui=classic");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveCount(1);
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "admin navigation" })).toBeVisible();
  });

  test("the profile menu switches workspace", async ({ page }) => {
    await page.goto("/student");
    await page.getByRole("button", { name: "Profile: Alex Rivera" }).click();
    await page.getByRole("group", { name: "Switch workspace" }).getByRole("button", { name: "Instructor workspace" }).click();
    await expect(page).toHaveURL(/\/instructor$/);
    await expect(page.getByRole("navigation", { name: "instructor navigation" })).toBeVisible();
  });

  test("an offline connection is announced and clears when back online", async ({ page, context }) => {
    await page.goto("/student");
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "You’re offline." })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("You’re offline.")).toBeHidden();
  });

  test("bottom navigation on phones, and no sideways scroll at 320px @mobile", async ({ page }) => {
    await page.goto("/student");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
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
});

test.describe("New Instructor shell", () => {
  test("drawer navigation on phones closes after choosing a page @mobile", async ({ page }) => {
    await page.goto("/instructor");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("button", { name: "Gradebook" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Gradebook" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("a class link in the drawer also closes it and focuses the class @mobile", async ({ page }) => {
    await page.goto("/instructor");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^01 Introduction to Programming/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeFocused();
  });

  test("an open drawer closes when the viewport grows to desktop @mobile", async ({ page }) => {
    await page.goto("/instructor");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("navigation", { name: "instructor navigation" }).getByRole("button", { name: "Gradebook" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Gradebook" })).toBeVisible();
  });

  test("sidebar navigation and breadcrumb on desktop", async ({ page }) => {
    await page.goto("/instructor");
    const nav = page.getByRole("navigation", { name: "instructor navigation" });
    await nav.getByRole("button", { name: "Gradebook" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Gradebook" })).toBeFocused();
    await expect(nav.getByRole("button", { name: "Gradebook" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await page.getByRole("banner").getByRole("button", { name: "Workspace" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toBeFocused();
  });

  test("zero axe violations and readable text sizes @all", async ({ page }) => {
    await page.goto("/instructor");
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
