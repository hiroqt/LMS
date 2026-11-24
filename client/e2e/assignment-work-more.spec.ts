import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { INSTRUCTOR, STUDENT, callApi, expect, test, type Page } from "./fixtures";
import { excuse, extendFor, gradeWork, rubricChoice, seedAssignment, seedRubric, serverNow, turnInWork } from "./assignmentFixtures";

// Assignments Phase 3 on the student's page (PR 3C, D-065): their own due date, being excused,
// what a late penalty did to a grade, and the rubric (docs/ASSIGNMENTS_API_CONTRACT.md §10–§12).
// Dates are built from the API's clock (L-087), whole days away from "now", so the browser's
// pinned clock and the API's agree on which side of a date they are.

const DAY = 86_400_000;
/** A whole minute `days` days from the API's "now" (negative for the past). */
const daysFrom = (now: Date, days: number) => new Date(Math.floor((now.getTime() + days * DAY) / 60_000) * 60_000);
/** As the page prints a date (`formatDue`), in the suite's time zone. */
const due = (date: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(date);

async function openWork(page: Page, courseworkId: string, title = "ER diagram") {
  await page.goto(`/student/assessments/${courseworkId}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const card = page.getByRole("region", { name: "Your work" });
  await expect(card).toBeVisible();
  return card;
}

async function tasksShow(page: Page, status: string, title: string, shown: boolean) {
  await page.goto(`/student/tasks?status=${encodeURIComponent(status)}`);
  await expect(page.getByRole("heading", { level: 2, name: status })).toBeVisible();
  const items = page.getByRole("button", { name: new RegExp(title) });
  if (shown) await expect(items).toHaveCount(1);
  else await expect(items).toHaveCount(0);
}

const returnAll = (page: Page, sandbox: string, courseworkId: string) =>
  callApi(page, sandbox, INSTRUCTOR, "POST", `/api/classes/biology/coursework/${courseworkId}/return`, {});

test.describe("Student · Phase 3 on the assignment page", () => {
  test("with an extension: their own due date in words, Turn in after the class's date, and not late", async ({ page, sandbox }) => {
    const now = await serverNow(page, sandbox);
    const classDue = daysFrom(now, -1);
    const ownDue = daysFrom(now, 3);
    const { courseworkId } = await seedAssignment(page, sandbox, { title: "Lab write-up", settings: { submissionKinds: ["text"], dueAt: classDue.toISOString(), allowLate: false } });
    await extendFor(page, sandbox, "biology", courseworkId, STUDENT.id, { dueAt: ownDue.toISOString() });

    const card = await openWork(page, courseworkId, "Lab write-up");
    const rules = page.getByRole("region", { name: "How to hand in" });
    await expect(rules).toContainText(`Your due date: ${due(ownDue)} (your instructor gave you more time).`);
    await expect(rules).not.toContainText(due(classDue));
    const details = page.getByRole("complementary", { name: "Assessment details" });
    await expect(details.getByText("Your due date")).toBeVisible();
    await expect(details).toContainText(due(ownDue));
    await expect(card.getByText("Assigned", { exact: true })).toBeVisible();
    await expect(card.getByText("Missing", { exact: true })).toHaveCount(0);

    await card.getByRole("textbox", { name: "Written answer" }).fill("Done after the class's due date.");
    await expect(card.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await card.getByRole("button", { name: "Turn in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toContainText("marked late");
    await dialog.getByRole("button", { name: "Turn in" }).click();
    const receipt = card.getByRole("region", { name: "Receipt" });
    await expect(receipt).toContainText("Version 1");
    await expect(receipt).not.toContainText("Late");
    await expect(card.getByText("Late", { exact: true })).toHaveCount(0);
  });

  test("lists show the student's own due date and do not call the work missing", async ({ page, sandbox }) => {
    const now = await serverNow(page, sandbox);
    const ownDue = daysFrom(now, 3);
    const { courseworkId } = await seedAssignment(page, sandbox, { title: "Lab write-up", settings: { dueAt: daysFrom(now, -1).toISOString(), allowLate: false } });
    await extendFor(page, sandbox, "biology", courseworkId, STUDENT.id, { dueAt: ownDue.toISOString() });
    await tasksShow(page, "Missing", "Lab write-up", false);
    await tasksShow(page, "Due soon", "Lab write-up", true);
    await expect(page.getByRole("button", { name: /Lab write-up/ })).toContainText(due(ownDue));
  });

  test("excused: says so, nothing to turn in, work already handed in stays, and it is not in the to-do", async ({ page, sandbox }) => {
    const now = await serverNow(page, sandbox);
    const { courseworkId } = await seedAssignment(page, sandbox, { title: "Field notes", settings: { dueAt: daysFrom(now, 3).toISOString() } });
    const handedIn = await seedAssignment(page, sandbox, { title: "Lab write-up", settings: { submissionKinds: ["text"], dueAt: daysFrom(now, 3).toISOString(), allowResubmission: true } });
    await turnInWork(page, sandbox, "biology", handedIn.courseworkId, { text: "My notes from the lab.", files: [] });
    await excuse(page, sandbox, "biology", courseworkId, STUDENT.id);
    await excuse(page, sandbox, "biology", handedIn.courseworkId, STUDENT.id);

    const card = await openWork(page, courseworkId, "Field notes");
    await expect(card.getByText("Excused", { exact: true })).toBeVisible();
    await expect(card).toContainText("Your instructor excused you from this assignment. There is nothing to hand in, and it does not count toward your grade.");
    await expect(card.getByRole("textbox")).toHaveCount(0);
    await expect(card.getByLabel("Choose files")).toHaveCount(0);
    await expect(card.getByRole("button", { name: /Turn in/ })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Assessment details" }).getByText("Excused").first()).toBeVisible();

    const other = await openWork(page, handedIn.courseworkId, "Lab write-up");
    await expect(other.getByText("Excused", { exact: true })).toBeVisible();
    await expect(other.getByRole("region", { name: "Receipt" })).toContainText("My notes from the lab.");
    await expect(other.getByRole("textbox")).toHaveCount(0);
    await expect(other.getByRole("button", { name: /Turn in|Take back/ })).toHaveCount(0);

    await tasksShow(page, "Due soon", "Field notes", false);
    await tasksShow(page, "Due this week", "Field notes", false);
    await tasksShow(page, "Missing", "Field notes", false);
  });

  test("late work with a penalty: what turning in now loses, the sum after grading, and waived", async ({ page, sandbox }) => {
    const now = await serverNow(page, sandbox);
    // Two calendar days before "now" (09:00 in Manila in the suite), so both clocks count 2 days.
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["text"], dueAt: daysFrom(now, -2).toISOString(), allowLate: true, latePenaltyPercentPerDay: 10, latePenaltyMaxPercent: 50 } });
    const card = await openWork(page, courseworkId);
    await expect(page.getByRole("region", { name: "How to hand in" })).toContainText("Late work loses 10% of its score for each day late, up to 50%.");
    await card.getByRole("textbox", { name: "Written answer" }).fill("Late, but done.");
    await expect(card.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await card.getByRole("button", { name: "Turn in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("This turn-in will be marked late. Turning in now is 2 days late: 20% comes off the score.");
    await dialog.getByRole("button", { name: "Turn in" }).click();
    await expect(card.getByRole("region", { name: "Receipt" })).toContainText("Version 1 · Late");
    await expect(card.getByRole("region", { name: "Your grade" })).toHaveCount(0);

    const [turnedIn] = await callApi<Array<{ id: number }>>(page, sandbox, STUDENT, "GET", `/api/classes/biology/coursework/${courseworkId}/my-submissions`);
    const graded = await gradeWork(page, sandbox, "biology", courseworkId, turnedIn!.id, { points: 18 });
    expect(graded).toMatchObject({ rawScore: 18, score: 14.4, penaltyPercent: 20, daysLate: 2 });
    await page.reload();
    const grade = page.getByRole("region", { name: "Your grade" });
    await expect(grade).toContainText("Points given:18 of 20 points");
    await expect(grade).toContainText("Late penalty:20% off, 2 days late");
    await expect(grade).toContainText("Your score:14.4 of 20 points");
    await expect(grade).toContainText("The work was 2 days late, so 20% came off: 18 − 3.6 = 14.4.");

    await gradeWork(page, sandbox, "biology", courseworkId, turnedIn!.id, { points: 18, waivePenalty: true });
    await page.reload();
    await expect(grade).toContainText("Late penalty waived. The work was 2 days late, and nothing came off.");
    await expect(grade).toContainText("Your score:18 of 20 points");
    await expect(grade).not.toContainText("Points given");
  });

  test("the rubric before handing in, and the chosen levels on the grade", async ({ page, sandbox }) => {
    const rubric = await seedRubric(page, sandbox);
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["text"], rubricId: rubric.id, allowResubmission: true } });
    await openWork(page, courseworkId);
    const brief = page.getByRole("region", { name: "Rubric" });
    await expect(brief.getByRole("group", { name: /Analysis · up to 10 points/ })).toBeVisible();
    await expect(brief.getByRole("group", { name: /Presentation · up to 5 points/ })).toBeVisible();
    await expect(brief).toContainText("15 points in all");
    await expect(brief.getByRole("radio")).toHaveCount(0);

    const submission = await turnInWork(page, sandbox, "biology", courseworkId, { text: "My report.", files: [] });
    await gradeWork(page, sandbox, "biology", courseworkId, submission.id, { rubric: rubricChoice(rubric, { Analysis: "Partial", Presentation: "Clear" }) });
    await page.reload();
    const grade = page.getByRole("region", { name: "Your grade" });
    await expect(grade).toContainText("Your score:10 of 15 points");
    const levels = grade.getByRole("region", { name: "Rubric" });
    await expect(levels.getByRole("group", { name: /Analysis/ })).toContainText("5 points · Chosen");
    await expect(levels.getByRole("group", { name: /Presentation/ })).toContainText("5 points · Chosen");
    await expect(levels).toContainText("10 of 15 points");
    // Shown once: the brief leaves the rubric to the grade.
    await expect(page.getByRole("region", { name: "Rubric" })).toHaveCount(1);
  });

  test("a grade held until returned shows no penalty sum or rubric levels until it is returned", async ({ page, sandbox }) => {
    const now = await serverNow(page, sandbox);
    const rubric = await seedRubric(page, sandbox);
    const { courseworkId } = await seedAssignment(page, sandbox, {
      settings: { submissionKinds: ["text"], rubricId: rubric.id, gradeRelease: "returned", dueAt: daysFrom(now, -2).toISOString(), allowLate: true, latePenaltyPercentPerDay: 10 },
    });
    const submission = await turnInWork(page, sandbox, "biology", courseworkId, { text: "My report.", files: [] });
    await gradeWork(page, sandbox, "biology", courseworkId, submission.id, { rubric: rubricChoice(rubric, { Analysis: "Complete", Presentation: "Clear" }) });

    const card = await openWork(page, courseworkId);
    await expect(card.getByRole("region", { name: "Receipt" })).toContainText("Late");
    await expect(page.getByRole("region", { name: "Your grade" })).toHaveCount(0);
    await expect(page.getByText(/Chosen/)).toHaveCount(0);
    await expect(page.getByText(/came off/)).toHaveCount(0);
    // The rubric itself is still there to read.
    await expect(page.getByRole("region", { name: "Rubric" })).toContainText("15 points in all");

    await returnAll(page, sandbox, courseworkId);
    await page.reload();
    const grade = page.getByRole("region", { name: "Your grade" });
    await expect(grade).toContainText("Points given:15 of 15 points");
    await expect(grade).toContainText("Late penalty:20% off, 2 days late");
    await expect(grade).toContainText("Your score:12 of 15 points");
    await expect(grade.getByRole("region", { name: "Rubric" }).getByRole("group", { name: /Analysis/ })).toContainText("10 points · Chosen");
  });
});

test.describe("Student · Phase 3: accessibility and small screens", () => {
  async function seedGradedLateWithRubric(page: Page, sandbox: string) {
    const now = await serverNow(page, sandbox);
    const rubric = await seedRubric(page, sandbox);
    const { courseworkId } = await seedAssignment(page, sandbox, {
      settings: { submissionKinds: ["text"], rubricId: rubric.id, dueAt: daysFrom(now, -2).toISOString(), allowLate: true, latePenaltyPercentPerDay: 10 },
    });
    const submission = await turnInWork(page, sandbox, "biology", courseworkId, { text: "My report.", files: [] });
    await gradeWork(page, sandbox, "biology", courseworkId, submission.id, { rubric: rubricChoice(rubric, { Analysis: "Partial", Presentation: "Unclear" }) });
    return courseworkId;
  }

  test("zero axe violations and readable text with the rubric, the grade sum, an extension, and excused @all", async ({ page, sandbox }) => {
    const rubric = await seedRubric(page, sandbox);
    const now = await serverNow(page, sandbox);
    const before = await seedAssignment(page, sandbox, { title: "Lab write-up", settings: { rubricId: rubric.id, dueAt: daysFrom(now, -1).toISOString() } });
    await extendFor(page, sandbox, "biology", before.courseworkId, STUDENT.id, { dueAt: daysFrom(now, 3).toISOString() });
    await openWork(page, before.courseworkId, "Lab write-up");
    await expect(page.getByRole("region", { name: "Rubric" })).toContainText("15 points in all");
    await expectNoAxeViolations(page);
    await expectReadableText(page);

    const graded = await seedGradedLateWithRubric(page, sandbox);
    await openWork(page, graded);
    await expect(page.getByRole("region", { name: "Your grade" })).toContainText("Late penalty");
    await expectNoAxeViolations(page);
    await expectReadableText(page);

    const excused = await seedAssignment(page, sandbox, { title: "Field notes" });
    await excuse(page, sandbox, "biology", excused.courseworkId, STUDENT.id);
    const card = await openWork(page, excused.courseworkId, "Field notes");
    await expect(card.getByText("Excused", { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("no sideways scroll at 320px with the rubric and the grade sum @all", async ({ page, sandbox }) => {
    const courseworkId = await seedGradedLateWithRubric(page, sandbox);
    await page.setViewportSize({ width: 320, height: 640 });
    await openWork(page, courseworkId);
    await expect(page.getByRole("region", { name: "Your grade" }).getByRole("region", { name: "Rubric" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
