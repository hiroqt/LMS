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
