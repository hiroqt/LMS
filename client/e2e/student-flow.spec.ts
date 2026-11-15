import { expect, openRole, test } from "./fixtures";

// Journeys from docs/STUDENT_USER_FLOW.md. Node names in comments match the chart.

const QUIZ = /Quiz 02: Relational Data and Keys/;

test.describe("Student · Today dashboard", () => {
  // D-023: News & Announcements is its own destination instead of a dashboard toggle.
  test("B → N: the dashboard leads to News & Announcements", async ({ page }) => {
    await openRole(page, "student");
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: "News & Announcements" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "News & Announcements" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teacher announcements" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "School announcements" })).toBeVisible();
  });

  test("C → CAL → CAL1: academic calendar opens from the top bar and browses months", async ({ page }) => {
    await openRole(page, "student");
    // Today also has an h2 "Academic calendar" panel, so assert the page's h1.
    await expect(page.getByRole("heading", { level: 1, name: "Academic calendar" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("button", { name: "Academic calendar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Academic calendar" })).toBeVisible();

    await expect(page.getByRole("heading", { level: 2, name: "October 2026" })).toBeVisible();
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "November 2026" })).toBeVisible();
  });

  test("C → S: search finds a class and opens it", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("textbox", { name: "Search student workspace" }).fill("Computer Networking");
    await page.getByRole("banner").getByRole("button", { name: "Class Computer Networking" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Computer Networking" })).toBeVisible();
  });
});

test.describe("Student · Tasks and assessments", () => {
  test("T → AD → Q → CONF → R: take a quiz from Tasks, submit, and review the result", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Tasks" }).click();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();

    await page.getByRole("button", { name: QUIZ }).click();
    await expect(page.getByRole("heading", { level: 1, name: QUIZ })).toBeVisible();
    await page.getByRole("button", { name: "Start assessment" }).click();

    // Q1: answer, then move on with the question navigator.
    const answers = page.getByRole("radiogroup", { name: "Choose an answer" });
    await answers.getByRole("radio").first().click();
    await expect(answers.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: /Next question/ }).click();
    await expect(page.getByRole("button", { name: "Go to question 2" })).toHaveAttribute("aria-current", "step");

    // CONF: "Keep working" returns to the quiz; "Submit now" finishes it.
    await page.getByRole("button", { name: "Submit assessment" }).click();
    const dialog = page.getByRole("dialog", { name: "Submit this assessment?" });
    await expect(dialog).toContainText("You answered 1 of 5 questions");
    await dialog.getByRole("button", { name: "Keep working" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await dialog.getByRole("button", { name: /Submit now/ }).click();

    // R: result and answer review.
    await expect(page.getByText("ASSESSMENT SUBMITTED")).toBeVisible();
    await expect(page.getByText("Answer review")).toBeVisible();
    await expect(page.getByRole("button", { name: /Practice again/ })).toBeVisible();

    // Completion persists across a fresh page load, and TD (the "Assessments
    // done" summary) opens Tasks with Done selected, listing the submitted quiz.
    // A fresh load of /student (not reload()): the rebuilt UI keeps the result
    // page's own URL on reload, the classic UI returns to Today (D-013).
    await page.goto("/student");
    await page.getByRole("button", { name: /^1 Assessments done/ }).click();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Done", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: QUIZ })).toBeVisible();
  });

  test("Q1 → Q2: a question advances automatically when its 60-second timer expires", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Tasks" }).click();
    await page.getByRole("button", { name: QUIZ }).click();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(page.getByRole("button", { name: "Go to question 1" })).toHaveAttribute("aria-current", "step");

    await page.clock.runFor(61_000);
    await expect(page.getByRole("button", { name: "Go to question 2" })).toHaveAttribute("aria-current", "step");
  });

  test("Q → AD: exiting an assessment returns to its details", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Tasks" }).click();
    await page.getByRole("button", { name: QUIZ }).click();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await page.getByRole("button", { name: "Exit assessment" }).click();
    await expect(page.getByRole("button", { name: "Exit assessment" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Start assessment" })).toBeVisible();
  });
});

test.describe("Student · Class workspace", () => {
  test("CL → CL2: class opens on Stream and every tab is reachable", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "My classes" }).getByRole("button", { name: /Introduction to Programming/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();

    const tabs = page.getByRole("tablist");
    await expect(tabs.getByRole("tab", { name: "Stream" })).toHaveAttribute("aria-selected", "true");
    for (const name of [/^Classwork/, /^Materials/, /^People/]) {
      await tabs.getByRole("tab", { name }).click();
      await expect(tabs.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    }
  });

  test("STREAM → MD → MAT: open a material from Stream, mark it reviewed, go back", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "My classes" }).getByRole("button", { name: /Introduction to Programming/ }).click();
    await page.getByRole("button", { name: "Open material" }).first().click();

    await page.getByRole("button", { name: /Mark as reviewed/ }).click();
    await expect(page.getByRole("button", { name: /Reviewed/ })).toBeVisible();
    await page.getByRole("button", { name: /Back/ }).first().click();
    await expect(page.getByRole("tablist")).toBeVisible();
  });
});

test.describe("Student · Mobile @mobile", () => {
  test("Today loads and the class workspace is reachable on a phone", async ({ page }) => {
    await openRole(page, "student");
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
    // On a phone the sidebar is an off-canvas drawer; use the dashboard class card.
    await page.getByRole("main").getByRole("button", { name: /^Introduction to Programming/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    // No horizontal page scroll at phone width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
