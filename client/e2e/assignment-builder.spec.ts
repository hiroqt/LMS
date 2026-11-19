import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { seedAssignment, seedTurnedInAssignment } from "./assignmentFixtures";
import { INSTRUCTOR, STUDENT, callApi, expect, openRole, test, type Page } from "./fixtures";

// The assignment builder (D-058, D-059; docs/ASSIGNMENTS_PLAN.md "Instructor"). Shapes follow
// docs/ASSIGNMENTS_API_CONTRACT.md §1 and §5. Class `biology` is Introduction to Programming.

const CLASS = "/instructor/classes/biology";
const NEW = `${CLASS}/assignments/new`;
const main = (page: Page) => page.getByRole("main");
const classTab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });
const part = (page: Page, name: "Details" | "Hand-in" | "Dates and grading") =>
  page.getByRole("tablist", { name: "Assignment builder" }).getByRole("tab", { name: new RegExp(`^${name}`) });
const summary = (page: Page) => page.getByRole("complementary", { name: "Summary" });
const titleBox = (page: Page) => page.getByRole("textbox", { name: /^Assignment title/ });

interface Work { id: number; title: string; status: string; maxPoints: number; submissionKinds: string[]; maxFiles: number; honorStatement: boolean; allowLate: boolean; closeAt: string | null; dueAt: string | null; gradeRelease: string }
const listWork = async (page: Page, sandbox: string, viewer: typeof STUDENT) => (await callApi<{ items: Work[] }>(page, sandbox, viewer, "GET", "/api/classes/biology/coursework?pageSize=100")).items;
const studentWork = (page: Page, sandbox: string) => listWork(page, sandbox, STUDENT);
const instructorWork = (page: Page, sandbox: string) => listWork(page, sandbox, INSTRUCTOR);

async function openBuilder(page: Page) {
  await openRole(page, "instructor");
  await page.goto(NEW);
  await expect(page.getByRole("heading", { level: 1, name: "New assignment" })).toBeVisible();
}

test.describe("Instructor · assignment builder (D-059)", () => {
  test("Create on the Assignments card opens the builder, with three tabs beside the Summary", async ({ page }) => {
    await openRole(page, "instructor");
    await page.goto(`${CLASS}?tab=Create+content`);
    await page.getByRole("button", { name: "Create assignment" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "New assignment" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Assignment builder" }).getByRole("tab")).toHaveText(["Details", "Hand-in", "Dates and grading"]);
    await expect(part(page, "Details")).toHaveAttribute("aria-selected", "true");
    // What students will read is the student page's own wording (handInRules).
    await expect(summary(page).getByRole("list", { name: "What students will read" })).toContainText("You can hand in a written answer and up to 5 files.");
    await page.getByRole("button", { name: /^Back to / }).click();
    await expect(classTab(page, /^Classwork/)).toHaveAttribute("aria-selected", "true");
  });

  test("a preset fills the settings, and publishing it reaches students with them", async ({ page, sandbox }) => {
    await openBuilder(page);
    await titleBox(page).fill("Sorting lab");
    await main(page).getByRole("button", { name: "Homework", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Homework settings filled in." })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: /^Points/ })).toHaveValue("20");
    const rules = summary(page).getByRole("list", { name: "What students will read" });
    await expect(rules).toContainText("You can hand in a written answer and up to 3 files.");
    await expect(rules).toContainText("Files: PDF, Word (.docx), Photos (JPEG, PNG), up to 25 MB each.");
    await expect(rules).toContainText("Due Oct 30, 2026, 11:59 PM.");
    await expect(rules).toContainText("Late work is accepted until Nov 1, 2026, 11:59 PM and is marked late.");
    await expect(rules).toContainText("You confirm that the work is your own when you turn it in.");
    await part(page, "Hand-in").click();
    await expect(page.getByRole("checkbox", { name: /This is my own work/ })).toBeChecked();
    await expect(page.getByRole("combobox", { name: /^Files per turn-in/ })).toHaveValue("3");

    await summary(page).getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Assignment published" })).toBeVisible();
    await expect(classTab(page, /^Classwork/)).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByText("Sorting lab")).toBeVisible();

    const seen = (await studentWork(page, sandbox)).find((item) => item.title === "Sorting lab");
    expect(seen).toMatchObject({ maxPoints: 20, submissionKinds: ["text", "file"], maxFiles: 3, honorStatement: true, allowLate: true });
    // 11:59 PM in Manila, two days after the due date.
    expect(new Date(seen!.closeAt!).toISOString()).toBe("2026-11-01T15:59:00.000Z");
  });

  test("Copy a previous assignment takes its settings but not its title or dates", async ({ page, sandbox }) => {
    await seedAssignment(page, sandbox, { title: "Old lab", settings: { maxPoints: 15, submissionKinds: ["link"], gradeRelease: "returned", honorStatement: true, dueAt: "2026-10-01T10:00:00Z" } });
    await openBuilder(page);
    await titleBox(page).fill("New lab");
    await main(page).getByRole("button", { name: "Copy a previous assignment" }).click();
    const dialog = page.getByRole("dialog", { name: "Copy a previous assignment" });
    await dialog.getByRole("combobox", { name: "Assignment to copy" }).selectOption({ label: "Old lab" });
    await dialog.getByRole("button", { name: "Copy settings" }).click();
    await expect(dialog).toBeHidden();
    await expect(titleBox(page)).toHaveValue("New lab");
    await expect(page.getByRole("spinbutton", { name: /^Points/ })).toHaveValue("15");
    const rules = summary(page).getByRole("list", { name: "What students will read" });
    await expect(rules).toContainText("You can hand in a link.");
    await expect(rules).toContainText("There is no due date.");
    await expect(rules).toContainText("You see your grade when your instructor returns your work.");
  });

  test("a problem on a hidden tab opens that tab, and the Summary's link focuses the field", async ({ page }) => {
    await openBuilder(page);
    await titleBox(page).fill("Hand-in check");
    await part(page, "Hand-in").click();
    for (const name of [/^A written answer/, /^Files/]) await page.getByRole("checkbox", { name }).uncheck();
    await part(page, "Details").click();
    await summary(page).getByRole("button", { name: "Save draft" }).click();
    await expect(part(page, "Hand-in")).toHaveAttribute("aria-selected", "true");
    await expect(part(page, "Hand-in")).toHaveAccessibleName("Hand-in 1 field to fix");
    await expect(page.getByRole("checkbox", { name: /^A written answer/ })).toBeFocused();
    await expect(page).toHaveURL(/\/assignments\/new\?tab=hand-in$/);
    await expect(main(page).getByText("Choose at least one way to hand in work.").first()).toBeVisible();

    // The Summary lists it; its link opens the tab from anywhere.
    await part(page, "Dates and grading").click();
    await summary(page).getByRole("button", { name: /^What students hand in/ }).click();
    await expect(part(page, "Hand-in")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("checkbox", { name: /^A written answer/ })).toBeFocused();
  });

  test("the server's field errors land on their field and open its tab", async ({ page }) => {
    await openBuilder(page);
    await titleBox(page).fill("Server check");
    // The client has no limit on instructions; the server refuses more than 10,000 characters.
    await page.getByRole("textbox", { name: /^Instructions/ }).fill("x".repeat(10_001));
    await part(page, "Dates and grading").click();
    await summary(page).getByRole("button", { name: "Save draft" }).click();
    await expect(part(page, "Details")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: /^Instructions/ })).toBeFocused();
    await expect(part(page, "Details")).toHaveAccessibleName("Details 1 field to fix");
  });

  test("the last day for late work needs late work and a due date", async ({ page }) => {
    await openBuilder(page);
    await titleBox(page).fill("Dates check");
    await part(page, "Dates and grading").click();
    const late = page.getByRole("checkbox", { name: /^Accept late work/ });
    await expect(late).toBeDisabled();
    await expect(late).toHaveAccessibleName(/Set a due date first/);
    await expect(page.getByLabel(/^Accept late work until/)).toHaveCount(0);
    await page.getByLabel(/^Due date/).fill("2026-11-10T17:00");
    await late.check();
    await page.getByLabel(/^Accept late work until/).fill("2026-11-09T17:00");
    await part(page, "Details").click();
    await summary(page).getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByLabel(/^Accept late work until/)).toBeFocused();
    await expect(main(page).getByText("The last day for late work must be after the due date.").first()).toBeVisible();
  });

  test("each tab has its own URL, a reload keeps it, and Next moves on", async ({ page }) => {
    await openBuilder(page);
    await part(page, "Hand-in").click();
    await expect(page).toHaveURL(/\/assignments\/new\?tab=hand-in$/);
    await page.reload();
    await expect(part(page, "Hand-in")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("group", { name: "Students can hand in" })).toBeVisible();
    await main(page).getByRole("button", { name: "Next: Dates and grading" }).click();
    await expect(page).toHaveURL(/\?tab=dates$/);
    await expect(page.getByRole("group", { name: "Students see their grade" })).toBeVisible();
    await page.goto(`${NEW}?tab=nonsense`);
    await expect(part(page, "Details")).toHaveAttribute("aria-selected", "true");
  });

  test("Save draft keeps the page, students can't see it, and Classwork reopens it to publish", async ({ page, sandbox }) => {
    await openBuilder(page);
    await titleBox(page).fill("Draft lab");
    await part(page, "Dates and grading").click();
    await page.getByRole("checkbox", { name: /^Allow resubmission/ }).check();
    await summary(page).getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Draft saved at/ })).toBeVisible();
    // The first save keeps the tab that was open, and the page keeps what was typed.
    await expect(page).toHaveURL(/\/assignments\/\d+\/edit\?tab=dates$/);
    await expect(page.getByRole("checkbox", { name: /^Allow resubmission/ })).toBeChecked();
    expect((await studentWork(page, sandbox)).some((item) => item.title === "Draft lab")).toBe(false);

    await page.goto(`${CLASS}?tab=Classwork`);
    await expect(main(page).getByRole("listitem").filter({ hasText: "Draft lab" }).getByText("Draft", { exact: true })).toBeVisible();
    await main(page).getByRole("button", { name: "Edit draft Draft lab" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit assignment" })).toBeVisible();
    await expect(titleBox(page)).toHaveValue("Draft lab");
    await summary(page).getByRole("button", { name: "Publish" }).click();
    await expect(classTab(page, /^Classwork/)).toHaveAttribute("aria-selected", "true");
    await expect(main(page).getByRole("button", { name: "Grading for Draft lab" })).toBeVisible();

    // The student sees it in their Tasks.
    await openRole(page, "student");
    await page.goto("/student/tasks");
    await expect(page.getByRole("button", { name: /Draft lab/ })).toBeVisible();
  });

  test("Create content lists a draft assignment with Edit draft", async ({ page, sandbox }) => {
    await seedAssignment(page, sandbox, { title: "Unpublished essay", settings: { status: "draft" } });
    await openRole(page, "instructor");
    await page.goto(`${CLASS}?tab=Create+content`);
    await expect(main(page).getByRole("listitem").filter({ hasText: "Unpublished essay · Draft" })).toBeVisible();
    await main(page).getByRole("button", { name: /^Edit draft Unpublished essay/ }).click();
    await expect(titleBox(page)).toHaveValue("Unpublished essay");
  });

  test("Preview as student saves first, then opens the preview", async ({ page, sandbox }) => {
    await openBuilder(page);
    await titleBox(page).fill("Preview lab");
    await summary(page).getByRole("button", { name: /^Preview/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Preview as student" })).toBeVisible();
    await expect(page).toHaveURL(/\/assignments\/\d+\/preview$/);
    expect((await instructorWork(page, sandbox)).find((item) => item.title === "Preview lab")?.status).toBe("draft");
  });

  test("a published assignment opens for editing with Save changes and a note about handed-in work", async ({ page, sandbox }) => {
    const seeded = await seedTurnedInAssignment(page, sandbox, { title: "Handed-in lab", settings: { dueAt: "2026-10-30T09:00:00Z", allowLate: true, closeAt: "2026-11-02T09:00:00Z" } });
    await openRole(page, "instructor");
    await page.goto(`${CLASS}?tab=Classwork`);
    await main(page).getByRole("button", { name: "Edit Handed-in lab" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit assignment" })).toBeVisible();
    await expect(main(page).getByText("1 student has handed in; work already handed in is not checked again.")).toBeVisible();
    await expect(summary(page).getByRole("button", { name: "Publish" })).toHaveCount(0);
    await expect(summary(page).getByRole("button", { name: "Save draft" })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Homework", exact: true })).toHaveCount(0);

    // Turning late work off removes its last day (clearCloseAt), in one save.
    await part(page, "Dates and grading").click();
    await page.getByRole("checkbox", { name: /^Accept late work/ }).uncheck();
    await part(page, "Details").click();
    await page.getByRole("spinbutton", { name: /^Points/ }).fill("25");
    await summary(page).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Changes saved" }).first()).toBeVisible();
    const saved = (await instructorWork(page, sandbox)).find((item) => String(item.id) === seeded.courseworkId);
    expect(saved).toMatchObject({ status: "published", maxPoints: 25, allowLate: false, closeAt: null });
  });

  test("a closed assignment is read-only until it is reopened", async ({ page, sandbox }) => {
    const seeded = await seedAssignment(page, sandbox, { title: "Closed lab" });
    // Closing needs a grade for everyone (D-036): give one to each student who handed in nothing.
    const work = `/api/classes/biology/coursework/${seeded.courseworkId}`;
    await callApi(page, sandbox, INSTRUCTOR, "POST", `${work}/grade-missing`, { points: 0 });
    await callApi(page, sandbox, INSTRUCTOR, "POST", `${work}/close`);
    await openRole(page, "instructor");
    await page.goto(`${CLASS}/assignments/${seeded.courseworkId}/edit`);
    await expect(summary(page).getByText("This assignment is closed. Reopen it to change it.")).toBeVisible();
    await expect(titleBox(page)).toBeDisabled();
    await expect(summary(page).getByRole("button", { name: /Save|Publish/ })).toHaveCount(0);
  });

  test("leaving with unsaved changes asks first; Keep editing stays and Leave goes", async ({ page }) => {
    await openBuilder(page);
    await titleBox(page).fill("Unsaved lab");
    await page.getByRole("button", { name: /^Back to / }).click();
    const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(titleBox(page)).toHaveValue("Unsaved lab");
    await page.getByRole("button", { name: /^Back to / }).click();
    await page.getByRole("dialog", { name: "Leave without saving?" }).getByRole("button", { name: "Leave without saving" }).click();
    await expect(classTab(page, /^Classwork/)).toHaveAttribute("aria-selected", "true");
  });
});

test("Assignment builder: zero axe violations and text ≥14px on every tab @all", async ({ page, sandbox }) => {
  test.slow(); // several full axe scans (L-030)
  await seedAssignment(page, sandbox, { title: "Earlier lab" });
  await openBuilder(page);
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await titleBox(page).fill("Axe lab");
  await main(page).getByRole("button", { name: "Project", exact: true }).click();
  await part(page, "Hand-in").click();
  await expectNoAxeViolations(page);
  await part(page, "Dates and grading").click();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
  await part(page, "Details").click();
  await titleBox(page).fill("");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(part(page, "Details")).toHaveAccessibleName("Details 1 field to fix");
  await expectNoAxeViolations(page);
  await main(page).getByRole("button", { name: "Copy a previous assignment" }).click();
  await expect(page.getByRole("dialog", { name: "Copy a previous assignment" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Assignment builder does not scroll sideways at 320px, and the summary bar stays in reach @all", async ({ page }) => {
  await openBuilder(page);
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);
  // Every tab fits with a badge showing on each.
  await part(page, "Hand-in").click();
  await page.getByRole("checkbox", { name: /^A written answer/ }).uncheck();
  await page.getByRole("checkbox", { name: /^Files/ }).uncheck();
  await part(page, "Details").click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(part(page, "Details")).toHaveAccessibleName("Details 1 field to fix");
  await expect(part(page, "Hand-in")).toHaveAccessibleName("Hand-in 1 field to fix");
  const tabs = page.getByRole("tablist", { name: "Assignment builder" });
  expect(await tabs.evaluate((list) => list.scrollWidth - list.clientWidth)).toBeLessThanOrEqual(1);
  for (const name of ["Details", "Hand-in", "Dates and grading"] as const) {
    await part(page, name).click();
    expect(await overflow(), name).toBeLessThanOrEqual(1);
  }
  await expect(page.getByRole("button", { name: "Publish" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeInViewport();
});
