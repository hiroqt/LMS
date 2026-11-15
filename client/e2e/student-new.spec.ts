import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, test, type Page } from "./fixtures";

// The rebuilt Student UI (Phase 2): strict accessibility on every screen, and
// behavior that is new in the rebuild (URLs, keyboard, phone search, D-015).
// Flow parity itself is proven by the unchanged flow specs in the
// "student-new" Playwright projects.

const QUIZ = /Quiz 02: Relational Data and Keys/;

async function useNewStudentUi(page: Page) {
  await page.goto("/student?ui=new");
  await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
}

async function check(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
}

test.describe("Rebuilt Student screens: zero axe violations, text ≥14px", () => {
  test("Today (Overview and News), Tasks, Calendar, Classes @all", async ({ page }) => {
    await useNewStudentUi(page);
    await check(page);
    await page.getByRole("button", { name: "News & announcements" }).click();
    await expect(page.getByRole("heading", { name: "Teacher announcements" })).toBeVisible();
    await check(page);
    for (const path of ["/student/tasks", "/student/tasks?status=Missing", "/student/calendar", "/student/classes"]) {
      await page.goto(path);
      await check(page);
    }
  });

  test("a class on every tab, and a material @all", async ({ page }) => {
    await useNewStudentUi(page);
    for (const tab of ["", "?tab=Classwork", "?tab=Materials", "?tab=People"]) {
      await page.goto(`/student/classes/biology${tab}`);
      await check(page);
    }
    await page.goto("/student/materials/biology-material-0");
    await check(page);
  });

  test("assessment details, the quiz with its dialog, and the result @all", async ({ page }) => {
    await useNewStudentUi(page);
    await page.goto("/student/assessments/math-0");
    await check(page);
    await page.getByRole("button", { name: "Start assessment" }).click();
    await check(page);
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByRole("dialog", { name: "Submit this assessment?" })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: /Submit now/ }).click();
    await check(page);
  });
});

test("no rebuilt Student page scrolls sideways at 320px @mobile", async ({ page }) => {
  await useNewStudentUi(page);
  await page.setViewportSize({ width: 320, height: 640 });
  const pages = [
    "/student", "/student/tasks", "/student/calendar", "/student/classes", "/student/classes/biology?tab=Classwork",
    "/student/classes/biology?tab=People", "/student/materials/biology-material-0", "/student/assessments/math-0", "/student/assessments/math-0/quiz",
  ];
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test.describe("Rebuilt Student behavior", () => {
  test("every screen has a URL: deep links, Back, and Forward work", async ({ page }) => {
    await useNewStudentUi(page);
    await page.goto("/student/tasks?status=Missing");
    await expect(page.getByRole("button", { name: /^Missing/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("main").getByRole("button", { name: /Quiz 03: Variables and Data Types/ }).click();
    await expect(page).toHaveURL(/\/student\/assessments\/biology-0$/);
    await page.goBack();
    await expect(page.getByRole("button", { name: /^Missing/ })).toHaveAttribute("aria-pressed", "true");
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: /Quiz 03/ })).toBeVisible();

    await page.goto("/student/classes/math?tab=People");
    await expect(page.getByRole("tab", { name: "People" })).toHaveAttribute("aria-selected", "true");
  });

  test("number keys pick answers, and Previous/Next keep each question's own timer", async ({ page }) => {
    await useNewStudentUi(page);
    await page.goto("/student/assessments/math-0/quiz");
    const radios = page.getByRole("radiogroup", { name: "Choose an answer" }).getByRole("radio");
    await expect(radios.first()).toBeVisible();
    await page.keyboard.press("2");
    await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");

    await page.clock.runFor(20_000); // Q1 at 0:40
    await page.getByRole("button", { name: "Next question" }).click();
    await expect(page.getByText("01:00")).toBeVisible(); // Q2 starts fresh
    await page.getByRole("button", { name: "Go to question 1" }).click();
    await expect(page.getByText("00:40")).toBeVisible(); // Q1 kept its time
  });

  test("the last question's timeout submits and shows the result", async ({ page }) => {
    await useNewStudentUi(page);
    await page.goto("/student/assessments/math-0/quiz");
    await page.getByRole("button", { name: "Go to question 5" }).click();
    await page.clock.runFor(61_000);
    await expect(page.getByText("Assessment submitted")).toBeVisible();
    await expect(page).toHaveURL(/\/result$/);
  });

  test("an instructor's exam grade and feedback appear on the Student exam page (D-015)", async ({ page }) => {
    const exam = /Long Quiz 01: Control Flow and Functions/;
    await useNewStudentUi(page);
    await page.goto("/student/assessments/biology-1/quiz");
    await page.getByRole("radiogroup", { name: "Choose an answer" }).getByRole("radio").first().click();
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await page.getByRole("button", { name: /Submit now/ }).click();
    await expect(page.getByText("Assessment submitted")).toBeVisible();

    // Grade it in the classic Instructor UI.
    await page.goto("/instructor");
    await page.getByRole("complementary").getByRole("button", { name: /^01 Introduction to Programming/ }).click();
    await page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name: /^Submissions/ }).click();
    await page.getByRole("main").getByRole("button", { name: exam }).first().click();
    await page.getByRole("main").getByRole("spinbutton").first().fill("32");
    await page.getByPlaceholder("Optional feedback").fill("Strong loops; revisit recursion.");
    await page.getByRole("button", { name: "Save grade" }).click();
    await expect(page.getByRole("tab", { name: /^Submissions0/ })).toBeVisible();

    await page.goto("/student/assessments/biology-1");
    const graded = page.getByRole("region", { name: "Graded by your instructor" });
    await expect(graded).toContainText("32 / 40 points");
    await expect(graded).toContainText("Strong loops; revisit recursion.");
    await page.getByRole("button", { name: "View your result" }).click();
    await expect(page.getByRole("region", { name: "Instructor feedback" })).toContainText("32 / 40 points");
  });

  test("an assignment submitted in the rebuilt UI reaches the classic instructor queue", async ({ page }) => {
    await page.goto("/instructor");
    await page.getByRole("complementary").getByRole("button", { name: /^01 Introduction to Programming/ }).click();
    await page.getByRole("tab", { name: /^Create content/ }).click();
    await page.locator("header").filter({ hasText: "Collect student work and provide feedback" }).getByRole("button", { name: "+ Create" }).click();
    await page.getByRole("textbox", { name: "Assignment title · required" }).fill("Pseudocode for a vending machine");
    await page.getByRole("button", { name: "Save and publish" }).click();

    await useNewStudentUi(page);
    await page.goto("/student/tasks");
    await page.getByRole("button", { name: /Pseudocode for a vending machine/ }).click();
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Enter the filename of the work you are turning in.")).toBeVisible();
    await page.getByRole("textbox", { name: /Attachment filename/ }).fill("vending.pdf");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Waiting for instructor review" })).toBeVisible();

    await page.goto("/instructor");
    await page.getByRole("complementary").getByRole("button", { name: /^01 Introduction to Programming/ }).click();
    await expect(page.getByRole("tab", { name: /^Submissions1/ })).toBeVisible();
  });

  test("search works on phones from the search sheet @mobile", async ({ page }) => {
    await useNewStudentUi(page);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("dialog", { name: "Search" }).getByRole("textbox", { name: "Search student workspace" }).fill("Relational");
    await page.getByRole("button", { name: /^Quiz Quiz 02/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: QUIZ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the welcome message can be dismissed and stays dismissed", async ({ page }) => {
    await useNewStudentUi(page);
    await page.getByRole("button", { name: "Dismiss welcome message" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to the new design" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to the new design" })).toHaveCount(0);
  });
});
