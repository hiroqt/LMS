import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, openRole, test, type Page } from "./fixtures";

// The assessment builder (D-040; docs/QUESTION_TYPES_PLAN.md). Shapes follow
// docs/ASSESSMENTS_API_CONTRACT.md. Tests marked "needs the assessments API" use
// sections, new question types, incomplete sets, or the import endpoint, which the
// LMS API gains on the API and import streams of feat/assessments.

const CLASS = "/instructor/classes/biology";
const BUILDER = `${CLASS}/assessments/new`;
const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });
const main = (page: Page) => page.getByRole("main");
// D-056: the builder shows one part at a time, as tabs.
const part = (page: Page, name: "Details" | "Questions" | "Settings") =>
  page.getByRole("tablist", { name: "Assessment builder" }).getByRole("tab", { name: new RegExp(`^${name}`) });

async function openBuilder(page: Page) {
  await openRole(page, "instructor");
  await page.goto(BUILDER);
  await expect(page.getByRole("heading", { level: 1, name: "New assessment" })).toBeVisible();
}

async function addQuestion(page: Page, type: RegExp, section?: number) {
  await part(page, "Questions").click();
  const name = section === undefined ? /^Add question$/ : new RegExp(`^Add question to section ${section}$`);
  await main(page).getByRole("button", { name }).click();
  await page.getByRole("menuitem", { name: type }).click();
}

const prompt = (page: Page, n: number) => page.getByRole("textbox", { name: `Question ${n}`, exact: true });

async function fillMultipleChoice(page: Page, n: number) {
  await prompt(page, n).fill("Which organelle makes energy?");
  for (const [letter, text] of [["a", "Mitochondrion"], ["b", "Ribosome"], ["c", "Nucleus"], ["d", "Vacuole"]] as const) {
    await page.getByRole("textbox", { name: `Question ${n}, choice ${letter}` }).fill(text);
  }
  await page.getByRole("radio", { name: `Choice a of question ${n} is Correct` }).check();
}

test.describe("Instructor · assessment builder (D-040)", () => {
  test("Create on the Assessments card opens the builder, and its back link returns to the class", async ({ page }) => {
    await openRole(page, "instructor");
    await page.goto(`${CLASS}?tab=Create+content`);
    await page.locator("header").filter({ hasText: "Build and publish a quiz or exam" }).getByRole("button", { name: /Create/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "New assessment" })).toBeVisible();
    // D-056: Details, Questions, and Settings are tabs; only the chosen one is shown, beside the Summary.
    await expect(page.getByRole("tablist", { name: "Assessment builder" }).getByRole("tab")).toHaveText([/^Details/, /^Questions/, /^Settings/]);
    await expect(part(page, "Details")).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByRole("heading", { level: 2 })).toHaveText(["Details", "Summary"]);
    await page.getByRole("button", { name: /^Back to / }).click();
    await expect(tab(page, /^Create content/)).toHaveAttribute("aria-selected", "true");
  });

  test("Save draft, then Publish: the draft is listed for editing and the published exam is in Classwork", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Cell quiz");
    await addQuestion(page, /^Multiple choice/);
    await fillMultipleChoice(page, 1);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Draft saved at/ })).toBeVisible();
    // The first save keeps the tab that was open (D-056).
    await expect(page).toHaveURL(/\/assessments\/\d+\/edit\?tab=questions$/);
    // Still the same page: the question typed before saving is there.
    await expect(prompt(page, 1)).toHaveValue("Which organelle makes energy?");

    await page.goto(`${CLASS}?tab=Create+content`);
    await main(page).getByRole("button", { name: /^Edit draft Cell quiz/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit assessment" })).toBeVisible();
    await expect(prompt(page, 1)).toHaveValue("Which organelle makes energy?");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(tab(page, /^Classwork/)).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByText("Cell quiz")).toBeVisible();
  });

  test("leaving with unsaved changes asks first; Keep editing stays and Leave goes", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Unsaved quiz");
    const nav = page.getByRole("navigation", { name: "instructor navigation" });
    await nav.getByRole("button", { name: "Gradebook" }).click();
    const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByRole("textbox", { name: /^Assessment title/ })).toHaveValue("Unsaved quiz");
    await page.getByRole("button", { name: /^Back to / }).click();
    await page.getByRole("dialog", { name: "Leave without saving?" }).getByRole("button", { name: "Leave without saving" }).click();
    await expect(tab(page, /^Create content/)).toHaveAttribute("aria-selected", "true");
  });

  test("Publish is refused while a question needs attention, and the link jumps to it", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Unfinished quiz");
    await addQuestion(page, /^True or false/);
    await prompt(page, 1).fill("Plant cells have walls.");
    await addQuestion(page, /^Multiple choice/);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Finish the questions marked “needs attention” before publishing: question 1, question 2." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Question 1, needs attention" })).toBeVisible();
    await page.getByRole("complementary", { name: "Summary" }).getByRole("button", { name: /^Question 2/ }).click();
    await expect(page.getByRole("button", { name: /^Question 2 · Multiple choice/ })).toBeFocused();
    await expect(page).toHaveURL(/\/assessments\/new\?tab=questions$/);
  });

  test("needs the assessments API: an incomplete question saves as a draft and is marked by the server", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Draft with gaps");
    await addQuestion(page, /^Identification/);
    await prompt(page, 1).fill("The powerhouse of the cell.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Draft saved at/ })).toBeVisible();
    await expect(main(page).getByRole("article", { name: /^Question 1/ }).getByText("Needs attention", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "needs attention" })).toBeVisible();
  });

  test("needs the assessments API: sections and every question type save and reload", async ({ page }) => {
    test.slow();
    await openBuilder(page);
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Unit test: cells");
    await part(page, "Questions").click();
    await page.getByRole("textbox", { name: "Section 1 title" }).fill("Test I. Objective");
    await page.getByRole("spinbutton", { name: "Default points, section 1" }).fill("2");
    await page.getByRole("textbox", { name: "Directions for section 1" }).fill("Answer every item.");

    await addQuestion(page, /^Multiple choice/);
    await fillMultipleChoice(page, 1);
    await expect(page.getByRole("spinbutton", { name: "Points for question 1" })).toHaveValue("2");

    await addQuestion(page, /^True or false/);
    await prompt(page, 2).fill("Plant cells have walls.");
    await page.getByRole("group", { name: "Answer to question 2" }).getByRole("radio", { name: "True" }).check();

    await addQuestion(page, /^Modified true or false/);
    await prompt(page, 3).fill("The nucleus makes energy.");
    await page.getByRole("textbox", { name: "Underlined phrase in question 3" }).fill("nucleus");
    await expect(main(page).getByText("nucleus", { exact: true }).and(page.locator("u"))).toBeVisible();
    await page.getByRole("group", { name: "Is the statement in question 3 true?" }).getByRole("radio", { name: "False" }).check();
    await page.getByRole("textbox", { name: "Accepted corrections for question 3" }).fill("mitochondrion\nmitochondria");

    await addQuestion(page, /^Identification/);
    await prompt(page, 4).fill("The basic unit of life.");
    await page.getByRole("textbox", { name: "Accepted answers for question 4" }).fill("cell");
    await main(page).getByRole("article", { name: /^Question 4/ }).getByRole("checkbox", { name: /Capitals matter/ }).check();

    await addQuestion(page, /^Enumeration/);
    await prompt(page, 5).fill("Name two parts of a plant cell.");
    await page.getByRole("textbox", { name: "Accepted answers for question 5" }).fill("wall\nchloroplast");

    await main(page).getByRole("button", { name: "Add section" }).click();
    await page.getByRole("textbox", { name: "Section 2 title" }).fill("Test II. Matching and essay");
    await addQuestion(page, /^Matching/, 2);
    await prompt(page, 6).fill("Match the part to its job.");
    await page.getByRole("textbox", { name: "Question 6, pair 1, item" }).fill("Ribosome");
    await page.getByRole("textbox", { name: "Question 6, pair 1, match" }).fill("Makes proteins");
    await page.getByRole("textbox", { name: "Question 6, pair 2, item" }).fill("Vacuole");
    await page.getByRole("textbox", { name: "Question 6, pair 2, match" }).fill("Stores water");
    await addQuestion(page, /^Essay/, 2);
    await prompt(page, 7).fill("Explain osmosis.");

    const summary = page.getByRole("complementary", { name: "Summary" });
    await expect(summary.getByText(/^7 questions · /)).toBeVisible();
    await expect(summary.getByText(/need attention/)).toHaveCount(0);
    // Axe's target-size rule counts a 44px button as small when it happens to sit under the sticky
    // top bar at the scroll position the last fill left; measure the page from the top instead.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page);
    await expectReadableText(page);

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Draft saved at/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Edit assessment" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Section 2: Test II. Matching and essay" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Underlined phrase in question 3" })).toHaveValue("nucleus");
    await expect(page.getByRole("textbox", { name: "Accepted corrections for question 3" })).toHaveValue("mitochondrion\nmitochondria");
    await expect(prompt(page, 7)).toHaveValue("Explain osmosis.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(main(page).getByText("Unit test: cells")).toBeVisible();
  });

  test("needs the assessments API: pasted text imports into the editor with the original text and warnings", async ({ page }) => {
    await openBuilder(page);
    await part(page, "Questions").click();
    await page.getByRole("radio", { name: /^Import from a file/ }).check();
    const dialog = page.getByRole("dialog", { name: "Import questions" });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    await dialog.getByRole("radio", { name: /^Pasted text/ }).check();
    await dialog.getByRole("textbox", { name: /^Questions to import/ }).fill(
      [
        "Cell biology quiz",
        "",
        "Test I. Multiple choice (1 point each)",
        "1. Which organelle makes energy?",
        "a. Mitochondrion",
        "b. Ribosome",
        "Answer: a",
        "",
        "Test II. Identification (2 points each)",
        "2. The basic unit of life.",
      ].join("\n"),
    );
    await dialog.getByRole("button", { name: "Read questions" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Import summary" })).toContainText("Read 2 questions from the pasted text.");
    await expect(prompt(page, 1)).toHaveValue("Which organelle makes energy?");
    const second = main(page).getByRole("article", { name: /^Question 2/ });
    await second.getByText(/^Original text/).click();
    await expect(second.getByText("2. The basic unit of life.")).toBeVisible();
    await expect(second.getByText("Needs attention", { exact: true }).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await part(page, "Details").click();
    await expect(page.getByRole("textbox", { name: /^Assessment title/ })).toHaveValue("Cell biology quiz");
  });

  test("each part has its own URL, a reload keeps it, and Next moves to the next part", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("button", { name: "Next: Questions" }).click();
    await expect(part(page, "Questions")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: /^Questions/ })).toBeFocused();
    await expect(page).toHaveURL(/\/assessments\/new\?tab=questions$/);
    await expect(page.getByRole("textbox", { name: /^Assessment title/ })).toHaveCount(0);
    await page.reload();
    await expect(part(page, "Questions")).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Next: Settings" }).click();
    await expect(page).toHaveURL(/\?tab=settings$/);
    await expect(page.getByRole("spinbutton", { name: /^Attempts allowed/ })).toBeVisible();
    // The Summary sums up the settings and opens them from any part.
    await part(page, "Details").click();
    await page.getByRole("complementary", { name: "Summary" }).getByRole("button", { name: "Settings: No due date · 1 attempt · No time limit" }).click();
    await expect(part(page, "Settings")).toHaveAttribute("aria-selected", "true");
    // Keyboard: arrow keys move between the tabs, and the URL follows.
    await part(page, "Settings").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(part(page, "Questions")).toHaveAttribute("aria-selected", "true");
    await expect(part(page, "Questions")).toBeFocused();
    await expect(page).toHaveURL(/\?tab=questions$/);
  });

  test("a problem on a hidden part opens that part and focuses the field", async ({ page }) => {
    await openBuilder(page);
    await part(page, "Settings").click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(part(page, "Details")).toHaveAttribute("aria-selected", "true");
    await expect(part(page, "Details")).toHaveAccessibleName("Details 1 field to fix");
    await expect(page.getByRole("textbox", { name: /^Assessment title/ })).toBeFocused();

    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Cell quiz");
    await part(page, "Settings").click();
    await page.getByRole("spinbutton", { name: /^Attempts allowed/ }).fill("0");
    await part(page, "Details").click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(part(page, "Settings")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("spinbutton", { name: /^Attempts allowed/ })).toBeFocused();
    await expect(part(page, "Details")).toHaveAccessibleName("Details");
  });

  test("a question that needs attention is marked on its tab, and the Summary opens it from another part", async ({ page }) => {
    await openBuilder(page);
    await addQuestion(page, /^Multiple choice/);
    await expect(part(page, "Questions")).toHaveAccessibleName("Questions 1 question, 1 needs attention");
    await part(page, "Settings").click();
    await page.getByRole("complementary", { name: "Summary" }).getByRole("button", { name: /^Question 1/ }).click();
    await expect(part(page, "Questions")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: /^Question 1 · Multiple choice/ })).toBeFocused();
  });
});

test("Assessment builder: zero axe violations and text ≥14px with every question type open @all", async ({ page }) => {
  test.slow(); // several full axe scans (L-030)
  await openBuilder(page);
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await part(page, "Settings").click();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await part(page, "Details").click();
  await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Every type");
  for (const type of [/^Multiple choice/, /^True or false/, /^Modified true or false/, /^Identification/, /^Enumeration/, /^Matching/, /^Essay/]) {
    await addQuestion(page, type);
  }
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "before publishing" })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await main(page).getByRole("button", { name: "Import questions" }).click();
  await expect(page.getByRole("dialog", { name: "Import questions" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Assessment builder does not scroll sideways at 320px, and the summary bar stays in reach @mobile", async ({ page }) => {
  await openBuilder(page);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const type of [/^Multiple choice/, /^Modified true or false/, /^Matching/]) await addQuestion(page, type);
  await main(page).getByRole("button", { name: "Add section" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // Every tab fits with every badge showing (D-056): a field to fix on Details and Settings, and questions that need attention.
  await part(page, "Settings").click();
  await page.getByRole("spinbutton", { name: /^Attempts allowed/ }).fill("0");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(part(page, "Settings")).toHaveAccessibleName(/1 field to fix$/);
  await expect(part(page, "Details")).toHaveAccessibleName(/1 field to fix$/);
  const tabs = page.getByRole("tablist", { name: "Assessment builder" });
  expect(await tabs.evaluate((list) => list.scrollWidth - list.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  // The bar sticks to the bottom of the screen while the form scrolls.
  await part(page, "Questions").click();
  await main(page).getByRole("button", { name: "Add section" }).last().scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Publish" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeInViewport();
});
