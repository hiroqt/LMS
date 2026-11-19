import { callApi, expect, INSTRUCTOR, openRole, STUDENT, test, type Page, uploadAsStudent } from "./fixtures";

// Closing an activity once every student is graded (D-036): INSTRUCTOR_USER_FLOW CLOSE and
// STUDENT_USER_FLOW CLOSED. Every demo student (12) is in the biology class.

const TITLE = "Lab report 1";
const workRow = (page: Page) => page.getByRole("main").getByRole("listitem").filter({ has: page.getByText(TITLE, { exact: true }) }).first();

async function setUp(page: Page, sandbox: string): Promise<string> {
  const [unit] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
  const work = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", "/api/classes/biology/coursework", {
    type: "assignment", moduleId: unit!.id, title: TITLE, maxPoints: 10, status: "published",
    // Past due (the demo clock is 2026-10-23) so non-submitters can be graded; late work lets Alex hand in.
    dueAt: "2026-10-22T09:00:00Z", allowLate: true,
  });
  // Alex hands in; the other eleven hand in nothing.
  await uploadAsStudent(page, sandbox, `/api/classes/biology/coursework/${work.id}/draft/files`, { name: "lab-report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n%%EOF\n", "latin1") });
  await callApi(page, sandbox, STUDENT, "POST", `/api/classes/biology/coursework/${work.id}/draft/turn-in`, { honorStatement: true });
  return String(work.id);
}

test.describe("Close an activity @all", () => {
  test("CLOSE → CLOSED: refused with the ungraded list, then grades for everyone, then closed", async ({ page, sandbox }) => {
    const id = await setUp(page, sandbox);
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Classwork");
    const row = workRow(page);
    await expect(row.getByText("0 of 12 graded")).toBeVisible();

    // Closing is refused and names who is left.
    await row.getByRole("button", { name: `Close ${TITLE}` }).click();
    const left = page.getByRole("list", { name: `Still to grade for ${TITLE}` });
    await expect(left.getByRole("listitem")).toHaveCount(12);
    await expect(left.getByRole("listitem").filter({ hasText: "Alex Rivera" })).toBeVisible();
    await expect(row.getByText("Published")).toBeVisible();

    // Give 0 to the eleven who handed in nothing.
    await page.getByRole("button", { name: "Grade in Submissions" }).click();
    await expect(page.getByRole("tab", { name: /^Submissions/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("combobox", { name: "Assignment or assessment" }).selectOption({ label: TITLE });
    await expect(page.getByRole("list", { name: `Didn't hand in ${TITLE}` }).getByRole("listitem")).toHaveCount(11);
    await page.getByRole("button", { name: "Give 0 to everyone who didn't hand in" }).click();
    const dialog = page.getByRole("dialog", { name: "Grade everyone who didn't hand in?" });
    await expect(dialog.getByRole("spinbutton", { name: /Points for each student/ })).toHaveValue("0");
    await dialog.getByRole("button", { name: "Give the grade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "for 11 students who didn't hand in" })).toBeVisible();
    await expect(page.getByText("Everyone has handed in or has a grade.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Jamie Lee · Not handed in · 0 / 10" })).toBeVisible();

    // Grade the one who handed in.
    await page.getByRole("button", { name: /Alex Rivera · Assignment · awaiting grade/ }).click();
    await page.getByRole("spinbutton", { name: /^Score/ }).fill("9");
    await page.getByRole("button", { name: "Save grade", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Grade saved" })).toBeVisible();

    // Now it closes.
    await page.getByRole("tab", { name: /^Classwork/ }).click();
    await expect(row.getByText("12 of 12 graded")).toBeVisible();
    await row.getByRole("button", { name: `Close ${TITLE}` }).click();
    await expect(row.getByRole("button", { name: `Reopen ${TITLE}` })).toBeVisible();
    await expect(row.getByText("Closed", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Alex sees it closed, with the grade and no way to hand in.
    await openRole(page, "student");
    await page.goto(`/student/assessments/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Closed. Your instructor is no longer accepting work" })).toBeVisible();
    await expect(page.getByText("Submitted · 9 / 10 points")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Turn in|Choose files|Take back)/ })).toHaveCount(0);

    // Jamie, who handed in nothing, sees "Not handed in" with the grade.
    await page.goto("/student");
    await page.getByRole("combobox", { name: "Choose demo student" }).selectOption({ label: "Jamie Lee" });
    await expect(page.getByRole("heading", { level: 1, name: /Jamie/ })).toBeVisible();
    await page.goto(`/student/assessments/${id}`);
    await expect(page.getByText("Not handed in · 0 / 10 points")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Turn in|Choose files|Take back)/ })).toHaveCount(0);
  });

  test("CLOSE: a closed activity reopens", async ({ page, sandbox }) => {
    const id = await setUp(page, sandbox);
    await callApi(page, sandbox, INSTRUCTOR, "POST", `/api/classes/biology/coursework/${id}/grade-missing`, { points: 0 });
    const submissions = await callApi<{ items: Array<{ id: number; notHandedIn?: boolean }> }>(page, sandbox, INSTRUCTOR, "GET", `/api/classes/biology/coursework/${id}/submissions`);
    const alex = submissions.items.find((item) => !item.notHandedIn);
    await callApi(page, sandbox, INSTRUCTOR, "PUT", `/api/classes/biology/coursework/${id}/submissions/${alex!.id}/grade`, { points: 7 });
    await callApi(page, sandbox, INSTRUCTOR, "POST", `/api/classes/biology/coursework/${id}/close`);

    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Classwork");
    const row = workRow(page);
    await row.getByRole("button", { name: `Reopen ${TITLE}` }).click();
    await expect(page.getByRole("status").filter({ hasText: `${TITLE} accepts work again.` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Close ${TITLE}` })).toBeVisible();
    await expect(row.getByText("Published")).toBeVisible();
  });
});
