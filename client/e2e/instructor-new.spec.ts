import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, test, type Page, seedHandedInAssignment } from "./fixtures";

// The rebuilt Instructor UI (Phase 3): strict accessibility on every screen and
// tab, a 320px sweep, and behavior new in the rebuild. Flow parity itself is
// proven by the unchanged flow specs in the instructor-new / both-new projects.

const CLASS = "/instructor/classes/biology";
const TABS = ["", "?tab=Classwork", "?tab=Announcements", "?tab=Materials", "?tab=People", "?tab=Attendance", "?tab=Submissions", "?tab=Create+content"];

async function useNewInstructorUi(page: Page) {
  await page.goto("/instructor");
  await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toBeVisible();
}

async function check(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
}

const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });

test.describe("Rebuilt Instructor screens: zero axe violations, text ≥14px", () => {
  test("Overview, News, Classes, and Gradebook @all", async ({ page }) => {
  test.slow(); // many page loads, each with a full axe scan (L-030)
    await useNewInstructorUi(page);
    await check(page);
    await page.getByRole("button", { name: "News & announcements" }).click();
    await expect(page.getByRole("heading", { name: "Teacher announcements" })).toBeVisible();
    await check(page);
    for (const path of ["/instructor/classes", "/instructor/gradebook"]) {
      await page.goto(path);
      await check(page);
    }
  });

  test("every class tab, the three content forms, and the dialogs @all", async ({ page }) => {
  test.slow(); // many page loads, each with a full axe scan (L-030)
    await useNewInstructorUi(page);
    for (const query of TABS) {
      await page.goto(`${CLASS}${query}`);
      await check(page);
    }
    for (const type of ["material", "activity", "exam"]) {
      await page.goto(`${CLASS}?tab=Create+content&create=${type}`);
      await check(page);
    }
    await page.goto(`${CLASS}?tab=Materials`);
    await page.getByRole("button", { name: /^Delete / }).first().click();
    await expect(page.getByRole("dialog", { name: "Delete this material?" })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
  });
});

test("no rebuilt Instructor page scrolls sideways at 320px @mobile", async ({ page }) => {
  test.slow(); // many page loads, each with a full axe scan (L-030)
  await useNewInstructorUi(page);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/instructor", "/instructor/classes", "/instructor/gradebook", ...TABS.map((query) => `${CLASS}${query}`), `${CLASS}?tab=Create+content&create=exam`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test.describe("Rebuilt Instructor behavior", () => {
  test("tabs and the class live in the URL: deep links, Back, and Forward work", async ({ page }) => {
    await useNewInstructorUi(page);
    await page.goto(`${CLASS}?tab=People`);
    await expect(tab(page, /^People/)).toHaveAttribute("aria-selected", "true");
    await page.goto("/instructor/gradebook");
    await page.goBack();
    await expect(tab(page, /^People/)).toHaveAttribute("aria-selected", "true");
  });

  test("deleting a material asks first; Keep material cancels", async ({ page }) => {
    await useNewInstructorUi(page);
    await page.goto(`${CLASS}?tab=Materials`);
    await expect(tab(page, /^Materials\s?3/)).toBeVisible();
    await page.getByRole("button", { name: "Delete Programming Logic and Pseudocode" }).click();
    await page.getByRole("button", { name: "Keep material" }).click();
    await expect(tab(page, /^Materials\s?3/)).toBeVisible();
    await page.getByRole("button", { name: "Delete Programming Logic and Pseudocode" }).click();
    await page.getByRole("button", { name: "Delete material" }).click();
    await expect(tab(page, /^Materials\s?2/)).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Material deleted" })).toBeVisible();
  });

  test("forms explain what is missing instead of failing silently", async ({ page }) => {
    await useNewInstructorUi(page);
    // D-040: the old ?create=exam link opens the assessment builder.
    await page.goto(`${CLASS}?tab=Create+content&create=exam`);
    await expect(page.getByRole("heading", { level: 1, name: "New assessment" })).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Enter a title.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Assessment title/ })).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Quiz");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Add at least one question before publishing.")).toBeVisible();

    await page.goto(`${CLASS}?tab=Announcements`);
    await page.getByRole("button", { name: "New announcement" }).click();
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByText("Enter a message for your students.")).toBeVisible();
    await page.getByRole("textbox", { name: /^Title/ }).fill("Hello");
    await expect(page.getByText("5 / 120 characters")).toBeVisible();
  });

  // D-032: review links carry the submission's id; a handed-in assignment waits for a grade.
  test("a review link opens the submission ready to grade and keeps the score in range", async ({ page, sandbox }) => {
    const { submissionId, title } = await seedHandedInAssignment(page, sandbox);
    await useNewInstructorUi(page);
    await page.goto(`${CLASS}?tab=Submissions&review=${submissionId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("loops.pdf")).toBeVisible();
    await page.getByRole("spinbutton", { name: /Score/ }).fill("11");
    await page.getByRole("button", { name: "Save grade" }).click();
    await expect(page.getByText("Enter a score from 0 to 10.")).toBeVisible();
    await page.getByRole("spinbutton", { name: /Score/ }).fill("10");
    await page.getByRole("button", { name: "Save grade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Grade saved" })).toBeVisible();
    await expect(tab(page, /^Submissions\s?0/)).toBeVisible();
  });

  test("gradebook warns when weights do not add up to 100%", async ({ page }) => {
    await useNewInstructorUi(page);
    await page.goto("/instructor/gradebook");
    await expect(page.getByText(/add up to/)).toHaveCount(0);
    await page.getByRole("spinbutton", { name: "Activity weight" }).fill("50");
    await expect(page.getByText("Activity and exam weights add up to 110%.", { exact: false })).toBeVisible();
  });
});
