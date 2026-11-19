import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/api/http";
import type { Coursework } from "../../../shared/api/overview";
import { handInRules } from "../../../shared/lib/assignmentRules";
import {
  applyPreset,
  assignmentBody,
  copySettings,
  defaultForm,
  errorCount,
  errorFields,
  formFromDto,
  handedInCount,
  handInSettings,
  mapServerErrors,
  saveAssignment,
  validateAssignment,
  type AssignmentForm,
  type Sender,
} from "./assignments";

const form = (change: Partial<AssignmentForm> = {}): AssignmentForm => ({ ...defaultForm("12"), title: "ER diagram", ...change });

function fakeApi(answers: Record<string, unknown>) {
  const calls: Array<[string, string, unknown]> = [];
  const send = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push([method, path, body]);
    const answer = answers[`${method} ${path}`];
    if (answer instanceof ApiError) throw answer;
    return answer;
  }) as unknown as Sender;
  return { send, calls };
}

describe("defaults and presets", () => {
  it("starts with the server's defaults and 10 points", () => {
    expect(defaultForm("3")).toMatchObject({ moduleId: "3", points: "10", submissionKinds: ["text", "file"], maxFiles: 5, honorStatement: false, allowLate: false, gradeRelease: "immediate" });
    expect(defaultForm("3").allowedFileTypes).toHaveLength(6);
  });

  it("a preset fills the settings and dates but never the title, text, or module", () => {
    const now = new Date(2026, 9, 23, 9, 0);
    const filled = applyPreset(form({ description: "Short", instructions: "Draw it." }), "homework", now);
    expect(filled).toMatchObject({ title: "ER diagram", moduleId: "12", description: "Short", instructions: "Draw it.", points: "20", maxFiles: 3, honorStatement: true, allowLate: true, allowResubmission: true });
    expect(filled.allowedFileTypes).toEqual(["pdf", "word", "image"]);
    expect(filled.dueAt).toBe("2026-10-30T23:59");
    expect(filled.closeAt).toBe("2026-11-01T23:59");
  });

  it("a preset keeps a due date already chosen, and one without late work has no last day", () => {
    const now = new Date(2026, 9, 23, 9, 0);
    expect(applyPreset(form({ dueAt: "2026-11-05T17:00" }), "project", now)).toMatchObject({ dueAt: "2026-11-05T17:00", closeAt: "2026-11-08T23:59", gradeRelease: "returned", submissionKinds: ["file", "link"] });
    expect(applyPreset(form({ closeAt: "2026-12-01T10:00" }), "in-class", now)).toMatchObject({ dueAt: "2026-10-23T23:59", closeAt: "", allowLate: false, maxFiles: 2 });
  });

  it("copying a previous assignment takes its settings, not its title or dates", () => {
    const copied = copySettings(form({ dueAt: "2026-11-05T17:00" }), {
      id: "9", moduleId: "4", title: "Old lab", maxScore: 15, dueAt: "2026-09-01T00:00:00Z", closeAt: "2026-09-03T00:00:00Z", allowLate: true, allowResubmission: true,
      gradeRelease: "returned", submissionKinds: ["link"], allowedFileTypes: ["pdf"], maxFiles: 1, honorStatement: true,
    });
    expect(copied).toMatchObject({ title: "ER diagram", moduleId: "12", dueAt: "2026-11-05T17:00", points: "15", submissionKinds: ["link"], allowedFileTypes: ["pdf"], maxFiles: 1, honorStatement: true, allowLate: true, gradeRelease: "returned" });
  });
});

describe("validateAssignment", () => {
  it("accepts the defaults with a title", () => {
    expect(validateAssignment(form())).toEqual({});
  });

  it("needs a title, a module, points, and one way to hand in", () => {
    const errors = validateAssignment(form({ title: " ", moduleId: "", points: "0", submissionKinds: [] }));
    expect(errorFields(errors)).toEqual(["title", "moduleId", "points", "submissionKinds"]);
    expect(errorCount(errors, "details")).toBe(3);
    expect(errorCount(errors, "hand-in")).toBe(1);
  });

  it("checks file types and count only when files are handed in", () => {
    expect(validateAssignment(form({ allowedFileTypes: [], maxFiles: 0 }))).toMatchObject({ allowedFileTypes: "Choose at least one file type.", maxFiles: "Allow 1 to 5 files." });
    expect(validateAssignment(form({ submissionKinds: ["text"], allowedFileTypes: [], maxFiles: 0 }))).toEqual({});
  });

  it("orders the dates, and checks the last day only when it applies", () => {
    expect(validateAssignment(form({ availableFrom: "2026-11-02T08:00", dueAt: "2026-11-01T08:00" })).dueAt).toMatch(/after the date it becomes available/);
    expect(validateAssignment(form({ dueAt: "2026-11-02T08:00", allowLate: true, closeAt: "2026-11-01T08:00" })).closeAt).toMatch(/after the due date/);
    expect(validateAssignment(form({ dueAt: "2026-11-02T08:00", allowLate: false, closeAt: "2026-11-01T08:00" }))).toEqual({});
  });
});

describe("the API body", () => {
  it("creates an assignment with every setting", () => {
    const body = assignmentBody(form({ dueAt: "2026-11-02T08:00", allowLate: true, closeAt: "2026-11-04T08:00" }), { existing: false, status: "draft" });
    expect(body).toMatchObject({ type: "assignment", category: "Assignment", moduleId: 12, title: "ER diagram", maxPoints: 10, status: "draft", allowLate: true, submissionKinds: ["text", "file"], maxFiles: 5 });
    expect(body.closeAt).toBe(new Date("2026-11-04T08:00").toISOString());
    expect(body).not.toHaveProperty("clearDueAt");
  });

  it("an update clears empty dates and a last day that no longer applies, and keeps the status when none is given", () => {
    const body = assignmentBody(form({ dueAt: "2026-11-02T08:00", allowLate: false, closeAt: "2026-11-04T08:00" }), { existing: true });
    expect(body).toMatchObject({ clearAvailableFrom: true, clearCloseAt: true });
    expect(body).not.toHaveProperty("clearDueAt");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("type");
    expect(body.closeAt).toBeUndefined();
  });

  it("reads a saved assignment back into the form", () => {
    const dto = { id: 5, moduleId: 3, type: "assignment", title: "Lab", description: null, instructions: "Do it", maxPoints: 15, dueAt: null, availableFrom: null, closeAt: null, allowLate: true, allowResubmission: false, gradeRelease: "returned", submissionKinds: ["link"], allowedFileTypes: ["pdf"], maxFiles: 2, honorStatement: true, status: "published" } as unknown as Coursework;
    expect(formFromDto(dto)).toMatchObject({ moduleId: "3", description: "", points: "15", dueAt: "", submissionKinds: ["link"], maxFiles: 2, gradeRelease: "returned", honorStatement: true });
  });

  it("words the form as students read it", () => {
    const rules = handInRules(handInSettings(form({ submissionKinds: ["text"], allowResubmission: true, honorStatement: true })));
    expect(rules).toEqual([
      "You can hand in a written answer.",
      "There is no due date.",
      "You can take your work back and turn in a new version.",
      "You see your grade as soon as your instructor saves it.",
      "You confirm that the work is your own when you turn it in.",
    ]);
  });
});

describe("saving", () => {
  it("posts a new assignment, then patches it", async () => {
    const api = fakeApi({ "POST /api/classes/it101-a/coursework": { id: 41 } });
    const created = await saveAssignment(api.send, { classId: "it101-a", id: null, form: form(), status: "draft" });
    expect(created).toEqual({ ok: true, id: 41, errors: {} });
    await saveAssignment(api.send, { classId: "it101-a", id: 41, form: form(), status: "published" });
    expect(api.calls.map(([method, path]) => `${method} ${path}`)).toEqual(["POST /api/classes/it101-a/coursework", "PATCH /api/classes/it101-a/coursework/41"]);
    expect(api.calls[1]![2]).toMatchObject({ status: "published" });
  });

  it("puts the server's field errors on the builder's fields", async () => {
    const refused = new ApiError({ kind: "http", status: 400, url: "/x", fieldErrors: { maxPoints: ["Points must be more than 0 and at most 1000."], closeAt: ["Accept late work to set a last day for it."], status: ["Nope."] } });
    const api = fakeApi({ "PATCH /api/classes/c/coursework/7": refused });
    const outcome = await saveAssignment(api.send, { classId: "c", id: 7, form: form() });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe("Check the highlighted fields.");
    expect(outcome.errors).toEqual({ points: "Points must be more than 0 and at most 1000.", closeAt: "Accept late work to set a last day for it.", general: "Nope." });
    expect(errorCount(outcome.errors, "dates")).toBe(1);
  });

  it("maps clear flags and unknown fields", () => {
    expect(mapServerErrors({ clearCloseAt: ["x"], submissionKinds: ["y"], whatever: ["z"] })).toEqual({ closeAt: "x", submissionKinds: "y", general: "z" });
  });
});

it("counts each student who handed in once, leaving out not-handed-in grades", () => {
  expect(handedInCount([
    { activityId: "1", studentId: "a" },
    { activityId: "1", studentId: "a" },
    { activityId: "1", studentId: "b", notHandedIn: true },
    { activityId: "2", studentId: "c" },
    { activityId: "1", studentId: "d" },
  ], "1")).toBe(2);
});
