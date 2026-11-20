import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { excuse, extendFor, gradeWork, pdfFile, seedAssignment, seedRubric, serverNow, turnInWork } from "./assignmentFixtures";
import { callApi, expect, INSTRUCTOR, openRole, test, type DemoViewer, type Page } from "./fixtures";

// Phase 3 on the assignment grading page (D-064; contract §10–§13): late penalties, grading with a
// rubric, a student's own dates and excused work, saved comments, returning the selected work, and
// every student's work as one zip. Everything is seeded through the API in each test's sandbox.
// Due dates come from the API's clock, which can be minutes ahead of the browser's (L-087).

const TITLE = "Lab report";
const DAY = 24 * 60 * 60 * 1000;
const student = (id: string): DemoViewer => ({ id, role: "student" });
const gradingPath = (id: string, query = "") => `/instructor/classes/biology/assignments/${id}/grading${query}`;
const chip = (page: Page, name: string) => page.getByRole("group", { name: "Show students" }).getByRole("button", { name: new RegExp(`^${name}\\s?\\d+$`) });
const studentList = (page: Page) => page.getByRole("list", { name: `Students for ${TITLE}` });
const row = (page: Page, name: string) => studentList(page).getByRole("button", { name: new RegExp(`^${name}`) });
const toast = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
/** A datetime-local value in Manila (UTC+8, the suite's time zone, no daylight saving). */
const manilaInput = (date: Date) => new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);

type Mine = { status: string; score: number | null; rawScore: number | null; penaltyPercent: number; penaltyWaived: boolean; daysLate: number; rubricScores: unknown[] };
const latestOf = async (page: Page, sandbox: string, id: string, courseworkId: string) =>
  (await callApi<Mine[]>(page, sandbox, student(id), "GET", `/api/classes/biology/coursework/${courseworkId}/my-submissions`)).at(-1);

/** An assignment due two calendar days before the API's "now", taking late work. */
async function lateAssignment(page: Page, sandbox: string, settings: Record<string, unknown> = {}) {
  const now = await serverNow(page, sandbox);
  return seedAssignment(page, sandbox, { title: TITLE, settings: { dueAt: new Date(now.getTime() - 2 * DAY - 60_000).toISOString(), allowLate: true, ...settings } });
}

test.describe("Assignment grading · Phase 3", () => {
  test("late work shows the penalty sum; waiving it gives the raw score back", async ({ page, sandbox }) => {
    const { classId, courseworkId } = await lateAssignment(page, sandbox, { latePenaltyPercentPerDay: 10 });
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    const work = page.getByRole("region", { name: "Alex Rivera" });
    await expect(work.getByText("2 days late").first()).toBeVisible();
    await expect(work.getByText("Late work loses 10% of its score for each day late.")).toBeVisible();

    await work.getByRole("spinbutton", { name: /Score/ }).fill("18");
    await expect(work.getByText("18 − 20% (2 days late) = 14.4 of 20")).toBeVisible();
    await work.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page, "Alex Rivera · 14.4 / 20 after the 20% late penalty.")).toBeVisible();
    await expect(row(page, "Alex Rivera")).toContainText("Graded · 14.4 / 20");
    expect(await latestOf(page, sandbox, "s0", courseworkId)).toMatchObject({ score: 14.4, rawScore: 18, penaltyPercent: 20, daysLate: 2, penaltyWaived: false });

    // The Points field keeps the raw points; waive the penalty and the score is 18 again.
    await expect(work.getByRole("spinbutton", { name: /Score/ })).toHaveValue("18");
    await work.getByRole("checkbox", { name: "Waive the late penalty for this student" }).check();
    await expect(work.getByText("18 of 20: late penalty waived (2 days late)")).toBeVisible();
    await work.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page, "Alex Rivera · 18 / 20.")).toBeVisible();
    await expect(row(page, "Alex Rivera")).toContainText("Graded · 18 / 20");
    expect(await latestOf(page, sandbox, "s0", courseworkId)).toMatchObject({ score: 18, rawScore: 18, penaltyPercent: 0, penaltyWaived: true });
    await expect(work.getByRole("checkbox", { name: "Waive the late penalty for this student" })).toBeChecked();
  });

  test("grading with a rubric: every criterion needs a level, and the levels and total are saved", async ({ page, sandbox }) => {
    const rubric = await seedRubric(page, sandbox);
    const { classId, courseworkId } = await seedAssignment(page, sandbox, { title: TITLE, settings: { rubricId: rubric.id } });
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    const work = page.getByRole("region", { name: "Alex Rivera" });
    await expect(work.getByRole("heading", { name: "Rubric: Lab report" })).toBeVisible();
    await expect(work.getByRole("spinbutton", { name: /Score/ })).toHaveCount(0);

    const analysis = work.getByRole("group", { name: /^Analysis/ });
    await analysis.getByText("Partial", { exact: true }).click();
    await expect(analysis.getByRole("radio", { name: /^Partial/ })).toBeChecked();
    await expect(work.getByText("5 of 15 points so far")).toBeVisible();
    await work.getByRole("button", { name: "Save", exact: true }).click();
    await expect(work.getByText("Choose a level for Presentation.")).toBeVisible();
    await expect(work.getByRole("group", { name: /^Presentation/ }).getByRole("radio", { name: /^Clear/ })).toBeFocused();
    expect((await latestOf(page, sandbox, "s0", courseworkId))?.status).toBe("submitted");

    await work.getByRole("group", { name: /^Presentation/ }).getByText("Clear", { exact: true }).click();
    await expect(work.getByText("Choose a level for Presentation.")).toHaveCount(0);
    await expect(work.getByText("10 of 15 points", { exact: true })).toBeVisible();
    await work.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page, "Alex Rivera · 10 / 15.")).toBeVisible();
    await expect(row(page, "Alex Rivera")).toContainText("Graded · 10 / 15");
    const mine = await latestOf(page, sandbox, "s0", courseworkId);
    expect(mine).toMatchObject({ status: "graded", score: 10 });
    expect(mine?.rubricScores).toHaveLength(2);

    // Reopened, the levels chosen are shown again.
    await page.reload();
    await expect(page.getByRole("region", { name: "Alex Rivera" }).getByRole("group", { name: /^Analysis/ }).getByRole("radio", { name: /^Partial/ })).toBeChecked();
  });

  test("more time makes late work on time and shows the student's own due date; grading the missing skips them", async ({ page, sandbox }) => {
    const { classId, courseworkId } = await lateAssignment(page, sandbox);
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
    const now = await serverNow(page, sandbox);
    // Noah (s3) handed in nothing and has his own due date tomorrow.
    await extendFor(page, sandbox, classId, courseworkId, "s3", { dueAt: new Date(now.getTime() + DAY).toISOString() });
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    await expect(chip(page, "Late")).toHaveText(/1$/);
    await expect(row(page, "Noah Villanueva")).toContainText("Own due date:");

    const work = page.getByRole("region", { name: "Alex Rivera" });
    await work.getByRole("button", { name: "Give this student more time" }).click();
    const dialog = page.getByRole("dialog", { name: "More time for Alex Rivera" });
    // A due date before the class's is refused on the field.
    await dialog.getByLabel("Their own due date").fill(manilaInput(new Date(now.getTime() - 3 * DAY)));
    await dialog.getByRole("button", { name: "Give more time" }).click();
    await expect(dialog.getByText("A student's own due date must be after the assignment's due date.")).toBeVisible();
    await dialog.getByLabel("Their own due date").fill(manilaInput(new Date(now.getTime() + 2 * DAY)));
    await dialog.getByRole("button", { name: "Give more time" }).click();
    await expect(toast(page, "More time given")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Alex Rivera" })).toBeFocused();

    await expect(chip(page, "Late")).toHaveText(/0$/);
    await expect(row(page, "Alex Rivera")).toContainText("Own due date:");
    await expect(work.getByText(/^Own due date:/)).toBeVisible();
    expect((await callApi<Array<{ late: boolean }>>(page, sandbox, student("s0"), "GET", `/api/classes/biology/coursework/${courseworkId}/my-submissions`)).at(-1)?.late).toBe(false);

    // Everyone who didn't hand in gets 0, except Noah, whose own last day has not passed.
    await page.getByRole("button", { name: "Give 0 to everyone who didn't hand in" }).click();
    await page.getByRole("dialog", { name: "Grade everyone who didn't hand in?" }).getByRole("button", { name: "Give the grade" }).click();
    await expect(toast(page, "0 / 20 for 10 students who didn't hand in. 1 student skipped: their own last day has not passed.")).toBeVisible();
    await expect(row(page, "Noah Villanueva")).toContainText("Missing");

    // Back to the class's dates: late again.
    await work.getByRole("button", { name: "Remove their own dates" }).click();
    await page.getByRole("dialog", { name: "Remove Alex Rivera's own dates?" }).getByRole("button", { name: "Remove their own dates" }).click();
    await expect(toast(page, "Back to the class's dates")).toBeVisible();
    await expect(chip(page, "Late")).toHaveText(/1$/);
  });

  test("an excused student moves to Excused, has no grade form, and leaves the gradebook", async ({ page, sandbox }) => {
    const { classId, courseworkId } = await seedAssignment(page, sandbox, { title: TITLE });
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
    const jamie = await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s1"), files: [pdfFile("jamie.pdf", "Jamie")] });
    const gradebook = async () => (await callApi<{ students: Array<{ studentId: string; activities: { graded: number } }> }>(page, sandbox, INSTRUCTOR, "GET", `/api/classes/${classId}/gradebook`)).students.find((item) => item.studentId === "s1")!.activities.graded;
    const before = await gradebook();
    await gradeWork(page, sandbox, classId, courseworkId, jamie.id, { points: 5 });
    expect(await gradebook()).toBe(before + 1);

    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s1"));
    await expect(chip(page, "Excused")).toHaveText(/0$/);
    const work = page.getByRole("region", { name: "Jamie Lee" });
    await work.getByRole("button", { name: "Excuse from this assignment" }).click();
    const dialog = page.getByRole("dialog", { name: `Excuse Jamie Lee from “${TITLE}”?` });
    await dialog.getByRole("button", { name: "Excuse", exact: true }).click();
    await expect(toast(page, "Excused")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Jamie Lee" })).toBeFocused();

    await expect(chip(page, "Excused")).toHaveText(/1$/);
    await expect(row(page, "Jamie Lee").getByText("Excused", { exact: true })).toBeVisible();
    await expect(work.getByText("Jamie Lee is excused from this assignment, so there is nothing to grade.", { exact: false })).toBeVisible();
    await expect(work.getByRole("button", { name: "Save and next" })).toHaveCount(0);
    expect(await gradebook()).toBe(before);

    // Excused students are never in Missing or Needs grading.
    await excuse(page, sandbox, classId, courseworkId, "s3");
    await page.reload();
    await expect(chip(page, "Excused")).toHaveText(/2$/);
    await expect(chip(page, "Needs grading")).toHaveText(/1$/);
    await chip(page, "Missing").click();
    await expect(studentList(page).getByText("Noah Villanueva")).toHaveCount(0);
    await chip(page, "Excused").click();
    await expect(studentList(page).getByRole("listitem")).toHaveCount(2);

    await page.getByRole("region", { name: "Jamie Lee" }).getByRole("button", { name: "No longer excused" }).click();
    await page.getByRole("dialog", { name: "Jamie Lee no longer excused?" }).getByRole("button", { name: "No longer excused" }).click();
    await expect(toast(page, "No longer excused")).toBeVisible();
    await expect(chip(page, "Excused")).toHaveText(/1$/);
    expect(await gradebook()).toBe(before + 1);
  });

  test("saved comments: saved from feedback, added to feedback, changed and deleted", async ({ page, sandbox }) => {
    const { classId, courseworkId } = await seedAssignment(page, sandbox, { title: TITLE });
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    const work = page.getByRole("region", { name: "Alex Rivera" });
    const feedback = work.getByRole("textbox", { name: /Feedback/ });

    await work.getByRole("button", { name: "Saved comments" }).click();
    const dialog = page.getByRole("dialog", { name: "Saved comments" });
    await expect(dialog.getByText("No saved comments yet.", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();

    await feedback.fill("Label every relationship.");
    await work.getByRole("button", { name: "Save this feedback as a comment" }).click();
    await expect(toast(page, "Comment saved")).toBeVisible();

    await feedback.fill("Clear diagram.");
    await work.getByRole("button", { name: "Saved comments" }).click();
    await expect(dialog.getByText("1 of 200 saved comments.")).toBeVisible();
    const item = dialog.getByRole("listitem").filter({ hasText: "Label every relationship." });
    await item.getByRole("button", { name: "Add to feedback" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(feedback).toHaveValue("Clear diagram.\nLabel every relationship.");
    await expect(feedback).toBeFocused();

    await work.getByRole("button", { name: "Saved comments" }).click();
    await item.getByRole("button", { name: "Edit" }).click();
    await dialog.getByRole("textbox", { name: "Comment" }).fill("Label every relationship with its cardinality.");
    await dialog.getByRole("button", { name: "Save comment" }).click();
    await expect(toast(page, "Comment changed")).toBeVisible();
    const changed = dialog.getByRole("listitem").filter({ hasText: "Label every relationship with its cardinality." });
    await expect(changed).toBeVisible();

    await changed.getByRole("button", { name: "Delete" }).click();
    await changed.getByRole("group", { name: "Delete this comment?" }).getByRole("button", { name: "Delete" }).click();
    await expect(toast(page, "Comment deleted")).toBeVisible();
    await expect(dialog.getByText("No saved comments yet.", { exact: false })).toBeVisible();
    expect(await callApi<unknown[]>(page, sandbox, INSTRUCTOR, "GET", "/api/comment-bank")).toEqual([]);
  });

  test("Return selected returns only the students chosen", async ({ page, sandbox }) => {
    const { classId, courseworkId } = await seedAssignment(page, sandbox, { title: TITLE, settings: { gradeRelease: "returned" } });
    for (const [id, points] of [["s0", 15], ["s1", 12], ["s2", 18]] as const) {
      const work = await turnInWork(page, sandbox, classId, courseworkId, { viewer: student(id), files: [pdfFile(`${id}.pdf`, id)] });
      await gradeWork(page, sandbox, classId, courseworkId, work.id, { points });
    }
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId));
    await expect(page.getByRole("button", { name: "Return selected (0)" })).toBeDisabled();
    await page.getByRole("checkbox", { name: "Choose Alex Rivera to return" }).check();
    await page.getByRole("checkbox", { name: "Choose Jamie Lee to return" }).check();
    await page.getByRole("button", { name: "Return selected (2)" }).click();
    const dialog = page.getByRole("dialog", { name: "Return the selected work?" });
    await expect(dialog.getByText("2 students will see their grade and feedback", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Return to 2 students" }).click();
    await expect(toast(page, "Returned to 2 students")).toBeVisible();

    await expect(chip(page, "Returned")).toHaveText(/2$/);
    await expect(page.getByRole("checkbox", { name: "Choose Alex Rivera to return" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Choose Samantha Santos to return" })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Return selected (0)" })).toBeDisabled();
    expect(await latestOf(page, sandbox, "s0", courseworkId)).toMatchObject({ status: "returned", score: 15 });
    expect(await latestOf(page, sandbox, "s1", courseworkId)).toMatchObject({ status: "returned", score: 12 });
    expect(await latestOf(page, sandbox, "s2", courseworkId)).toMatchObject({ status: "submitted", score: null });
  });

  test("Download all work saves one zip; with nothing handed in it is disabled with the reason", async ({ page, sandbox }) => {
    const empty = await seedAssignment(page, sandbox, { title: "Nothing yet" });
    const { classId, courseworkId } = await seedAssignment(page, sandbox, { title: TITLE });
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), text: "My answer.", files: [pdfFile()] });
    await openRole(page, "instructor");

    await page.goto(gradingPath(empty.courseworkId));
    await expect(page.getByRole("button", { name: "Download all work (.zip)" })).toBeDisabled();
    await expect(page.getByText("Nobody has handed in work yet, so there is nothing to download.")).toBeVisible();

    await page.goto(gradingPath(courseworkId));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download all work (.zip)" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    await expect(toast(page, "Work downloaded")).toBeVisible();
  });

  test("zero axe violations and text ≥14px with Phase 3 on screen @all", async ({ page, sandbox }) => {
    test.slow(); // full axe scans (L-030)
    const rubric = await seedRubric(page, sandbox);
    const { classId, courseworkId } = await lateAssignment(page, sandbox, { latePenaltyPercentPerDay: 10, rubricId: rubric.id, gradeRelease: "returned" });
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
    const graded = await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s1"), files: [pdfFile("b.pdf", "b")] });
    await gradeWork(page, sandbox, classId, courseworkId, graded.id, { rubric: { [rubric.criteria[0]!.id]: rubric.criteria[0]!.levels[0]!.id, [rubric.criteria[1]!.id]: rubric.criteria[1]!.levels[0]!.id } });
    const now = await serverNow(page, sandbox);
    await extendFor(page, sandbox, classId, courseworkId, "s3", { dueAt: new Date(now.getTime() + DAY).toISOString() });
    await excuse(page, sandbox, classId, courseworkId, "s2");
    await openRole(page, "instructor");
    for (const query of ["", "?student=s0", "?filter=excused&student=s2", "?student=s3"]) {
      await page.goto(gradingPath(courseworkId, query));
      await expect(studentList(page)).toBeVisible();
      if (query.includes("s0")) await expect(page.getByRole("heading", { name: "Rubric: Lab report" })).toBeVisible();
      await expectNoAxeViolations(page);
      await expectReadableText(page);
    }
    // The dialogs.
    await page.getByRole("button", { name: "Change their own dates" }).click();
    await expect(page.getByRole("dialog", { name: "More time for Noah Villanueva" })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    await page.getByRole("button", { name: "Saved comments" }).click();
    await expect(page.getByRole("dialog", { name: "Saved comments" }).getByText("No saved comments yet.", { exact: false })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test("the Phase 3 grading page does not scroll sideways at 320px @mobile", async ({ page, sandbox }) => {
  const rubric = await seedRubric(page, sandbox);
  const { classId, courseworkId } = await lateAssignment(page, sandbox, { latePenaltyPercentPerDay: 10, rubricId: rubric.id, gradeRelease: "returned" });
  await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), files: [pdfFile()] });
  const now = await serverNow(page, sandbox);
  await extendFor(page, sandbox, classId, courseworkId, "s3", { dueAt: new Date(now.getTime() + DAY).toISOString() });
  await excuse(page, sandbox, classId, courseworkId, "s2");
  await page.setViewportSize({ width: 320, height: 640 });
  await openRole(page, "instructor");
  for (const query of ["", "?student=s0", "?filter=excused&student=s2", "?student=s3"]) {
    await page.goto(gradingPath(courseworkId, query));
    await expect(studentList(page)).toBeVisible();
    if (query.includes("s0")) await expect(page.getByRole("heading", { name: "Rubric: Lab report" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${query || "list"} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});
