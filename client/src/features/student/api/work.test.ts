import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/http";
import type { Submission, TurnIn } from "../../../shared/api/overview";
import { afterUnsubmit, canRetry, daysLate, filesLeftLabel, formatPoints, gradeSum, hasWork, isWebAddress, latePenaltyNow, REFUSALS, shouldRetrySave, splitWork, turnInContents, withRow, workBadges } from "./work";

const file = (id: number, name: string) => ({ id, name, contentType: "application/pdf", size: 1000, code: `CODE-${id}`, sameAsAnotherStudent: null });
const row = (attemptNumber: number, status: Submission["status"], extra: Partial<Submission> = {}): Submission => ({
  id: 100 + attemptNumber, studentId: "STU-1", studentName: null, attemptNumber, status, startedAt: null,
  submittedAt: status === "in_progress" ? null : "2026-10-23T01:00:00Z", late: false, text: null, fileName: null, link: null, files: [],
  score: null, maxPoints: 20, feedback: null, gradedAt: null, daysLate: 0, penaltyPercent: 0, penaltyWaived: false, rawScore: null, rubricScores: [], ...extra,
});
const verdict = (state: TurnIn["state"], extra: Partial<TurnIn> = {}): TurnIn => ({ state, canTurnIn: true, reason: null, late: false, canUnsubmit: false, dueAt: null, closeAt: null, extended: false, ...extra });

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

describe("late penalties (contract §10)", () => {
  // Due Nov 20, 4:00 PM in Manila (UTC+8).
  const due = "2026-11-20T08:00:00Z";
  const at = (iso: string) => new Date(iso).getTime();

  it("counts calendar days late in Manila, at least 1 for any late work", () => {
    expect(daysLate(due, at("2026-11-20T08:00:00Z"))).toBe(0);
    expect(daysLate(due, at("2026-11-20T07:59:00Z"))).toBe(0);
    // Nov 20, 6:00 PM and any time on Nov 21 are 1 day; Nov 22 is 2 days.
    expect(daysLate(due, at("2026-11-20T10:00:00Z"))).toBe(1);
    expect(daysLate(due, at("2026-11-20T16:30:00Z"))).toBe(1); // Nov 21, 12:30 AM in Manila
    expect(daysLate(due, at("2026-11-21T15:59:00Z"))).toBe(1); // Nov 21, 11:59 PM
    expect(daysLate(due, at("2026-11-21T16:00:00Z"))).toBe(2); // Nov 22, midnight
    // The date in Manila, not in UTC: Nov 21, 1:00 AM in Manila is still Nov 20 in UTC.
    expect(daysLate("2026-11-20T15:00:00Z", at("2026-11-20T17:00:00Z"))).toBe(1);
    expect(daysLate("2026-11-20T15:00:00Z", at("2026-11-22T17:00:00Z"))).toBe(3);
  });

  it("says what turning in now would lose, up to the cap, and nothing without a penalty", () => {
    const settings = { dueAt: due, allowLate: true, latePenaltyPercentPerDay: 10, latePenaltyMaxPercent: 100 };
    expect(latePenaltyNow(settings, at("2026-11-22T02:00:00Z"))).toBe("Turning in now is 2 days late: 20% comes off the score.");
    expect(latePenaltyNow(settings, at("2026-11-20T09:00:00Z"))).toBe("Turning in now is 1 day late: 10% comes off the score.");
    expect(latePenaltyNow({ ...settings, latePenaltyMaxPercent: 25 }, at("2026-11-25T02:00:00Z"))).toBe("Turning in now is 5 days late: 25% comes off the score.");
    expect(latePenaltyNow(settings, at("2026-11-19T02:00:00Z"))).toBeNull();
    expect(latePenaltyNow({ ...settings, latePenaltyPercentPerDay: 0 }, at("2026-11-22T02:00:00Z"))).toBeNull();
    expect(latePenaltyNow({ ...settings, dueAt: null }, at("2026-11-22T02:00:00Z"))).toBeNull();
  });

  it("shows a grade as a sum: points given, the penalty and days late, the score after it", () => {
    const late = row(1, "graded", { score: 14.4, rawScore: 18, daysLate: 2, penaltyPercent: 20, late: true });
    expect(gradeSum(late)).toEqual({
      lines: [
        { label: "Points given", value: "18 of 20 points" },
        { label: "Late penalty", value: "20% off, 2 days late" },
        { label: "Your score", value: "14.4 of 20 points" },
      ],
      note: "Your instructor gave 18 of 20 points. The work was 2 days late, so 20% came off: 18 − 3.6 = 14.4.",
    });
    expect(gradeSum({ ...late, penaltyPercent: 0, penaltyWaived: true, score: 18 })).toEqual({
      lines: [{ label: "Your score", value: "18 of 20 points" }],
      note: "Late penalty waived. The work was 2 days late, and nothing came off.",
    });
    expect(gradeSum(row(1, "returned", { score: 18, rawScore: 18 }))).toEqual({ lines: [{ label: "Your score", value: "18 of 20 points" }], note: null });
    // A held grade arrives as submitted, without a score.
    expect(gradeSum(row(1, "submitted", { daysLate: 2 }))).toBeNull();
    expect(formatPoints(14.399999)).toBe("14.4");
  });
});
