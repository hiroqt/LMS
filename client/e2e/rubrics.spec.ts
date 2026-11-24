import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { gradeWork, rubricChoice, seedAssignment, seedRubric, seedTurnedInAssignment } from "./assignmentFixtures";
import { INSTRUCTOR, callApi, expect, openRole, test, type Page } from "./fixtures";

// A class's rubrics: the list and the editor (D-062, D-063; docs/ASSIGNMENTS_API_CONTRACT.md §12).
// Class `biology` is Introduction to Programming.

const CLASS = "/instructor/classes/biology";
const RUBRICS = `${CLASS}/rubrics`;
const main = (page: Page) => page.getByRole("main");
const criterion = (page: Page, number: number) => main(page).getByRole("region", { name: `Criterion ${number}` });
const level = (page: Page, criterionNumber: number, number: number) => criterion(page, criterionNumber).getByRole("group", { name: `Level ${number}` });
const card = (page: Page, title: string) => main(page).getByRole("list", { name: "Rubrics" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

interface ApiRubric { id: number; title: string; totalPoints: number; locked: boolean; criteria: Array<{ title: string; levels: Array<{ title: string; points: number }> }> }
const listRubrics = (page: Page, sandbox: string) => callApi<ApiRubric[]>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/rubrics");

async function openRubrics(page: Page) {
  await openRole(page, "instructor");
  await page.goto(RUBRICS);
  await expect(page.getByRole("heading", { level: 1, name: "Rubrics" })).toBeVisible();
}

test.describe("Instructor · rubrics (D-063)", () => {
  test("Create content leads to an empty list, and a rubric with two criteria is created", async ({ page, sandbox }) => {
    await openRole(page, "instructor");
    await page.goto(`${CLASS}?tab=Create+content`);
    await main(page).getByRole("button", { name: "Manage rubrics" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Rubrics" })).toBeVisible();
    await expect(main(page).getByText("No rubrics yet")).toBeVisible();

    await main(page).getByRole("button", { name: "New rubric" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "New rubric" })).toBeVisible();
    await main(page).getByRole("textbox", { name: /^Rubric title/ }).fill("Lab report");
    await criterion(page, 1).getByRole("textbox", { name: /^Criterion title/ }).fill("Analysis");
    await expect(main(page).getByText("Total: 10 points")).toBeVisible();
    await main(page).getByRole("button", { name: "Add criterion" }).click();
    // The new criterion's title takes focus.
    await expect(criterion(page, 2).getByRole("textbox", { name: /^Criterion title/ })).toBeFocused();
    await criterion(page, 2).getByRole("textbox", { name: /^Criterion title/ }).fill("Presentation");
    await criterion(page, 2).getByRole("button", { name: "Remove level 3 of criterion 2" }).click();
    await level(page, 2, 1).getByRole("textbox", { name: /^Title/ }).fill("Clear");
    await level(page, 2, 1).getByRole("spinbutton", { name: /^Points/ }).fill("5");
    await level(page, 2, 2).getByRole("textbox", { name: /^Title/ }).fill("Unclear");
    await level(page, 2, 2).getByRole("spinbutton", { name: /^Points/ }).fill("2");
    await expect(main(page).getByText("Total: 15 points")).toBeVisible();
    await expect(criterion(page, 2).getByRole("button", { name: "Remove level 1 of criterion 2" })).toBeDisabled();

    await main(page).getByRole("button", { name: "Save rubric" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rubric saved" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Edit rubric" })).toBeVisible();
    await expect(page).toHaveURL(/\/rubrics\/\d+$/);
    const [saved] = await listRubrics(page, sandbox);
    expect(saved).toMatchObject({ title: "Lab report", totalPoints: 15, locked: false });
    expect(saved!.criteria.map((item) => item.title)).toEqual(["Analysis", "Presentation"]);
    expect(saved!.criteria[1]!.levels).toMatchObject([{ title: "Clear", points: 5 }, { title: "Unclear", points: 2 }]);

    await page.getByRole("button", { name: "All rubrics" }).click();
    await expect(card(page, "Lab report")).toContainText("15 points · 2 criteria · not used by any assignment");
  });

  test("problems land on their inputs, and the first takes focus", async ({ page }) => {
    await openRubrics(page);
    await main(page).getByRole("button", { name: "New rubric" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "New rubric" })).toBeVisible();
    await main(page).getByRole("button", { name: "Save rubric" }).click();
    const title = main(page).getByRole("textbox", { name: /^Rubric title/ });
    await expect(title).toBeFocused();
    await expect(title).toHaveAccessibleDescription("Enter a title.");
    await expect(criterion(page, 1).getByRole("textbox", { name: /^Criterion title/ })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("status").filter({ hasText: "Could not save the rubric" })).toBeVisible();

    await title.fill("Essay");
    await criterion(page, 1).getByRole("textbox", { name: /^Criterion title/ }).fill("Argument");
    const points = level(page, 1, 2).getByRole("spinbutton", { name: /^Points/ });
    await points.fill("2000");
    await main(page).getByRole("button", { name: "Save rubric" }).click();
    await expect(points).toBeFocused();
    await expect(points).toHaveAccessibleDescription("Give 0 to 1,000 points.");
  });

  test("an open rubric is edited: its title and the order of its criteria", async ({ page, sandbox }) => {
    await seedRubric(page, sandbox);
    await openRubrics(page);
    await card(page, "Lab report").getByRole("button", { name: "Open Lab report" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit rubric" })).toBeVisible();
    await main(page).getByRole("textbox", { name: /^Rubric title/ }).fill("Lab report 2");
    await criterion(page, 2).getByRole("button", { name: "Move criterion 2 up" }).click();
    await expect(criterion(page, 1).getByRole("textbox", { name: /^Criterion title/ })).toHaveValue("Presentation");
    // Focus stays on the moved card; at the top, it is on the other move button.
    await expect(criterion(page, 1).getByRole("button", { name: "Move criterion 1 down" })).toBeFocused();
    await main(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Changes saved" })).toBeVisible();
    const [saved] = await listRubrics(page, sandbox);
    expect(saved!.title).toBe("Lab report 2");
    expect(saved!.criteria.map((item) => item.title)).toEqual(["Presentation", "Analysis"]);
  });

  test("leaving the editor with unsaved changes asks first", async ({ page, sandbox }) => {
    await seedRubric(page, sandbox);
    await openRubrics(page);
    await card(page, "Lab report").getByRole("button", { name: "Open Lab report" }).click();
    await main(page).getByRole("textbox", { name: /^Rubric title/ }).fill("Changed");
    await page.getByRole("button", { name: "All rubrics" }).click();
    await expect(page.getByRole("dialog", { name: "Leave without saving?" })).toBeVisible();
  });

  test("Copy makes an unlocked copy, and Delete asks, names it, and removes it", async ({ page, sandbox }) => {
    await seedRubric(page, sandbox);
    await openRubrics(page);
    await card(page, "Lab report").getByRole("button", { name: "Copy Lab report" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rubric copied" })).toBeVisible();
    await expect(card(page, "Lab report (copy)")).toBeVisible();

    await card(page, "Lab report (copy)").getByRole("button", { name: "Delete Lab report (copy)" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Lab report (copy)”?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete rubric" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Rubric deleted" })).toBeVisible();
    await expect(card(page, "Lab report (copy)")).toHaveCount(0);
    // The card that opened the dialog is gone, so focus is on the page heading.
    await expect(page.getByRole("heading", { level: 1, name: "Rubrics" })).toBeFocused();
    expect((await listRubrics(page, sandbox)).map((item) => item.title)).toEqual(["Lab report"]);
  });

  test("a rubric an assignment uses is not deleted, with the server's reason", async ({ page, sandbox }) => {
    const rubric = await seedRubric(page, sandbox);
    await seedAssignment(page, sandbox, { title: "Rubric lab", settings: { rubricId: rubric.id } });
    await openRubrics(page);
    await expect(card(page, "Lab report")).toContainText("used by 1 assignment");
    await card(page, "Lab report").getByRole("button", { name: "Delete Lab report" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Lab report”?" });
    await dialog.getByRole("button", { name: "Delete rubric" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("An assignment uses this rubric. Take it off the assignment first.");
    await expect(page.getByRole("status").filter({ hasText: "Could not delete the rubric" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "Lab report")).toBeVisible();
  });

  test("a rubric used to grade is locked: criteria read-only, title editable, and Copy opens an editable copy", async ({ page, sandbox }) => {
    const rubric = await seedRubric(page, sandbox);
    const seeded = await seedTurnedInAssignment(page, sandbox, { title: "Graded lab", settings: { rubricId: rubric.id } });
    await gradeWork(page, sandbox, seeded.classId, seeded.courseworkId, seeded.submissionId, { rubric: rubricChoice(rubric, { Analysis: "Partial", Presentation: "Clear" }) });
    await openRubrics(page);
    await expect(card(page, "Lab report").getByText("Locked", { exact: true })).toBeVisible();
    await expect(card(page, "Lab report")).toContainText("Used to grade, so its criteria can't change.");

    await card(page, "Lab report").getByRole("button", { name: "Open Lab report" }).click();
    await expect(main(page).getByText("This rubric has been used to grade. Copy it to change its criteria.")).toBeVisible();
    await expect(main(page).getByRole("textbox", { name: /^Criterion title/ })).toHaveCount(0);
    await expect(main(page).getByRole("group", { name: /^Analysis/ })).toBeVisible();
    await main(page).getByRole("textbox", { name: /^Rubric title/ }).fill("Lab report (graded)");
    await main(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Changes saved" })).toBeVisible();

    await page.getByRole("button", { name: "Copy rubric" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rubric copied" })).toBeVisible();
    await expect(main(page).getByRole("textbox", { name: /^Rubric title/ })).toHaveValue("Lab report (graded) (copy)");
    await expect(criterion(page, 1).getByRole("textbox", { name: /^Criterion title/ })).toHaveValue("Analysis");
  });
});

test("Rubrics: zero axe violations and text ≥14px on the list, the editor, and the delete dialog @all", async ({ page, sandbox }) => {
  test.slow(); // several full axe scans (L-030)
  const rubric = await seedRubric(page, sandbox);
  const seeded = await seedTurnedInAssignment(page, sandbox, { title: "Graded lab", settings: { rubricId: rubric.id } });
  await gradeWork(page, sandbox, seeded.classId, seeded.courseworkId, seeded.submissionId, { rubric: rubricChoice(rubric, { Analysis: "Complete", Presentation: "Clear" }) });
  await seedRubric(page, sandbox, "biology", "Essay");
  await openRubrics(page);
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await card(page, "Essay").getByRole("button", { name: "Delete Essay" }).click();
  await expect(page.getByRole("dialog", { name: "Delete “Essay”?" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await card(page, "Essay").getByRole("button", { name: "Open Essay" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit rubric" })).toBeVisible();
  await main(page).getByRole("button", { name: "Save changes" }).focus();
  await main(page).getByRole("textbox", { name: /^Rubric title/ }).fill("");
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(main(page).getByRole("textbox", { name: /^Rubric title/ })).toBeFocused();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await page.goto(`${RUBRICS}/${rubric.id}`);
  await expect(main(page).getByText("This rubric has been used to grade. Copy it to change its criteria.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Rubrics do not scroll sideways at 320px @all", async ({ page, sandbox }) => {
  await seedRubric(page, sandbox, "biology", "A rubric with a long title for the narrowest phones");
  await openRubrics(page);
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow(), "list").toBeLessThanOrEqual(1);
  await main(page).getByRole("button", { name: /^Open A rubric/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit rubric" })).toBeVisible();
  expect(await overflow(), "editor").toBeLessThanOrEqual(1);
  await main(page).getByRole("button", { name: "Add criterion" }).click();
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(criterion(page, 3).getByRole("textbox", { name: /^Criterion title/ })).toBeFocused();
  expect(await overflow(), "editor with errors").toBeLessThanOrEqual(1);
  await expect(main(page).getByRole("button", { name: "Save changes" })).toBeInViewport();
});
