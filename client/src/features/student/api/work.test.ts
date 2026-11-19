import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/http";
import type { Submission, TurnIn } from "../../../shared/api/overview";
import { afterUnsubmit, canRetry, filesLeftLabel, hasWork, isWebAddress, REFUSALS, shouldRetrySave, splitWork, turnInContents, withRow, workBadges } from "./work";

const file = (id: number, name: string) => ({ id, name, contentType: "application/pdf", size: 1000, code: `CODE-${id}`, sameAsAnotherStudent: null });
const row = (attemptNumber: number, status: Submission["status"], extra: Partial<Submission> = {}): Submission => ({
  id: 100 + attemptNumber, studentId: "STU-1", studentName: null, attemptNumber, status, startedAt: null,
  submittedAt: status === "in_progress" ? null : "2026-10-23T01:00:00Z", late: false, text: null, fileName: null, link: null, files: [],
  score: null, maxPoints: 20, feedback: null, gradedAt: null, ...extra,
});
const verdict = (state: TurnIn["state"], extra: Partial<TurnIn> = {}): TurnIn => ({ state, canTurnIn: true, reason: null, late: false, canUnsubmit: false, ...extra });

describe("work state in words", () => {
  it("names every state, and adds Late only when the work turned in was late", () => {
    expect(workBadges(verdict("assigned"), undefined)).toEqual([{ label: "Assigned", tone: "brand" }]);
    expect(workBadges(verdict("draft"), undefined).map((badge) => badge.label)).toEqual(["Draft"]);
    expect(workBadges(verdict("missing"), undefined).map((badge) => badge.label)).toEqual(["Missing"]);
    expect(workBadges(verdict("turned_in"), row(1, "submitted", { late: true })).map((badge) => badge.label)).toEqual(["Turned in", "Late"]);
    expect(workBadges(verdict("graded"), row(1, "graded")).map((badge) => badge.label)).toEqual(["Graded"]);
    expect(workBadges(verdict("returned"), row(1, "returned")).map((badge) => badge.label)).toEqual(["Returned"]);
    expect(workBadges(verdict("not_handed_in"), undefined).map((badge) => badge.label)).toEqual(["Not handed in"]);
  });

  it("keeps the page's earlier wording for past due and past the last day", () => {
    expect(REFUSALS.past_due).toBe("The due date has passed and late submissions are turned off.");
    expect(REFUSALS.past_close).toBe("The last day for late work has passed.");
  });
});

describe("splitWork", () => {
  it("finds the draft, the latest handed-in version, and earlier versions newest first", () => {
    const rows = [row(1, "withdrawn"), row(2, "submitted"), row(3, "in_progress")];
    const { draft, current, earlier } = splitWork(rows);
    expect(draft?.attemptNumber).toBe(3);
    expect(current?.attemptNumber).toBe(2);
    expect(earlier.map((item) => item.attemptNumber)).toEqual([1]);
  });

  it("never treats a taken-back version or a not-handed-in grade as the current work", () => {
    expect(splitWork([row(1, "withdrawn"), row(2, "in_progress")]).current).toBeUndefined();
    expect(splitWork([row(1, "graded", { notHandedIn: true, submittedAt: null })])).toEqual({ draft: undefined, current: undefined, earlier: [] });
  });

  it("updates the list from a write's answer, and withdraws the version a take-back replaced", () => {
    const rows = [row(1, "submitted")];
    expect(withRow(rows, row(2, "in_progress")).map((item) => item.status)).toEqual(["submitted", "in_progress"]);
    expect(withRow(rows, { ...row(1, "submitted"), text: "new" })[0]?.text).toBe("new");
    expect(afterUnsubmit(rows, row(2, "in_progress")).map((item) => item.status)).toEqual(["withdrawn", "in_progress"]);
  });
});

describe("what the confirmation lists", () => {
  it("lists one line per kind the assignment takes, and every file by name", () => {
    const draft = row(1, "in_progress", { text: "My answer", link: "https://example.com/work", files: [file(1, "a.pdf"), file(2, "b.png")] });
    expect(turnInContents(draft, ["text", "link", "file"])).toEqual([
      { label: "Written answer", value: "Yes" },
      { label: "Link", value: "https://example.com/work" },
      { label: "File 1", value: "a.pdf" },
      { label: "File 2", value: "b.png" },
    ]);
    expect(turnInContents(row(1, "in_progress", { text: "  " }), ["text", "file"])).toEqual([{ label: "Written answer", value: "No" }, { label: "Files", value: "None" }]);
    expect(turnInContents(undefined, ["link"])).toEqual([{ label: "Link", value: "None" }]);
  });

  it("knows when there is something to turn in", () => {
    expect(hasWork(undefined)).toBe(false);
    expect(hasWork({ text: "  ", link: null, files: [] })).toBe(false);
    expect(hasWork({ text: null, link: null, files: [file(1, "a.pdf")] })).toBe(true);
    expect(hasWork({ text: null, link: "https://example.com", files: [] })).toBe(true);
  });
});

describe("files, links, and retries", () => {
  it("says how many files are left", () => {
    expect(filesLeftLabel(5, 3)).toBe("You can add 2 more files.");
    expect(filesLeftLabel(2, 1)).toBe("You can add 1 more file.");
    expect(filesLeftLabel(1, 1)).toBe("No more files. This assignment takes at most 1 file.");
  });

  it("accepts only full http and https addresses", () => {
    expect(isWebAddress("https://docs.example.com/a")).toBe(true);
    expect(isWebAddress("http://example.com")).toBe(true);
    expect(isWebAddress("docs.example.com")).toBe(false);
    expect(isWebAddress("javascript:alert(1)")).toBe(false);
  });

  it("retries the connection and the server, never a refused file or invalid work", () => {
    const failure = (status: number, kind: ConstructorParameters<typeof ApiError>[0]["kind"] = "http") => new ApiError({ kind, status, url: "/x" });
    expect(canRetry(failure(0, "network"))).toBe(true);
    expect(canRetry(failure(503))).toBe(true);
    expect(canRetry(failure(409))).toBe(true);
    expect(canRetry(failure(422))).toBe(false);
    expect(shouldRetrySave(failure(0, "network"))).toBe(true);
    expect(shouldRetrySave(failure(400))).toBe(false);
    expect(shouldRetrySave(failure(409))).toBe(false);
  });
});
