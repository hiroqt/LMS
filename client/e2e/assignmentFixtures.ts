import { API, INSTRUCTOR, STUDENT, callApi, expect, type DemoViewer, type Page } from "./fixtures";

/*
 * Helpers for the assignment specs (Assignments Phase 2; docs/ASSIGNMENTS_API_CONTRACT.md §5–§8).
 * They set a journey up through the Demo-mode LMS API in the test's own sandbox. In Demo mode
 * there is no virus scanner: only a file that starts with FLAGGED_MARKER is refused (L-079).
 */

/** A small file of each accepted kind, for `setInputFiles` and for `uploadWorkFile`. */
export interface TestFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** Starts like a PDF, which is what the server checks; `content` makes two files differ. */
export const pdfFile = (name = "er-diagram.pdf", content = "ER diagram"): TestFile => ({
  name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Title (${content}) >>\nendobj\ntrailer\n<< >>\n%%EOF\n`, "latin1"),
});

/** A 1×1 PNG that browsers can show. */
export const pngFile = (name = "photo.png"): TestFile => ({
  name, mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
});

export const textFile = (name = "notes.txt", content = "Entities: Student, Class, Enrollment."): TestFile => ({ name, mimeType: "text/plain", buffer: Buffer.from(content, "utf8") });

/** The Demo-mode scanner refuses a file that starts with this text, as a real scanner refuses a virus. */
export const FLAGGED_MARKER = "LMS-VIRUS-SCAN-TEST-FILE";
export const flaggedFile = (name = "infected.txt"): TestFile => textFile(name, `${FLAGGED_MARKER} for the browser tests`);

/** A program renamed to .pdf: the server refuses it from its bytes. */
export const renamedProgram = (name = "homework.pdf"): TestFile => ({ name, mimeType: "application/pdf", buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]) });

const headers = (sandbox: string, viewer: DemoViewer) => ({ "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": viewer.id, "X-Demo-Role": viewer.role });

export interface SeededFile { id: number; name: string; code: string }
export interface SeededSubmission { id: number; status: string; attemptNumber: number; files: SeededFile[] }

/** Adds a file to the student's draft of an assignment through the API. */
export async function uploadWorkFile(page: Page, sandbox: string, classId: string, courseworkId: number | string, file: TestFile, viewer: DemoViewer = STUDENT): Promise<SeededSubmission> {
  const response = await page.request.post(`${API}/api/classes/${classId}/coursework/${courseworkId}/draft/files`, { headers: headers(sandbox, viewer), multipart: { file } });
  expect(response.ok(), `upload ${file.name}: ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json()) as SeededSubmission;
}

export interface AssignmentOptions {
  classId?: string;
  title?: string;
  /** Any coursework field of the contract: dueAt, allowLate, closeAt, allowResubmission, gradeRelease, submissionKinds, allowedFileTypes, maxFiles, honorStatement, status … */
  settings?: Record<string, unknown>;
}

/** A published assignment in Introduction to Programming (class `biology` in the seed), made by its instructor. */
export async function seedAssignment(page: Page, sandbox: string, options: AssignmentOptions = {}) {
  const classId = options.classId ?? "biology";
  const title = options.title ?? "ER diagram";
  const [module] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", `/api/classes/${classId}/modules`);
  const work = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", `/api/classes/${classId}/coursework`, {
    type: "assignment", moduleId: module!.id, title, maxPoints: 20, status: "published", instructions: "Draw the diagram for the enrollment system.", ...options.settings,
  });
  return { classId, courseworkId: String(work.id), title };
}

export interface TurnInOptions {
  text?: string | null;
  link?: string | null;
  files?: TestFile[];
  viewer?: DemoViewer;
  honorStatement?: boolean;
}

/** Hands work in as a student through the draft API: saves text and link, adds the files, turns in. Answers the turned-in submission. */
export async function turnInWork(page: Page, sandbox: string, classId: string, courseworkId: number | string, options: TurnInOptions = {}): Promise<SeededSubmission> {
  const viewer = options.viewer ?? STUDENT;
  const base = `/api/classes/${classId}/coursework/${courseworkId}`;
  const files = options.files ?? [pdfFile()];
  if (options.text !== undefined || options.link !== undefined || files.length === 0)
    await callApi(page, sandbox, viewer, "PUT", `${base}/draft`, { text: options.text ?? (files.length === 0 && !options.link ? "My answer." : null), link: options.link ?? null });
  for (const file of files) await uploadWorkFile(page, sandbox, classId, courseworkId, file, viewer);
  const turnedIn = await callApi<{ submission: SeededSubmission }>(page, sandbox, viewer, "POST", `${base}/draft/turn-in`, { honorStatement: options.honorStatement ?? true });
  return turnedIn.submission;
}

/** An assignment that Alex Rivera (s0) has turned in with a real file, waiting for a grade. */
export async function seedTurnedInAssignment(page: Page, sandbox: string, options: AssignmentOptions & TurnInOptions = {}) {
  const assignment = await seedAssignment(page, sandbox, options);
  const submission = await turnInWork(page, sandbox, assignment.classId, assignment.courseworkId, options);
  return { ...assignment, submissionId: String(submission.id), submission };
}

// ------------------------------------------------------------------ Phase 3 (contract §10–§13)

export interface SeededRubric {
  id: number;
  title: string;
  totalPoints: number;
  criteria: Array<{ id: number; title: string; levels: Array<{ id: number; title: string; points: number }> }>;
}

/** A rubric worth 15 points in the class: Analysis (10 / 5 / 0) and Presentation (5 / 2). */
export async function seedRubric(page: Page, sandbox: string, classId = "biology", title = "Lab report"): Promise<SeededRubric> {
  return callApi<SeededRubric>(page, sandbox, INSTRUCTOR, "POST", `/api/classes/${classId}/rubrics`, {
    title,
    criteria: [
      { title: "Analysis", description: "How well the data is explained.", levels: [{ title: "Complete", points: 10 }, { title: "Partial", points: 5 }, { title: "Missing", points: 0 }] },
      { title: "Presentation", levels: [{ title: "Clear", points: 5 }, { title: "Unclear", points: 2 }] },
    ],
  });
}

/** The `rubric` of a grade request: the named level of each criterion, e.g. `{ Analysis: "Partial", Presentation: "Clear" }`. */
export function rubricChoice(rubric: SeededRubric, levels: Record<string, string>): Record<string, number> {
  return Object.fromEntries(rubric.criteria.map((criterion) => {
    const level = criterion.levels.find((item) => item.title === levels[criterion.title]);
    if (!level) throw new Error(`No level "${levels[criterion.title]}" for ${criterion.title}`);
    return [String(criterion.id), level.id];
  }));
}

/** Grades a turned-in submission as the instructor: plain `points`, or `rubric` levels; `waivePenalty` for late work. */
export const gradeWork = (page: Page, sandbox: string, classId: string, courseworkId: number | string, submissionId: number | string, grade: { points?: number; feedback?: string; rubric?: Record<string, number>; waivePenalty?: boolean }) =>
  callApi<{ score: number; rawScore: number; penaltyPercent: number; daysLate: number }>(page, sandbox, INSTRUCTOR, "PUT", `/api/classes/${classId}/coursework/${courseworkId}/submissions/${submissionId}/grade`, grade);

/** Gives one student their own due date (and last day) for an assignment. */
export const extendFor = (page: Page, sandbox: string, classId: string, courseworkId: number | string, studentId: string, dates: { dueAt: string; closeAt?: string }) =>
  callApi(page, sandbox, INSTRUCTOR, "PUT", `/api/classes/${classId}/coursework/${courseworkId}/students/${studentId}/extension`, dates);

/** Excuses one student from an assignment. */
export const excuse = (page: Page, sandbox: string, classId: string, courseworkId: number | string, studentId: string) =>
  callApi(page, sandbox, INSTRUCTOR, "PUT", `/api/classes/${classId}/coursework/${courseworkId}/students/${studentId}/excuse`, {});

/**
 * The API's clock, which the browser's pinned clock can trail by minutes (L-087). Use it for
 * dates that must be before or after "now" on the server: `new Date(now.getTime() + …)`.
 */
export async function serverNow(page: Page, sandbox: string): Promise<Date> {
  const status = await callApi<{ checkedAt: string }>(page, sandbox, INSTRUCTOR, "GET", "/api/lms/status");
  return new Date(status.checkedAt);
}
