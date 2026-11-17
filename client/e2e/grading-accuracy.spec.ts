import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { callApi, expect, INSTRUCTOR, openRole, test, type DemoViewer, type Page } from "./fixtures";

// Grading and accuracy tools (D-042, ASSESSMENTS_API_CONTRACT §5, §6): answers beside the key,
// a typed-answer points override, the spelling review list, item analysis, and fixing the key.
// The exam is built through the API in each test's sandbox; it needs the assessments API.

const TITLE = "Quiz: computer basics";
const student = (id: string): DemoViewer => ({ id, role: "student" });

interface AttemptQuestion {
  id: number;
  type: string;
  options: Array<{ id: number; text: string }>;
}

interface Seeded {
  examId: string;
  setId: number;
}

/**
 * One exam in Introduction to Programming (spelling mode "review") with three questions, and
 * four submitted attempts:
 *   1. identification "The father of computers." (Charles Babbage / Babbage), 1 point
 *   2. multiple choice with a wrong key ("var" marked correct), 1 point
 *   3. modified true or false "The CPU stores data permanently." (False: storage / hard disk), 2 points
 * Alex writes "Babage" and Jamie "Charles Babage" (near misses held for review); Samantha writes
 * "Edison"; Noah writes "Babbage". Three of four choose "const", so question 2 is flagged.
 */
async function seedExam(page: Page, sandbox: string): Promise<Seeded> {
  const [unit] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
  const set = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", "/api/questionnaires", { title: TITLE });
  await callApi(page, sandbox, INSTRUCTOR, "PUT", `/api/questionnaires/${set.id}/questions`, {
    questions: [
      { type: "identification", prompt: "The father of computers.", points: 1, expectedAnswers: ["Charles Babbage", "Babbage"] },
      { type: "multiple_choice", prompt: "Which keyword declares a constant in C#?", points: 1, options: [{ text: "var", isCorrect: true }, { text: "const", isCorrect: false }] },
      { type: "modified_true_false", prompt: "The CPU stores data permanently.", points: 2, underlined: "CPU", correctAnswer: false, expectedAnswers: ["storage", "hard disk"] },
    ],
  });
  const exam = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", "/api/classes/biology/coursework", {
    type: "exam", moduleId: unit!.id, title: TITLE, category: "Assessment", instructions: "Answer every question.",
    maxAttempts: 1, timeLimitMinutes: 0, questionnaireId: set.id, spellingMode: "review", status: "published",
  });
  const base = `/api/classes/biology/coursework/${exam.id}`;

  const take = async (id: string, identification: string, choice: "var" | "const", statement: { answer: "True" | "False"; correction?: string }) => {
    const attempt = await callApi<{ id: number; questions: AttemptQuestion[] }>(page, sandbox, student(id), "POST", `${base}/attempts`);
    const byType = (type: string) => attempt.questions.find((question) => question.type === type)!;
    const optionId = (type: string, text: string) => byType(type).options.find((option) => option.text === text)!.id;
    await callApi(page, sandbox, student(id), "POST", `${base}/attempts/${attempt.id}/submit`, {
      answers: [
        { questionId: byType("identification").id, text: identification },
        { questionId: byType("multiple_choice").id, optionId: optionId("multiple_choice", choice) },
        { questionId: byType("modified_true_false").id, optionId: optionId("modified_true_false", statement.answer), text: statement.correction },
      ],
    });
  };
  await take("s0", "Babage", "const", { answer: "False", correction: "storage" });
  await take("s1", "Charles Babage", "const", { answer: "True" });
  await take("s2", "Edison", "const", { answer: "False", correction: "hard disk" });
  await take("s3", "Babbage", "var", { answer: "False", correction: "memory" });
  return { examId: String(exam.id), setId: set.id };
}

const gradingPath = (examId: string, view?: string) => `/instructor/classes/biology/assessments/${examId}/grading${view ? `?view=${view}` : ""}`;
const gradingTab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Exam grading" }).getByRole("tab", { name });

test.describe("Instructor · grading and accuracy (GRADE)", () => {
  test("GRADE: an identification answer is shown beside its key, and its points can be overridden", async ({ page, sandbox }) => {
    const { examId } = await seedExam(page, sandbox);
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Submissions");
    await page.getByRole("button", { name: /Alex Rivera · Assessment · awaiting grade/ }).click();

    const form = page.getByRole("form", { name: TITLE });
    const first = form.getByRole("listitem").filter({ hasText: "The father of computers." });
    await expect(first.getByText("Babage", { exact: true })).toBeVisible();
    await expect(first.getByText("Charles Babbage, Babbage")).toBeVisible();
    await expect(first.getByText("Waiting for your review")).toBeVisible();
    // Modified true or false: the statement, the True/False chosen, and the correction.
    const third = form.getByRole("listitem").filter({ hasText: "stores data permanently" });
    await expect(third.getByText("storage", { exact: true })).toBeVisible();
    await expect(third.getByText("storage, hard disk")).toBeVisible();
    await expectNoAxeViolations(page);

    await form.getByRole("spinbutton", { name: "Points for question 1 (0–1)" }).fill("5");
    await form.getByRole("button", { name: "Save grade" }).click();
    await expect(form.getByText("Give 0 to 1 points.")).toBeVisible();
    await form.getByRole("spinbutton", { name: "Points for question 1 (0–1)" }).fill("1");
    await form.getByRole("button", { name: "Save grade" }).click();
    // 1 (override) + 0 (the key says "var") + 2 (False with "storage").
    await expect(page.getByRole("status").filter({ hasText: /Alex Rivera · 3 \/ 4/ })).toBeVisible();

    // The exam's grading page lists the attempt as graded, and the points stay corrected.
    await page.goto(gradingPath(examId));
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: /Alex Rivera Attempt 1 · graded 3 \/ 4/ })).toBeVisible();
    await page.getByRole("button", { name: /Samantha Santos Attempt 1/ }).click();
    await expect(page.getByRole("spinbutton", { name: "Points for question 1 (0–1)" })).toHaveValue("0");
  });

  test("SPELL: accept and reject near misses, with the count where the exam is managed", async ({ page, sandbox }) => {
    const { examId } = await seedExam(page, sandbox);
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Classwork");
    const row = page.getByRole("main").getByRole("listitem").filter({ has: page.getByText(TITLE, { exact: true }) }).first();
    await expect(row.getByText("2 spelling answers to review")).toBeVisible();
    await row.getByRole("button", { name: `Grading for ${TITLE}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await gradingTab(page, /^Spelling review/).click();
    await expect(page).toHaveURL(/view=spelling-review/);

    const table = page.getByRole("region", { name: `Spelling review for ${TITLE}` });
    const alex = table.getByRole("row").filter({ hasText: "Alex Rivera" });
    const jamie = table.getByRole("row").filter({ hasText: "Jamie Lee" });
    await expect(alex.getByText("Babage", { exact: true })).toBeVisible();
    await expect(alex.getByText("Charles Babbage, Babbage")).toBeVisible();
    await expect(alex.getByText("Waiting for your review")).toBeVisible();
    await expectNoAxeViolations(page);

    // A refused decision goes back, with an error toast.
    await page.route("**/spelling-review/**", (route) => (route.request().method() === "PUT" ? route.fulfill({ status: 500, body: "{}" }) : route.fallback()), { times: 1 });
    await alex.getByRole("button", { name: "Accept Alex Rivera, question 1" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Could not save the decision for Alex Rivera" })).toBeVisible();
    await expect(alex.getByRole("button", { name: "Accept Alex Rivera, question 1" })).toHaveAttribute("aria-pressed", "false");
    await expect(alex.getByText("Waiting for your review")).toBeVisible();

    await alex.getByRole("button", { name: "Accept Alex Rivera, question 1" }).click();
    await expect(alex.getByRole("button", { name: "Accept Alex Rivera, question 1" })).toHaveAttribute("aria-pressed", "true");
    await expect(alex.getByText("You accepted this spelling")).toBeVisible();
    await jamie.getByRole("button", { name: "Reject Jamie Lee, question 1" }).click();
    await expect(jamie.getByText("You marked this spelling wrong")).toBeVisible();
    await expect(gradingTab(page, /^Spelling review\s?0/)).toBeVisible();

    // The decisions stick after a reload, and the Classwork row has nothing left to review.
    await page.reload();
    await expect(page.getByRole("region", { name: `Spelling review for ${TITLE}` }).getByRole("row").filter({ hasText: "Jamie Lee" }).getByRole("button", { name: "Reject Jamie Lee, question 1" })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/instructor/classes/biology?tab=Classwork");
    await expect(row.getByText(/spelling answers? to review/)).toHaveCount(0);
    await page.goto(gradingPath(examId));
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  });

  test("KEY: item analysis flags a wrong key, and fixing it re-scores every attempt", async ({ page, sandbox }) => {
    const { examId, setId } = await seedExam(page, sandbox);
    await openRole(page, "instructor");
    await page.goto(gradingPath(examId, "item-analysis"));
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(gradingTab(page, /^Item analysis/)).toHaveAttribute("aria-selected", "true");

    const q2 = page.getByRole("article", { name: "Question 2" });
    await expect(q2.getByText("25%")).toBeVisible();
    await expect(q2.getByRole("note")).toContainText("Check the key.");
    await expect(q2.getByRole("listitem").filter({ hasText: "const" })).toContainText("3 of 4");
    await expect(q2.getByRole("listitem").filter({ hasText: "var" }).getByText("Answer key")).toBeVisible();
    await expect(page.getByRole("article", { name: "Question 1" }).getByRole("note")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectReadableText(page);

    await q2.getByRole("button", { name: "Fix the key for question 2" }).click();
    const dialog = page.getByRole("dialog", { name: "Fix the key for question 2" });
    await expect(dialog.getByRole("radio", { name: "var" })).toBeChecked();
    await dialog.getByRole("radio", { name: "const" }).check();
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Review changes" }).click();
    const confirm = page.getByRole("dialog", { name: "Re-score every attempt?" });
    await expect(confirm.getByText("Every submitted attempt will be re-scored. Students whose score changes will see a note.")).toBeVisible();
    await confirm.getByRole("button", { name: "Save and re-score" }).click();
    await expect(page.getByRole("status").filter({ hasText: /4 attempts re-scored, \d+ changed/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(q2.getByText("75%")).toBeVisible();
    await expect(q2.getByRole("note")).toHaveCount(0);
    await expect(q2.getByRole("listitem").filter({ hasText: "const" }).getByText("Answer key")).toBeVisible();

    // The locked set offers the same fix, and shows the new key.
    await page.goto(`/instructor/question-sets/${setId}`);
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByText("const (correct answer)")).toBeVisible();
    await page.getByRole("button", { name: "Fix answer key" }).click();
    const all = page.getByRole("dialog", { name: "Fix the answer key" });
    await expect(all.getByRole("textbox", { name: "Accepted answers for question 1" })).toHaveValue("Charles Babbage\nBabbage");
    await all.getByRole("button", { name: "Review changes" }).click();
    await expect(all.getByText("Nothing has changed yet. Change a correct answer first.")).toBeVisible();
  });

  test("The grading pages: zero axe violations, text ≥14px @all", async ({ page, sandbox }) => {
    test.slow(); // several pages, each with a full axe scan (L-030)
    const { examId } = await seedExam(page, sandbox);
    await openRole(page, "instructor");
    for (const view of [undefined, "spelling-review", "item-analysis"]) {
      await page.goto(gradingPath(examId, view));
      await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
      await expectNoAxeViolations(page);
      await expectReadableText(page);
    }
  });
});

test("The grading pages do not scroll sideways at 320px @mobile", async ({ page, sandbox }) => {
  const { examId } = await seedExam(page, sandbox);
  await page.setViewportSize({ width: 320, height: 640 });
  await openRole(page, "instructor");
  for (const view of [undefined, "spelling-review", "item-analysis"]) {
    await page.goto(gradingPath(examId, view));
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${view ?? "submissions"} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  await page.goto("/instructor/classes/biology?tab=Submissions");
  await page.getByRole("button", { name: /Alex Rivera · Assessment · awaiting grade/ }).click();
  await expect(page.getByRole("spinbutton", { name: "Points for question 1 (0–1)" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "grading form scrolls sideways").toBeLessThanOrEqual(0);
});
