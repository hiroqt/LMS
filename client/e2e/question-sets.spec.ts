import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { callApi, demoAssessment, expect, openRole, STUDENT, test, type Page } from "./fixtures";

// Question sets reused across exams (D-034): an exam can use an existing set, and a
// locked set can be copied into an editable one. Letters refer to INSTRUCTOR_USER_FLOW.md.

const SET = "Quiz 03: Variables and Data Types";
const nav = (page: Page) => page.getByRole("navigation", { name: "instructor navigation" });
const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });
const card = (page: Page, title: string) => page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });

async function openQuestionSets(page: Page) {
  await openRole(page, "instructor");
  await nav(page).getByRole("button", { name: "Question sets" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question sets" })).toBeVisible();
}

test.describe("Instructor · question sets (QS)", () => {
  test("QS → E: a second exam reuses an existing set and the set lists both exams", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("complementary").getByRole("button", { name: /^IT101 Introduction to Programming/ }).click();
    await tab(page, /^Create content/).click();
    await page.locator("header").filter({ hasText: "Build and publish a quiz or exam" }).getByRole("button", { name: /Create/ }).click();

    // D-040: the assessment builder replaces the inline form; "Use a question set" is the same journey.
    await page.getByRole("textbox", { name: /Assessment title/ }).fill("Make-up quiz: variables");
    await page.getByRole("spinbutton", { name: /Attempts allowed/ }).fill("2");
    await page.getByRole("radio", { name: /^Use a question set/ }).check();
    // The set brings its own points and questions, so there is nothing to type for them.
    await expect(page.getByRole("spinbutton", { name: /^Points/ })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: /^Question/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Choose a question set before publishing.")).toBeVisible();

    await page.getByRole("combobox", { name: /Question set/ }).selectOption({ label: `${SET} · 5 questions · 20 points` });
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(tab(page, /^Classwork\s?4/)).toBeVisible();
    await expect(page.getByRole("main").getByText("Make-up quiz: variables")).toBeVisible();

    await nav(page).getByRole("button", { name: "Question sets" }).click();
    const set = card(page, SET);
    await expect(set.getByRole("listitem")).toHaveText([/^Quiz 03: Variables and Data Types · /, /^Make-up quiz: variables · /]);
    await expect(set.getByText("Locked")).toHaveCount(0);
  });

  test("QS: a locked set cannot be edited, Make a copy gives an editable copy, and the original stays as it was", async ({ page, sandbox }) => {
    // A student starts the exam that uses the set, which locks its questions.
    await callApi(page, sandbox, STUDENT, "POST", `/api/classes/biology/coursework/${demoAssessment("biology-0")}/attempts`);
    await openQuestionSets(page);
    await expect(card(page, SET).getByText("Locked")).toBeVisible();

    await card(page, SET).getByRole("button", { name: SET }).click();
    await expect(page.getByRole("heading", { level: 1, name: SET })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("can no longer change");
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save question set" })).toHaveCount(0);

    await page.getByRole("button", { name: "Make a copy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${SET} (copy)` })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("Not used by any exam yet.")).toBeVisible();
    const prompt = page.getByRole("textbox", { name: "Question 1", exact: true });
    await prompt.fill("Which keyword declares a constant?");
    await page.getByRole("button", { name: "Save question set" }).click();
    await expect(page.getByText("Question set saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Question 1", exact: true })).toHaveValue("Which keyword declares a constant?");
    await page.getByRole("button", { name: "All question sets" }).click();
    await expect(card(page, SET).getByText("Locked")).toBeVisible();
    await expect(card(page, `${SET} (copy)`).getByText("Locked")).toHaveCount(0);
    await card(page, SET).getByRole("button", { name: SET }).click();
    await expect(page.getByRole("main").getByText("Which keyword declares a constant?")).toHaveCount(0);
  });
});

test("Question sets pages: zero axe violations, text ≥14px @all", async ({ page }) => {
  test.slow(); // several pages, each with a full axe scan (L-030)
  await openRole(page, "instructor");
  for (const path of ["/instructor/question-sets", `/instructor/question-sets/${demoAssessment("biology-0")}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByText("Used by").first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
  }
});

test("Question sets pages do not scroll sideways at 320px, and the drawer reaches them @mobile", async ({ page }) => {
  await openRole(page, "instructor");
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Question sets" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question sets" })).toBeVisible();
  for (const path of ["/instructor/question-sets", `/instructor/question-sets/${demoAssessment("biology-0")}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
