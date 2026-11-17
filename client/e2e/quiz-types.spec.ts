import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { callApi, expect, INSTRUCTOR, test, type Page } from "./fixtures";

// Every question type from the student's side (D-040, docs/ASSESSMENTS_API_CONTRACT.md §1, §3–§6):
// the inputs, autosave, the spelling rule, each answer-review mode, an essay waiting for grading,
// and the instructor's "Preview as student", which saves nothing. Each test seeds its own exam
// through the API in its sandbox; nothing depends on the demo seed's exams.

type AnswerReview = "score_only" | "results" | "answers_after_due" | "answers_after_submit";
type SpellingMode = "strict" | "typos" | "review";

const SECTIONS = [
  { title: "Test I. Multiple choice", directions: "Choose the best answer.", defaultPoints: 1 },
  { title: "Test II. Typed answers", directions: "Write your answer on the line.", defaultPoints: 1 },
  { title: "Test III. Essay", directions: "Answer in a short paragraph.", defaultPoints: 5 },
];

/** One question of every type; 15 points in all. */
const EVERY_TYPE = [
  { section: 0, type: "multiple_choice", prompt: "Which keyword declares a constant in C#?", points: 1, options: [{ text: "var", isCorrect: false }, { text: "const", isCorrect: true }, { text: "let", isCorrect: false }] },
  { section: 0, type: "true_false", prompt: "HTML is a programming language.", points: 1, correctAnswer: false },
  { section: 1, type: "identification", prompt: "The father of computers.", points: 1, expectedAnswers: ["Charles Babbage", "Babbage"] },
  { section: 1, type: "enumeration", prompt: "Give the three primary colors of light.", points: 3, expectedAnswers: ["red", "green", "blue"] },
  { section: 1, type: "modified_true_false", prompt: "The CPU stores data permanently.", points: 2, underlined: "CPU", correctAnswer: false, expectedAnswers: ["storage", "hard disk"] },
  { section: 1, type: "matching", prompt: "Match the device to its use.", points: 2, pairs: [{ left: "Keyboard", right: "input" }, { left: "Monitor", right: "output" }] },
  { section: 2, type: "essay", prompt: "Explain why backups matter.", points: 5 },
];

interface SeededExam {
  id: string;
  setId: number;
  title: string;
}

/** Creates a question set and a published exam in Introduction to Programming (class "biology"). */
async function seedExam(page: Page, sandbox: string, options: { title: string; answerReview?: AnswerReview; spellingMode?: SpellingMode; questions?: unknown[] }): Promise<SeededExam> {
  const set = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", "/api/questionnaires", { title: `${options.title} questions` });
  await callApi(page, sandbox, INSTRUCTOR, "PUT", `/api/questionnaires/${set.id}/questions`, { sections: SECTIONS, questions: options.questions ?? EVERY_TYPE });
  const [module] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
  const exam = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", "/api/classes/biology/coursework", {
    type: "exam",
    moduleId: module!.id,
    title: options.title,
    category: "Quiz",
    instructions: "Answer every question.",
    questionnaireId: set.id,
    status: "published",
    maxAttempts: 2,
    dueAt: "2026-10-30T17:00:00+08:00",
    answerReview: options.answerReview ?? "results",
    spellingMode: options.spellingMode ?? "strict",
  });
  return { id: String(exam.id), setId: set.id, title: options.title };
}

async function check(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectReadableText(page);
}

const go = (page: Page, number: number) => page.getByRole("button", { name: `Go to question ${number}`, exact: true }).click();

async function startQuiz(page: Page, exam: SeededExam) {
  await page.goto(`/student/assessments/${exam.id}`);
  await expect(page.getByRole("heading", { level: 1, name: exam.title })).toBeVisible();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByRole("button", { name: "Go to question 1", exact: true })).toHaveAttribute("aria-current", "step");
}

/** Answers every question: 1, 2, 5, 6 right; 3 with a small typo; 4 two of three; 7 an essay. */
async function answerEveryType(page: Page) {
  await expect(page.getByRole("heading", { level: 2, name: "Test I. Multiple choice" })).toBeVisible();
  await expect(page.getByText("Choose the best answer.")).toBeVisible();
  await page.getByRole("radio", { name: "const", exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();

  await page.getByRole("radio", { name: "False", exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Test II. Typed answers" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer for question 3" }).fill("Babage");
  await page.getByRole("button", { name: "Next question" }).click();

  await expect(page.getByRole("textbox", { name: /^Answer \d for question 4$/ })).toHaveCount(3);
  await page.getByRole("textbox", { name: "Answer 1 for question 4" }).fill("red");
  await page.getByRole("textbox", { name: "Answer 2 for question 4" }).fill("green");
  await page.getByRole("button", { name: "Next question" }).click();

  // The underlined phrase is drawn and named for screen readers.
  await expect(page.getByRole("heading", { level: 3, name: "The CPU (underlined) stores data permanently." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Correction for question 5" })).toHaveCount(0);
  await page.getByRole("radio", { name: "False", exact: true }).click();
  const correction = page.getByRole("textbox", { name: "Correction for question 5" });
  await expect(correction).toBeFocused();
  await correction.fill("storage");
  await page.getByRole("button", { name: "Next question" }).click();

  await page.getByRole("combobox", { name: "Keyboard (question 6)" }).selectOption("input");
  await page.getByRole("combobox", { name: "Monitor (question 6)" }).selectOption("output");
  await page.getByRole("button", { name: "Next question" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Test III. Essay" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer for question 7" }).fill("Backups let you recover from mistakes and failures.");
}

async function submit(page: Page) {
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.getByRole("dialog", { name: "Submit this assessment?" }).getByRole("button", { name: /Submit now/ }).click();
  await expect(page.getByText("Assessment submitted")).toBeVisible();
  await expect(page).toHaveURL(/\/result$/);
}

const reviewItem = (page: Page, number: number) => page.getByRole("region", { name: /Answer review/ }).getByRole("listitem").filter({ hasText: new RegExp(`^Question ${number}(?!\\d)`) });

test.describe("Student · every question type (D-040)", () => {
  test("a student answers every type, sees the spelling rule, and reviews results with the correct answers", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Mixed quiz: every type", answerReview: "answers_after_submit", spellingMode: "typos" });
    await page.goto(`/student/assessments/${exam.id}`);
    await expect(page.getByText("Small spelling mistakes are accepted.")).toBeVisible();
    await expect(page.getByText(/the correct answers\.$/)).toBeVisible();
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(page.getByRole("main").getByText("Small spelling mistakes are accepted.")).toBeVisible();

    await answerEveryType(page);
    await page.getByRole("button", { name: "Review & submit" }).click();
    await expect(page.getByRole("dialog", { name: "Submit this assessment?" })).toContainText("You answered 7 of 7 questions");
    await page.getByRole("dialog").getByRole("button", { name: /Submit now/ }).click();
    await expect(page.getByText("Assessment submitted")).toBeVisible();

    await expect(reviewItem(page, 1)).toContainText("Correct");
    await expect(reviewItem(page, 1)).toContainText("Correct answer: const");
    await expect(reviewItem(page, 3)).toContainText("Accepted with a spelling difference");
    await expect(reviewItem(page, 3)).toContainText("Correct answer: Charles Babbage or Babbage");
    await expect(reviewItem(page, 4)).toContainText("Partly correct");
    await expect(reviewItem(page, 4)).toContainText("2 of 3 points");
    await expect(reviewItem(page, 5)).toContainText("Correct answer: False, correction: storage or hard disk");
    await expect(reviewItem(page, 6)).toContainText("Keyboard: input; Monitor: output");
    await expect(reviewItem(page, 7)).toContainText("Waiting for grading");
    await expect(page.getByText("Some answers are waiting for your instructor to grade them.")).toBeVisible();
  });

  test("the submit dialog lists unanswered questions and opens one", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Mixed quiz: unanswered" });
    await startQuiz(page, exam);
    await page.getByRole("radio", { name: "const", exact: true }).click();
    await page.getByRole("button", { name: "Submit assessment" }).click();
    const dialog = page.getByRole("dialog", { name: "Submit this assessment?" });
    await expect(dialog).toContainText("You answered 1 of 7 questions");
    await expect(dialog).toContainText("Not answered: questions 2, 3, 4, 5, 6, and 7.");
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Open question 4" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Go to question 4", exact: true })).toHaveAttribute("aria-current", "step");
  });

  test("typed answers save after a pause and on Next, and survive a reload", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Mixed quiz: autosave" });
    await startQuiz(page, exam);
    await go(page, 3);
    await page.getByRole("textbox", { name: "Your answer for question 3" }).fill("Babbage");
    // About a second without typing saves it.
    await page.clock.runFor(1500);
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeAttached();

    // Typing and moving on at once still saves (Next flushes the wait).
    await go(page, 7);
    await page.getByRole("textbox", { name: "Your answer for question 7" }).fill("Backups protect work.");
    const saved = page.waitForResponse((response) => response.request().method() === "PUT" && /\/answers$/.test(response.url()) && response.ok());
    await page.getByRole("button", { name: "Previous" }).click();
    await saved;

    await page.reload();
    await go(page, 3);
    await expect(page.getByRole("textbox", { name: "Your answer for question 3" })).toHaveValue("Babbage");
    await go(page, 7);
    await expect(page.getByRole("textbox", { name: "Your answer for question 7" })).toHaveValue("Backups protect work.");
  });

  test("an essay waits for grading, and the exam page shows no grade yet", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Essay quiz", questions: [EVERY_TYPE[6]] });
    await startQuiz(page, exam);
    await page.getByRole("textbox", { name: "Your answer for question 1" }).fill("Backups let you recover.");
    await expect(page.getByText(/^\d+ of 10,000 characters/)).toBeVisible();
    await submit(page);
    await expect(reviewItem(page, 1)).toContainText("Waiting for grading");
    await expect(page.getByText("Some answers are waiting for your instructor to grade them.")).toBeVisible();
    await page.goto(`/student/assessments/${exam.id}`);
    await expect(page.getByRole("region", { name: "Your grade" })).toHaveCount(0);
  });
});

test.describe("Student · answer review modes (contract §4)", () => {
  async function takeShortQuiz(page: Page, exam: SeededExam) {
    await startQuiz(page, exam);
    await page.getByRole("radio", { name: "var", exact: true }).click(); // wrong
    await page.getByRole("button", { name: "Next question" }).click();
    await page.getByRole("radio", { name: "False", exact: true }).click(); // right
    await submit(page);
  }
  const SHORT = EVERY_TYPE.slice(0, 2);

  test("score only: the score, and a line saying answers are not shown", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Review: score only", answerReview: "score_only", questions: SHORT });
    await page.goto(`/student/assessments/${exam.id}`);
    await expect(page.getByText("After you submit, you see your score only.")).toBeVisible();
    await takeShortQuiz(page, exam);
    await expect(page.getByText("50%")).toBeVisible();
    await expect(page.getByText(/chose not to show answers/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Answer review/ })).toHaveCount(0);
    await expect(page.getByText("Correct answer:")).toHaveCount(0);
  });

  test("results: which questions were right, without the correct answers", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Review: results", answerReview: "results", questions: SHORT });
    await takeShortQuiz(page, exam);
    await expect(reviewItem(page, 1)).toContainText("Incorrect");
    await expect(reviewItem(page, 2)).toContainText("Correct");
    await expect(page.getByText(/Correct answer:/)).toHaveCount(0);
  });

  test("answers after the due date: no key before it, then the key", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Review: after due", answerReview: "answers_after_due", questions: SHORT });
    await takeShortQuiz(page, exam);
    await expect(reviewItem(page, 1)).toContainText("Incorrect");
    await expect(page.getByText(/Correct answer:/)).toHaveCount(0);

    // The instructor moves the due date into the past (closing would first need every student graded, D-036).
    await callApi(page, sandbox, INSTRUCTOR, "PATCH", `/api/classes/biology/coursework/${exam.id}`, { dueAt: "2026-10-22T17:00:00+08:00" });
    await page.reload();
    await expect(reviewItem(page, 1)).toContainText("Correct answer: const");
  });

  test("answers right after submitting: the key at once", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Review: after submit", answerReview: "answers_after_submit", questions: SHORT });
    await takeShortQuiz(page, exam);
    await expect(reviewItem(page, 1)).toContainText("Correct answer: const");
    await expect(reviewItem(page, 2)).toContainText("Correct answer: False");
  });
});

test.describe("Instructor · preview as student", () => {
  test("the preview checks answers and shows keys, and saves nothing", async ({ page, sandbox }) => {
    const exam = await seedExam(page, sandbox, { title: "Mixed quiz: preview", spellingMode: "review" });
    await page.goto(`/instructor/classes/biology/assessments/${exam.id}/preview`);
    await expect(page.getByRole("heading", { level: 1, name: exam.title })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Preview: nothing is saved");
    await expect(page.getByText("Near misses are checked by your instructor.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to the assessment builder" })).toBeVisible();

    await page.getByRole("radio", { name: "const", exact: true }).click();
    await page.getByRole("textbox", { name: "Your answer for question 3" }).fill("Charles Babbage");
    await page.getByRole("button", { name: "Check answers" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Score: 2 of 15 points" })).toBeVisible();
    await expect(page.getByText("Correct answer: const")).toBeVisible();
    await expect(page.getByText("Correct answer: True")).toHaveCount(0);
    await expect(page.getByText("Correct answer: False", { exact: true })).toBeVisible();

    // Nothing was saved: no attempt, and the set is still editable.
    const submissions = await callApi<{ items: unknown[] }>(page, sandbox, INSTRUCTOR, "GET", `/api/classes/biology/coursework/${exam.id}/submissions`);
    expect(submissions.items).toEqual([]);
    const set = await callApi<{ locked: boolean }>(page, sandbox, INSTRUCTOR, "GET", `/api/questionnaires/${exam.setId}`);
    expect(set.locked).toBe(false);
  });
});

test.describe("Every question type: zero axe violations, text ≥14px", () => {
  test("the quiz on each type, the dialog, the result, and the preview @all", async ({ page, sandbox }) => {
    test.slow(); // many full axe scans (L-030)
    const exam = await seedExam(page, sandbox, { title: "Mixed quiz: accessibility", answerReview: "answers_after_submit", spellingMode: "typos" });
    await page.goto(`/student/assessments/${exam.id}`);
    await check(page);
    await page.getByRole("button", { name: "Start assessment" }).click();
    for (let number = 1; number <= EVERY_TYPE.length; number += 1) {
      await go(page, number);
      if (number === 5) await page.getByRole("radio", { name: "False", exact: true }).click();
      await check(page);
    }
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByRole("dialog", { name: "Submit this assessment?" })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: /Submit now/ }).click();
    await expect(page.getByText("Assessment submitted")).toBeVisible();
    await check(page);

    await page.goto(`/instructor/classes/biology/assessments/${exam.id}/preview`);
    await check(page);
    await page.getByRole("button", { name: "Check answers" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Score:/ })).toBeVisible();
    await check(page);
  });

  test("forced colors keep the chosen answer and the save state visible @all", async ({ page, sandbox }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    const exam = await seedExam(page, sandbox, { title: "Mixed quiz: comfort" });
    await startQuiz(page, exam);
    await page.getByRole("radio", { name: "const", exact: true }).click();
    await expect(page.getByRole("radio", { name: "const", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  });
});

test("the quiz, result, and preview do not scroll sideways at 320px @mobile", async ({ page, sandbox }) => {
  const exam = await seedExam(page, sandbox, { title: "Mixed quiz: narrow screens with a long title", answerReview: "answers_after_submit" });
  await page.setViewportSize({ width: 320, height: 640 });
  const noSideways = async (label: string) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, label).toBeLessThanOrEqual(1);
  };
  await startQuiz(page, exam);
  for (let number = 1; number <= EVERY_TYPE.length; number += 1) {
    await go(page, number);
    if (number === 5) await page.getByRole("radio", { name: "False", exact: true }).click();
    await noSideways(`question ${number}`);
  }
  await submit(page);
  await noSideways("result");
  await page.goto(`/instructor/classes/biology/assessments/${exam.id}/preview`);
  await noSideways("preview");
});
