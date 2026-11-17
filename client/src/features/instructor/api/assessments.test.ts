import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/api/http";
import { courseworkBody, courseworkErrors, defaultSettings, saveAssessment, settingsFromDto, toLocalInput, validateSettings, type SaveRequest, type Sender } from "./assessments";
import { blankQuestion, blankSection, type DraftSection } from "./questionDrafts";

const settings = { ...defaultSettings("12"), title: "Quiz 1: Loops" };

function sections(): DraftSection[] {
  return [{ ...blankSection(), title: "Test I", questions: [{ ...blankQuestion("essay"), prompt: "Explain loops." }] }];
}

/** A fake API: answers by "METHOD path", records every call. */
function fakeApi(answers: Record<string, unknown | ApiError>) {
  const calls: Array<[string, string, unknown]> = [];
  const send = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push([method, path, body]);
    const answer = answers[`${method} ${path}`];
    if (answer instanceof ApiError) throw answer;
    return answer;
  }) as unknown as Sender;
  return { send, calls };
}

const invalid = (fieldErrors: Record<string, string[]>, status = 422) => new ApiError({ kind: "http", status, url: "/x", fieldErrors });

const request = (change: Partial<SaveRequest> = {}): SaveRequest => ({
  classId: "it101-a",
  examId: null,
  subjectId: 3,
  settings,
  status: "draft",
  questions: { source: "own", setId: null, setTitle: null, sections: sections() },
  ...change,
});

describe("saveAssessment", () => {
  it("creates the set, saves its questions allowing incomplete ones, then creates the exam as a draft", async () => {
    const { send, calls } = fakeApi({
      "POST /api/questionnaires": { id: 7 },
      "PUT /api/questionnaires/7/questions": { id: 7, questions: [] },
      "POST /api/classes/it101-a/coursework": { id: 40 },
    });
    const outcome = await saveAssessment(send, request());
    expect(outcome).toMatchObject({ ok: true, examId: 40, setId: 7 });
    expect(calls.map(([method, path]) => `${method} ${path}`)).toEqual(["POST /api/questionnaires", "PUT /api/questionnaires/7/questions", "POST /api/classes/it101-a/coursework"]);
    expect(calls[0]![2]).toEqual({ title: "Quiz 1: Loops", subjectId: 3 });
    expect(calls[1]![2]).toMatchObject({ allowIncomplete: true, sections: [{ title: "Test I" }], questions: [{ type: "essay", section: 0 }] });
    expect(calls[2]![2]).toMatchObject({ type: "exam", questionnaireId: 7, status: "draft", moduleId: 12, answerReview: "results", spellingMode: "strict", shuffleQuestions: false });
  });

  it("reuses the set and patches the exam on the next save, renaming the set with the exam", async () => {
    const { send, calls } = fakeApi({ "PUT /api/questionnaires/7/questions": { id: 7, questions: [] } });
    const outcome = await saveAssessment(send, request({ examId: 40, status: "published", questions: { source: "own", setId: 7, setTitle: "Old title", sections: sections() } }));
    expect(outcome.ok).toBe(true);
    expect(calls.map(([method, path]) => `${method} ${path}`)).toEqual(["PATCH /api/questionnaires/7", "PUT /api/questionnaires/7/questions", "PATCH /api/classes/it101-a/coursework/40"]);
    expect(calls[2]![2]).toMatchObject({ status: "published" });
    expect(calls[2]![2]).not.toHaveProperty("type");
  });

  it("uses a chosen set without touching its questions", async () => {
    const { send, calls } = fakeApi({ "POST /api/classes/it101-a/coursework": { id: 41 } });
    await saveAssessment(send, request({ questions: { source: "set", setId: 5 } }));
    expect(calls).toHaveLength(1);
    expect(calls[0]![2]).toMatchObject({ questionnaireId: 5 });
    const none = await saveAssessment(fakeApi({}).send, request({ questions: { source: "set", setId: null } }));
    expect(none).toMatchObject({ ok: false, stage: "questions", message: "Choose a question set." });
  });

  it("refuses an untyped question before calling the server", async () => {
    const { send, calls } = fakeApi({});
    const untyped = [{ ...blankSection(), questions: [blankQuestion("essay"), { ...blankQuestion("essay"), type: "" as const }] }];
    const outcome = await saveAssessment(send, request({ questions: { source: "own", setId: null, setTitle: null, sections: untyped } }));
    expect(outcome).toMatchObject({ ok: false, stage: "questions", fieldErrors: { "questions[1].type": ["Choose the type."] } });
    expect(calls).toHaveLength(0);
  });

  it("stops at the failing step and keeps the set it created, so a retry does not make another", async () => {
    const { send } = fakeApi({
      "POST /api/questionnaires": { id: 7 },
      "PUT /api/questionnaires/7/questions": invalid({ "questions[0].type": ["Choose one of: …"] }),
    });
    const outcome = await saveAssessment(send, request());
    expect(outcome).toMatchObject({ ok: false, stage: "questions", setId: 7, examId: null, fieldErrors: { "questions[0].type": ["Choose one of: …"] }, message: "Check the highlighted fields." });
  });

  it("reports a publish refusal on the exam step", async () => {
    const { send } = fakeApi({
      "PUT /api/questionnaires/7/questions": { id: 7, questions: [] },
      "PATCH /api/classes/it101-a/coursework/40": invalid({ questionnaireId: ["Finish the questions marked \"needs attention\" before publishing."] }),
    });
    const outcome = await saveAssessment(send, request({ examId: 40, status: "published", questions: { source: "own", setId: 7, setTitle: "Quiz 1: Loops", sections: sections() } }));
    expect(outcome).toMatchObject({ ok: false, stage: "exam", examId: 40, setId: 7 });
    expect(courseworkErrors(outcome.fieldErrors)).toEqual({ publish: "Finish the questions marked \"needs attention\" before publishing." });
  });
});

describe("settings", () => {
  it("maps the server's coursework fields to the builder's", () => {
    expect(courseworkErrors({ maxAttempts: ["Allow 1 to 20 attempts."], timeLimitMinutes: ["Use 0 to 600 minutes."], status: ["Add at least one question before publishing this exam."], title: ["Enter a title."] })).toEqual({
      attempts: "Allow 1 to 20 attempts.",
      timeLimit: "Use 0 to 600 minutes.",
      publish: "Add at least one question before publishing this exam.",
      title: "Enter a title.",
    });
  });

  it("checks the title, attempts, time limit, category, and dates before saving", () => {
    expect(validateSettings(settings)).toEqual({});
    expect(validateSettings({ ...settings, title: " ", attempts: "0", timeLimit: "601", category: "x".repeat(41), availableFrom: "2026-11-20T08:00", dueAt: "2026-11-19T08:00" })).toEqual({
      title: "Enter a title.",
      attempts: "Allow 1 to 20 attempts.",
      timeLimit: "Use 0 to 600 minutes (0 means no limit).",
      category: "Use at most 40 characters.",
      dueAt: "The due date must be after the date it becomes available.",
    });
  });

  it("reads a saved exam, defaulting settings a server before D-040 does not send", () => {
    const read = settingsFromDto({
      id: 40, moduleId: 12, type: "exam", title: "Quiz", category: null, instructions: null, maxPoints: 5, dueAt: null, availableFrom: null,
      maxAttempts: 2, timeLimitMinutes: null, questionnaireId: 7, questionCount: 1, status: "draft",
    });
    expect(read).toMatchObject({ moduleId: "12", attempts: "2", timeLimit: "0", answerReview: "results", spellingMode: "strict", shuffleChoices: false, dueAt: "" });
    expect(toLocalInput(new Date(2026, 10, 30, 15, 5).toISOString())).toBe("2026-11-30T15:05");
    expect(courseworkBody({ ...settings, category: " " }, 7, "draft")).toMatchObject({ category: "Quiz", dueAt: undefined, timeLimitMinutes: 0, maxAttempts: 1 });
  });
});
