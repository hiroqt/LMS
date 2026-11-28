import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { INSTRUCTOR, STUDENT, callApi, expect, test, type Page } from "./fixtures";
import { flaggedFile, pdfFile, pngFile, renamedProgram, seedAssignment, textFile, uploadWorkFile } from "./assignmentFixtures";

// The student's "Your work" card (Assignments PR 2C, D-060): a draft that saves itself, real file
// uploads, Turn in with a receipt, Take back, new versions. The server decides every rule
// (docs/ASSIGNMENTS_API_CONTRACT.md §2, §5–§8); these journeys check the page shows its verdict.

/** A week after the suite's "today" (fixtures.ts), so resubmission and Take back are open. */
const NEXT_WEEK = "2026-10-30T23:59:00+08:00";
const LAST_WEEK = "2026-10-16T23:59:00+08:00";

interface Row { id: number; status: string; attemptNumber: number; text: string | null; files: Array<{ name: string; code: string }> }

const mine = (page: Page, sandbox: string, id: string) => callApi<Row[]>(page, sandbox, STUDENT, "GET", `/api/classes/biology/coursework/${id}/my-submissions`);
const instructorList = (page: Page, sandbox: string, id: string) =>
  callApi<{ items: Row[] }>(page, sandbox, INSTRUCTOR, "GET", `/api/classes/biology/coursework/${id}/submissions`);

async function openWork(page: Page, courseworkId: string, title = "ER diagram") {
  await page.goto(`/student/assessments/${courseworkId}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const card = page.getByRole("region", { name: "Your work" });
  await expect(card).toBeVisible();
  return card;
}

const INSTRUCTIONS = "Draw the diagram for the enrollment system.";

/** D-073: the instructions and the rules (and the header line that repeats them) show only while there is work to do. */
async function expectBrief(page: Page, shown: boolean) {
  await expect(page.getByRole("region", { name: "Instructions" })).toHaveCount(shown ? 1 : 0);
  await expect(page.getByRole("region", { name: "How to hand in" })).toHaveCount(shown ? 1 : 0);
  await expect(page.getByText(INSTRUCTIONS)).toHaveCount(shown ? 2 : 0);
}

async function confirmTurnIn(page: Page) {
  await page.getByRole("button", { name: /^Turn in( new version)?$/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Student · Your work on an assignment", () => {
  test("a written answer saves itself and is still there after a reload; opening the page creates nothing", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox);
    const card = await openWork(page, courseworkId);
    await expect(card.getByText("Assigned", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Instructions" })).toContainText(INSTRUCTIONS);
    await expect(page.getByRole("region", { name: "How to hand in" })).toContainText("You can hand in a written answer and up to 5 files.");
    expect(await mine(page, sandbox, courseworkId)).toEqual([]);

    await card.getByRole("textbox", { name: "Written answer" }).fill("Student, Class, and Enrollment are the entities.");
    await expect(card.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Written answer" })).toHaveValue("Student, Class, and Enrollment are the entities.");
    await expect(page.getByRole("region", { name: "Your work" }).getByText("Draft", { exact: true })).toBeVisible();
    expect((await mine(page, sandbox, courseworkId)).map((row) => row.status)).toEqual(["in_progress"]);
  });

  test("files upload and are listed; refused files show the server's sentence and are not kept", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["file"], allowedFileTypes: ["pdf", "text"], maxFiles: 2 } });
    const card = await openWork(page, courseworkId);
    const choose = card.getByLabel("Choose files");
    await expect(card.getByText("You can add 2 more files.")).toBeVisible();

    await choose.setInputFiles(pdfFile());
    await expect(card.getByRole("list", { name: "Files on your draft" })).toContainText("er-diagram.pdf");
    await expect(card.getByText("You can add 1 more file.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "File added" })).toBeVisible();

    const uploads = card.getByRole("list", { name: "Uploads" });
    // Refused by the server from the bytes, and by the (Demo-mode) virus scan.
    await choose.setInputFiles(renamedProgram());
    await expect(uploads.getByRole("listitem").filter({ hasText: "homework.pdf" })).toContainText("not accepted");
    await choose.setInputFiles(flaggedFile());
    await expect(uploads.getByRole("listitem").filter({ hasText: "infected.txt" })).toContainText("The virus scan flagged this file, so it was not saved.");
    // A type the assignment doesn't take is refused before it is sent.
    await choose.setInputFiles(pngFile());
    await expect(uploads.getByRole("listitem").filter({ hasText: "photo.png" })).toContainText("This assignment takes only: PDF, Text (.txt).");
    // One more than the assignment takes: the server refuses the second of two.
    await choose.setInputFiles([textFile(), pdfFile("second.pdf", "another diagram")]);
    await expect(uploads.getByRole("listitem").filter({ hasText: "second.pdf" })).toContainText("This assignment takes at most 2 files.");
    await expect(card.getByRole("list", { name: "Files on your draft" }).getByRole("listitem")).toHaveCount(2);
    await expect(card.getByText("No more files. This assignment takes at most 2 files.")).toBeVisible();
    await expect(choose).toBeDisabled();

    const [draft] = await mine(page, sandbox, courseworkId);
    expect(draft!.files.map((file) => file.name)).toEqual(["er-diagram.pdf", "notes.txt"]);

    // A failed file can be removed from the list; a stored one is removed after a confirmation that names it.
    await uploads.getByRole("button", { name: "Remove photo.png" }).click();
    await expect(uploads.getByRole("listitem").filter({ hasText: "photo.png" })).toHaveCount(0);
    await card.getByRole("button", { name: "Remove notes.txt" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove notes.txt?" });
    await dialog.getByRole("button", { name: "Remove file" }).click();
    await expect(dialog).toBeHidden();
    await expect(card.getByRole("list", { name: "Files on your draft" })).not.toContainText("notes.txt");
    await expect(card.getByRole("heading", { name: "Files" })).toBeFocused();
    // Retry sends the refused file again; with room now, it is stored.
    await uploads.getByRole("button", { name: "Retry second.pdf" }).click();
    await expect(card.getByRole("list", { name: "Files on your draft" })).toContainText("second.pdf");
  });

  test("turn in gives a receipt with codes that stays after a reload; take back, then new versions", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["text", "file", "link"], allowResubmission: true, dueAt: NEXT_WEEK } });
    const card = await openWork(page, courseworkId);
    await expectBrief(page, true);
    await card.getByRole("textbox", { name: "Written answer" }).fill("See the attached diagram.");
    await card.getByRole("textbox", { name: "Link" }).fill("https://docs.example.com/er");
    await card.getByLabel("Choose files").setInputFiles(pdfFile());
    await expect(card.getByRole("list", { name: "Files on your draft" })).toContainText("er-diagram.pdf");

    const dialog = await confirmTurnIn(page);
    await expect(dialog).toHaveAccessibleName("Turn in your work?");
    await expect(dialog).toContainText("Written answer:Yes");
    await expect(dialog).toContainText("Link:https://docs.example.com/er");
    await expect(dialog).toContainText("File 1:er-diagram.pdf");
    await dialog.getByRole("button", { name: "Turn in" }).click();

    const receipt = card.getByRole("region", { name: "Receipt" });
    await expect(receipt).toContainText("Version 1");
    await expect(receipt.getByRole("heading", { name: "Receipt" })).toBeFocused();
    await expect(card.getByText("Turned in", { exact: true })).toBeVisible();
    // Handed in: the instructions step aside (D-073), also after a reload.
    await expectBrief(page, false);
    const [turnedIn] = await mine(page, sandbox, courseworkId);
    const code = turnedIn!.files[0]!.code;
    await expect(receipt).toContainText(`Code ${code}`);
    await page.reload();
    await expect(page.getByRole("region", { name: "Receipt" })).toContainText(`Code ${code}`);
    await expectBrief(page, false);

    // The instructor now sees exactly this work.
    const list = await instructorList(page, sandbox, courseworkId);
    expect(list.items.map((row) => [row.attemptNumber, row.text, row.files.map((file) => file.code)])).toEqual([[1, "See the attached diagram.", [code]]]);

    // Take back: a draft again, and the instructor no longer sees it.
    await page.getByRole("button", { name: "Take back" }).click();
    await page.getByRole("dialog", { name: "Take back your work?" }).getByRole("button", { name: "Take back" }).click();
    await expect(page.getByRole("heading", { name: "Your draft" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Written answer" })).toHaveValue("See the attached diagram.");
    await expect(page.getByRole("region", { name: "Your work" }).getByText("Draft", { exact: true })).toBeVisible();
    await expectBrief(page, true);
    expect((await instructorList(page, sandbox, courseworkId)).items).toEqual([]);

    // Turn in again: version 2, with version 1 listed as taken back.
    await (await confirmTurnIn(page)).getByRole("button", { name: "Turn in" }).click();
    await expect(page.getByRole("region", { name: "Receipt" })).toContainText("Version 2");
    await expect(page.getByRole("region", { name: "Earlier versions" })).toContainText("Version 1 · Taken back");
    await expectBrief(page, false);

    // A new version starts as a copy of the last one, and brings the instructions back.
    await page.getByRole("button", { name: "Turn in a new version" }).click();
    await expect(page.getByRole("heading", { name: "New version" })).toBeVisible();
    await expectBrief(page, true);
    await expect(page.getByRole("textbox", { name: "Written answer" })).toHaveValue("See the attached diagram.");
    await page.getByRole("textbox", { name: "Written answer" }).fill("See the corrected diagram.");
    await expect(page.getByRole("region", { name: "Your work" }).getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    const again = await confirmTurnIn(page);
    await expect(again).toHaveAccessibleName("Turn in this new version?");
    await again.getByRole("button", { name: "Turn in" }).click();
    await expect(page.getByRole("region", { name: "Receipt" })).toContainText("Version 3");
    await expect(page.getByRole("region", { name: "Earlier versions" })).toContainText("Version 2 · Turned in");
    await expectBrief(page, false);
    expect((await instructorList(page, sandbox, courseworkId)).items.map((row) => [row.attemptNumber, row.text])).toEqual([[2, "See the attached diagram."], [3, "See the corrected diagram."]]);
  });

  test("the honor statement must be ticked, and late work is announced before and after", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["text"], honorStatement: true, dueAt: LAST_WEEK, allowLate: true } });
    const card = await openWork(page, courseworkId);
    await expect(card.getByText("Missing", { exact: true })).toBeVisible();
    await card.getByRole("textbox", { name: "Written answer" }).fill("My own answer.");
    await expect(card.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    const dialog = await confirmTurnIn(page);
    await expect(dialog).toContainText("This turn-in will be marked late.");
    const turnIn = dialog.getByRole("button", { name: "Turn in" });
    await expect(turnIn).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "This is my own work" }).check();
    await turnIn.click();
    await expect(card.getByRole("region", { name: "Receipt" })).toContainText("Version 1 · Late");
    await expect(card.getByText("Late", { exact: true })).toBeVisible();
  });

  test("past the due date with late work off: the reason, and nothing to edit", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { dueAt: LAST_WEEK, allowLate: false } });
    const card = await openWork(page, courseworkId);
    await expect(card).toContainText("The due date has passed and late submissions are turned off.");
    await expect(card.getByText("Missing", { exact: true })).toBeVisible();
    await expect(card.getByRole("textbox")).toHaveCount(0);
    await expect(card.getByLabel("Choose files")).toHaveCount(0);
    await expect(card.getByRole("button", { name: /Turn in/ })).toHaveCount(0);
  });

  test("offline: uploading and turning in say they need a connection; typing is kept and saves on reconnect", async ({ page, sandbox, context }) => {
    const { courseworkId } = await seedAssignment(page, sandbox);
    const card = await openWork(page, courseworkId);
    await context.setOffline(true);
    await expect(card.getByText(/You’re offline\. Uploading files and turning in need a connection\./)).toBeVisible();
    await expect(card.getByLabel("Choose files")).toBeDisabled();
    await expect(card.getByRole("button", { name: "Turn in", exact: true })).toBeDisabled();
    await card.getByRole("textbox", { name: "Written answer" }).fill("Written on the bus.");
    await expect(card.getByRole("status").filter({ hasText: /^Not saved, retrying$/ })).toBeVisible();
    await expect(card.getByRole("textbox", { name: "Written answer" })).toHaveValue("Written on the bus.");
    await context.setOffline(false);
    await expect(card.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await expect(card.getByRole("button", { name: "Turn in", exact: true })).toBeEnabled();
    expect((await mine(page, sandbox, courseworkId)).map((row) => row.text)).toEqual(["Written on the bus."]);
  });
});

test.describe("Student · Your work: accessibility and small screens", () => {
  test("zero axe violations and readable text on the draft, the dialog, and the receipt @all", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["text", "file", "link"], honorStatement: true, allowResubmission: true, dueAt: NEXT_WEEK } });
    await uploadWorkFile(page, sandbox, "biology", courseworkId, pdfFile());
    const card = await openWork(page, courseworkId);
    await expect(card.getByRole("list", { name: "Files on your draft" })).toContainText("er-diagram.pdf");
    await expectNoAxeViolations(page);
    await expectReadableText(page);
    const dialog = await confirmTurnIn(page);
    await expectNoAxeViolations(page);
    await dialog.getByRole("checkbox", { name: "This is my own work" }).check();
    await dialog.getByRole("button", { name: "Turn in" }).click();
    await expect(card.getByRole("region", { name: "Receipt" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
  });

  test("no sideways scroll at 320px, with a long file name and a link @all", async ({ page, sandbox }) => {
    const { courseworkId } = await seedAssignment(page, sandbox, { settings: { submissionKinds: ["text", "file", "link"], allowResubmission: true, dueAt: NEXT_WEEK } });
    await callApi(page, sandbox, STUDENT, "PUT", `/api/classes/biology/coursework/${courseworkId}/draft`, { text: "Answer.", link: "https://docs.example.com/a-very-long-address/that-keeps-going/and-going/er-diagram-final-version" });
    await uploadWorkFile(page, sandbox, "biology", courseworkId, pdfFile("entity-relationship-diagram-for-the-enrollment-system-final-version.pdf"));
    await page.setViewportSize({ width: 320, height: 640 });
    const card = await openWork(page, courseworkId);
    await expect(card.getByRole("list", { name: "Files on your draft" })).toBeVisible();
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await (await confirmTurnIn(page)).getByRole("button", { name: "Turn in" }).click();
    await expect(card.getByRole("region", { name: "Receipt" })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
  });
});
