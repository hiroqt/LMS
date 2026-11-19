import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { pdfFile, pngFile, seedAssignment, textFile, turnInWork } from "./assignmentFixtures";
import { callApi, expect, INSTRUCTOR, openRole, test, type DemoViewer, type Page } from "./fixtures";

// The assignment grading page (D-061; ASSIGNMENTS_PLAN "Instructor"; contract §3, §4, §6, §8):
// the class list with filters, one student's work with the file viewer, Save and next, Return,
// and grades for students who handed in nothing. Work is handed in with real files through the
// draft API in each test's sandbox. The demo clock is 2026-10-23 09:00 in Manila.

const TITLE = "ER diagram";
const student = (id: string): DemoViewer => ({ id, role: "student" });
const PAST_DUE = "2026-10-22T09:00:00Z";

/**
 * Alex Rivera (s0) hands in a written answer, a link, a PDF, a photo and a text file, and Samantha
 * Santos (s2) the same PDF (no due date yet). Then the due date moves to yesterday with late work
 * allowed, and Jamie Lee (s1) hands in. The other nine hand in nothing. `late` is worked out from
 * the due date when it is read, so all three are late; with `onTimeFirst` the due date is set just
 * after Samantha's turn-in instead (the API's clock runs on from the demo instant), so only Jamie is.
 */
async function seedClassWork(page: Page, sandbox: string, settings: Record<string, unknown> = {}, onTimeFirst = false) {
  const work = await seedAssignment(page, sandbox, { title: TITLE, settings: { submissionKinds: ["text", "file", "link"], allowResubmission: true, ...settings } });
  const { classId, courseworkId } = work;
  await turnInWork(page, sandbox, classId, courseworkId, {
    viewer: student("s0"), text: "Entities and relationships are in the PDF.", link: "https://example.com/er-diagram",
    files: [pdfFile("er-diagram.pdf"), pngFile("whiteboard.png"), textFile("notes.txt", "Entities: Student, Class, <b>Enrollment</b>.")],
  });
  const samantha = (await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s2"), files: [pdfFile("my-diagram.pdf")] })) as { submittedAt?: string };
  const dueAt = onTimeFirst ? new Date(Date.parse(samantha.submittedAt!) + 1).toISOString() : PAST_DUE;
  await callApi(page, sandbox, INSTRUCTOR, "PATCH", `/api/classes/${classId}/coursework/${courseworkId}`, { dueAt, allowLate: true });
  await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s1"), files: [pdfFile("late.pdf", "Late diagram")] });
  return work;
}

const gradingPath = (id: string, query = "") => `/instructor/classes/biology/assignments/${id}/grading${query}`;
const chip = (page: Page, name: string) => page.getByRole("group", { name: "Show students" }).getByRole("button", { name: new RegExp(`^${name}\\s?\\d+$`) });
const studentList = (page: Page) => page.getByRole("list", { name: `Students for ${TITLE}` });
const row = (page: Page, name: string) => studentList(page).getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("Assignment grading", () => {
  test("Classwork opens it; the filters count students; the URL keeps the filter and the student", async ({ page, sandbox }) => {
    await seedClassWork(page, sandbox, {}, true);
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Classwork");
    await page.getByRole("button", { name: `Grading for ${TITLE}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();

    await expect(chip(page, "All")).toHaveText(/12$/);
    await expect(chip(page, "Needs grading")).toHaveText(/3$/);
    await expect(chip(page, "Late")).toHaveText(/1$/);
    await expect(chip(page, "Missing")).toHaveText(/9$/);
    await expect(chip(page, "Graded")).toHaveText(/0$/);
    await expect(chip(page, "Returned")).toHaveText(/0$/);
    await expect(studentList(page).getByRole("listitem")).toHaveCount(12);

    await chip(page, "Late").click();
    await expect(chip(page, "Late")).toHaveAttribute("aria-pressed", "true");
    await expect(studentList(page).getByRole("listitem")).toHaveCount(1);
    await row(page, "Jamie Lee").click();
    await expect(page.getByRole("heading", { level: 2, name: "Jamie Lee" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Late", { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/filter=late/);
    await expect(page).toHaveURL(/student=s1/);

    await page.reload();
    await expect(chip(page, "Late")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Jamie Lee" })).toBeVisible();
    await expect(row(page, "Jamie Lee")).toHaveAttribute("aria-current", "true");

    await chip(page, "Missing").click();
    await expect(studentList(page).getByRole("listitem")).toHaveCount(9);
    await expect(studentList(page).getByText("Jamie Lee")).toHaveCount(0);
  });

  test("one student's work: the answer, a safe link, and a PDF, a photo and a text file in the viewer", async ({ page, sandbox }) => {
    const { courseworkId } = await seedClassWork(page, sandbox);
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    const work = page.getByRole("region", { name: "Alex Rivera" });
    await expect(work.getByText("Entities and relationships are in the PDF.")).toBeVisible();
    await expect(work.getByText(/^Turned in /)).toBeVisible();
    const link = work.getByRole("link", { name: /https:\/\/example\.com\/er-diagram/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // The first file that can be shown opens at once: the PDF, in a framed viewer from a blob.
    const pdf = work.getByTitle("PDF: er-diagram.pdf");
    await expect(pdf).toBeVisible();
    await expect(pdf).toHaveAttribute("src", /^blob:/);
    // The same bytes as Samantha's PDF.
    await expect(work.getByRole("listitem").filter({ hasText: "er-diagram.pdf" }).getByText("Same file as another student")).toBeVisible();
    await expect(work.getByRole("listitem").filter({ hasText: "whiteboard.png" }).getByText("Same file as another student")).toHaveCount(0);

    await work.getByRole("button", { name: "View whiteboard.png" }).click();
    const image = work.getByRole("img", { name: "whiteboard.png" });
    await expect(image).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);

    await work.getByRole("button", { name: "View notes.txt" }).click();
    const text = work.getByRole("region", { name: "Text of notes.txt" });
    // Shown as text, never as HTML.
    await expect(text).toHaveText("Entities: Student, Class, <b>Enrollment</b>.");
    await expect(text.locator("b")).toHaveCount(0);

    const download = page.waitForEvent("download");
    await work.getByRole("button", { name: "Download notes.txt" }).click();
    expect((await download).suggestedFilename()).toBe("notes.txt");
  });

  test("Save and next grades in list order; a score out of range is refused on the field", async ({ page, sandbox }) => {
    const { courseworkId } = await seedClassWork(page, sandbox);
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?filter=needs-grading&student=s0"));
    const work = page.getByRole("region", { name: "Alex Rivera" });
    await work.getByRole("spinbutton", { name: /Score/ }).fill("25");
    await work.getByRole("button", { name: "Save and next" }).click();
    await expect(work.getByText("Enter a score from 0 to 20.")).toBeVisible();

    await work.getByRole("spinbutton", { name: /Score/ }).fill("17");
    await work.getByRole("textbox", { name: /Feedback/ }).fill("Clear diagram.");
    await work.getByRole("button", { name: "Save and next" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Grade saved" })).toBeVisible();
    // Lee, Rivera, Santos: after Alex comes Samantha.
    await expect(page.getByRole("heading", { level: 2, name: "Samantha Santos" })).toBeVisible();
    await expect(page).toHaveURL(/student=s2/);
    await expect(chip(page, "Graded")).toHaveText(/1$/);
    await expect(chip(page, "Needs grading")).toHaveText(/2$/);
    await expect(page.getByRole("main").getByText("1 of 12 graded")).toBeVisible();

    await page.getByRole("region", { name: "Samantha Santos" }).getByRole("spinbutton", { name: /Score/ }).fill("12");
    await page.getByRole("region", { name: "Samantha Santos" }).getByRole("button", { name: "Save and next" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Jamie Lee" })).toBeVisible();

    const mine = await callApi<Array<{ status: string; score: number | null; feedback: string | null }>>(page, sandbox, student("s0"), "GET", `/api/classes/biology/coursework/${courseworkId}/my-submissions`);
    expect(mine.at(-1)).toMatchObject({ status: "graded", score: 17, feedback: "Clear diagram." });
  });

  test("grades wait until returned: the student sees nothing, then Return shows it", async ({ page, sandbox }) => {
    const { courseworkId } = await seedClassWork(page, sandbox, { gradeRelease: "returned" });
    const mine = async (id: string) => (await callApi<Array<{ status: string; score: number | null }>>(page, sandbox, student(id), "GET", `/api/classes/biology/coursework/${courseworkId}/my-submissions`)).at(-1);
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s1"));
    await expect(page.getByText("Students don't see grades until you return them.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Return all graded" })).toBeDisabled();

    // Grade Jamie, then Alex (next in list order); both are held.
    await page.getByRole("region", { name: "Jamie Lee" }).getByRole("spinbutton", { name: /Score/ }).fill("10");
    await page.getByRole("region", { name: "Jamie Lee" }).getByRole("button", { name: "Save and next" }).click();
    const alex = page.getByRole("region", { name: "Alex Rivera" });
    await alex.getByRole("spinbutton", { name: /Score/ }).fill("18");
    await alex.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alex Rivera · 18 / 20. Not returned yet." })).toBeVisible();
    await expect(row(page, "Alex Rivera")).toContainText("Graded, not returned · 18 / 20");
    await expect(chip(page, "Graded")).toHaveText(/2$/);
    expect(await mine("s0")).toMatchObject({ status: "submitted", score: null });

    // Return only Alex, confirmed with how many; Jamie's grade stays held.
    await alex.getByRole("button", { name: "Return to Alex Rivera" }).click();
    const one = page.getByRole("dialog", { name: "Return Alex Rivera's work?" });
    await expect(one.getByText("1 student will see their grade and feedback", { exact: false })).toBeVisible();
    await one.getByRole("button", { name: "Return" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Returned to 1 student" })).toBeVisible();
    await expect(row(page, "Alex Rivera")).toContainText("Returned · 18 / 20");
    expect(await mine("s0")).toMatchObject({ status: "returned", score: 18 });
    expect(await mine("s1")).toMatchObject({ status: "submitted", score: null });

    // Grade Samantha, then return all graded: Jamie and Samantha.
    await row(page, "Samantha Santos").click();
    await page.getByRole("region", { name: "Samantha Santos" }).getByRole("spinbutton", { name: /Score/ }).fill("15");
    await page.getByRole("region", { name: "Samantha Santos" }).getByRole("button", { name: "Save", exact: true }).click();
    await expect(chip(page, "Graded")).toHaveText(/2$/);

    await page.getByRole("button", { name: "Return all graded" }).click();
    const all = page.getByRole("dialog", { name: "Return all graded work?" });
    await expect(all.getByText("2 students will see their grade and feedback", { exact: false })).toBeVisible();
    await all.getByRole("button", { name: "Return to 2 students" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Returned to 2 students" })).toBeVisible();
    await expect(chip(page, "Returned")).toHaveText(/3$/);
    expect(await mine("s1")).toMatchObject({ status: "returned", score: 10 });
  });

  test("students who handed in nothing: graded after the last day, and the reason before it", async ({ page, sandbox }) => {
    // Before the due date: the server's sentence, no grade form.
    const early = await seedAssignment(page, sandbox, { title: "Early work", settings: { dueAt: "2026-10-30T09:00:00Z" } });
    await openRole(page, "instructor");
    await page.goto(`/instructor/classes/biology/assignments/${early.courseworkId}/grading?student=s3`);
    await expect(page.getByRole("heading", { level: 2, name: "Noah Villanueva" })).toBeVisible();
    await expect(page.getByText("Students can still hand in until the due date. Grade those who didn't hand in after it passes.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Give a grade without work" })).toHaveCount(0);

    // After it: one student, then everyone left.
    const { courseworkId } = await seedClassWork(page, sandbox);
    await page.goto(gradingPath(courseworkId, "?filter=missing&student=s3"));
    const noah = page.getByRole("region", { name: "Noah Villanueva" });
    await noah.getByRole("button", { name: "Give a grade without work" }).click();
    await noah.getByRole("spinbutton", { name: /Score for Noah Villanueva/ }).fill("2");
    await noah.getByRole("button", { name: "Save grade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Noah Villanueva · Not handed in · 2 / 20" })).toBeVisible();
    await expect(row(page, "Noah Villanueva")).toContainText("Not handed in · Graded · 2 / 20");

    await page.getByRole("button", { name: "Give 0 to everyone who didn't hand in" }).click();
    const dialog = page.getByRole("dialog", { name: "Grade everyone who didn't hand in?" });
    await expect(dialog.getByText("8 students with nothing handed in", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Give the grade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "0 / 20 for 8 students who didn't hand in" })).toBeVisible();
    await expect(chip(page, "Graded")).toHaveText(/9$/);
    await expect(page.getByRole("heading", { name: "Didn't hand in" })).toHaveCount(0);
  });

  test("earlier versions are listed and can be opened; the grade goes on the latest", async ({ page, sandbox }) => {
    const { classId, courseworkId } = await seedClassWork(page, sandbox);
    // Alex hands in again: a new draft starts as a copy of version 1, then gets a new answer.
    await turnInWork(page, sandbox, classId, courseworkId, { viewer: student("s0"), text: "Second try: added the cardinalities.", files: [] });
    await openRole(page, "instructor");
    await page.goto(gradingPath(courseworkId, "?student=s0"));
    const work = page.getByRole("region", { name: "Alex Rivera" });
    await expect(work.getByRole("heading", { name: "Version 2" })).toBeVisible();
    await expect(work.getByText("Second try: added the cardinalities.")).toBeVisible();
    const versions = work.getByRole("list", { name: "Versions from Alex Rivera" });
    await expect(versions.getByRole("button")).toHaveCount(2);
    await versions.getByRole("button", { name: /^Version 1/ }).click();
    await expect(work.getByRole("heading", { name: "Version 1 (earlier version)" })).toBeVisible();
    await expect(work.getByText("Entities and relationships are in the PDF.")).toBeVisible();
    await expect(work.getByText("The grade goes on the latest version, Version 2.")).toBeVisible();
    await expect(versions.getByRole("button", { name: /^Version 1/ })).toHaveAttribute("aria-current", "true");
  });

  test("the Submissions tab shows the files and opens the grading page", async ({ page, sandbox }) => {
    const { courseworkId } = await seedClassWork(page, sandbox);
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Submissions");
    await page.getByRole("button", { name: new RegExp(`^${TITLE}\\s+Alex Rivera`) }).click();
    await expect(page.getByText("whiteboard.png")).toBeVisible();
    await expect(page.getByRole("link", { name: /https:\/\/example\.com\/er-diagram/ })).toHaveAttribute("rel", "noopener noreferrer");
    await page.getByRole("button", { name: "Open the grading page" }).click();
    await expect(page).toHaveURL(new RegExp(`/assignments/${courseworkId}/grading\\?student=s0$`));
    await expect(page.getByRole("heading", { level: 2, name: "Alex Rivera" })).toBeVisible();
  });

  test("zero axe violations and text ≥14px @all", async ({ page, sandbox }) => {
    test.slow(); // full axe scans (L-030)
    const { courseworkId } = await seedClassWork(page, sandbox, { gradeRelease: "returned" });
    await openRole(page, "instructor");
    for (const query of ["", "?student=s0", "?filter=missing&student=s3"]) {
      await page.goto(gradingPath(courseworkId, query));
      await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
      await expect(studentList(page)).toBeVisible();
      if (query.includes("s0")) await expect(page.getByTitle("PDF: er-diagram.pdf")).toBeVisible();
      await expectNoAxeViolations(page);
      await expectReadableText(page);
    }
  });
});

test("the grading page does not scroll sideways at 320px @mobile", async ({ page, sandbox }) => {
  const { courseworkId } = await seedClassWork(page, sandbox);
  await page.setViewportSize({ width: 320, height: 640 });
  await openRole(page, "instructor");
  for (const query of ["", "?student=s0", "?filter=missing&student=s3"]) {
    await page.goto(gradingPath(courseworkId, query));
    await expect(studentList(page)).toBeVisible();
    if (query.includes("s0")) {
      await page.getByRole("button", { name: "View notes.txt" }).click();
      await expect(page.getByRole("region", { name: "Text of notes.txt" })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${query || "list"} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});
