import { describe, expect, it } from "vitest";
import type { Submission } from "../../../shared/api/overview";
import {
  blobTypeFor,
  filterCounts,
  matchesFilter,
  nextToGrade,
  notHandedInRefusal,
  returnable,
  rowStatus,
  safeLink,
  statusLabel,
  studentRows,
  viewableKind,
  type AssignmentSubmissions,
} from "./assignmentGrading";

const version = (over: Partial<Submission>): Submission => ({
  id: 1, studentId: "s0", studentName: "Alex Rivera", attemptNumber: 1, status: "submitted", startedAt: null, submittedAt: "2026-10-23T01:00:00Z",
  late: false, text: null, fileName: null, link: null, files: [], score: null, maxPoints: 20, feedback: null, gradedAt: null, daysLate: 0, penaltyPercent: 0, penaltyWaived: false, rawScore: null, rubricScores: [], ...over,
});

const list: AssignmentSubmissions = {
  items: [
    version({ id: 1, studentId: "s0", studentName: "Alex Rivera", attemptNumber: 1, status: "graded", score: 12 }),
    version({ id: 2, studentId: "s0", studentName: "Alex Rivera", attemptNumber: 2, status: "submitted", late: true }),
    version({ id: 3, studentId: "s1", studentName: "Jamie Lee", status: "graded", score: 18 }),
    version({ id: 4, studentId: "s2", studentName: "Sam Cruz", status: "returned", score: 20 }),
    version({ id: 5, studentId: "s3", studentName: "Noah Park", status: "graded", score: 0, notHandedIn: true, submittedAt: null }),
    version({ id: 6, studentId: "s5", studentName: "Mia Bell", status: "submitted" }),
  ],
  missing: [{ studentId: "s4", name: "Ana Diaz" }],
};

describe("studentRows", () => {
  it("gives one row per student with their latest version, sorted by last name", () => {
    const rows = studentRows(list);
    expect(rows.map((row) => row.name)).toEqual(["Mia Bell", "Sam Cruz", "Ana Diaz", "Jamie Lee", "Noah Park", "Alex Rivera"]);
    const alex = rows.find((row) => row.studentId === "s0");
    expect(alex?.latest?.id).toBe(2);
    expect(alex?.versions.map((item) => item.attemptNumber)).toEqual([1, 2]);
    expect(rows.find((row) => row.studentId === "s4")).toMatchObject({ status: "missing", versions: [] });
  });

  it("never shows a draft or a version taken back", () => {
    const rows = studentRows({ items: [version({ status: "in_progress" }), version({ id: 9, status: "withdrawn" })], missing: [] });
    expect(rows).toEqual([]);
  });
});

describe("rowStatus", () => {
  it("reads the latest version's status", () => {
    expect(rowStatus(undefined)).toBe("missing");
    expect(rowStatus(version({ status: "submitted" }))).toBe("needs-grading");
    expect(rowStatus(version({ status: "graded" }))).toBe("graded");
    expect(rowStatus(version({ status: "returned" }))).toBe("returned");
  });
});

describe("filters", () => {
  it("counts each filter; late and missing overlap with the others", () => {
    expect(filterCounts(studentRows(list))).toEqual({ all: 6, "needs-grading": 2, late: 1, missing: 2, graded: 2, returned: 1 });
  });

  it("puts a not-handed-in grade under Missing and Graded", () => {
    const noah = studentRows(list).find((row) => row.studentId === "s3")!;
    expect(matchesFilter(noah, "missing")).toBe(true);
    expect(matchesFilter(noah, "graded")).toBe(true);
    expect(matchesFilter(noah, "needs-grading")).toBe(false);
  });
});

describe("nextToGrade", () => {
  const rows = studentRows(list);
  it("finds the next student needing a grade in list order, wrapping to the top", () => {
    expect(nextToGrade(rows, "s5")?.studentId).toBe("s0");
    expect(nextToGrade(rows, "s0")?.studentId).toBe("s5");
    expect(nextToGrade(rows, undefined)?.studentId).toBe("s5");
  });

  it("is nothing when no one else needs grading", () => {
    expect(nextToGrade(rows.filter((row) => row.studentId !== "s5"), "s0")).toBeUndefined();
  });
});

describe("returnable", () => {
  it("is the graded work not returned yet", () => {
    expect(returnable(studentRows(list)).map((row) => row.studentId)).toEqual(["s1", "s3"]);
  });
});

describe("safeLink", () => {
  it("opens only http and https links", () => {
    expect(safeLink("https://example.com/er")).toBe("https://example.com/er");
    expect(safeLink(" http://example.com ")).toBe("http://example.com/");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("data:text/html,hi")).toBeNull();
    expect(safeLink("example.com")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});

describe("statusLabel", () => {
  const rows = studentRows(list);
  const row = (id: string) => rows.find((item) => item.studentId === id)!;
  it("says the state in words, and whether a grade is held", () => {
    expect(statusLabel(row("s0"), "immediate")).toBe("Needs grading");
    expect(statusLabel(row("s4"), "immediate")).toBe("Missing");
    expect(statusLabel(row("s1"), "immediate")).toBe("Graded · 18 / 20");
    expect(statusLabel(row("s1"), "returned")).toBe("Graded, not returned · 18 / 20");
    expect(statusLabel(row("s2"), "returned")).toBe("Returned · 20 / 20");
    expect(statusLabel(row("s3"), "immediate")).toBe("Not handed in · Graded · 0 / 20");
  });
});

describe("notHandedInRefusal", () => {
  const now = new Date("2026-10-23T01:00:00Z");
  it("waits for the due date, or for the last day of late work", () => {
    expect(notHandedInRefusal({ dueAt: "2026-10-24T00:00:00Z" }, now)).toMatch(/until the due date/);
    expect(notHandedInRefusal({ dueAt: "2026-10-22T00:00:00Z", closeAt: "2026-10-25T00:00:00Z" }, now)).toMatch(/until the last day/);
    expect(notHandedInRefusal({ dueAt: "2026-10-22T00:00:00Z" }, now)).toBeNull();
  });

  it("allows it with no due date or once closed, and never for a draft", () => {
    expect(notHandedInRefusal({}, now)).toBeNull();
    expect(notHandedInRefusal({ dueAt: "2026-10-24T00:00:00Z", closed: true }, now)).toBeNull();
    expect(notHandedInRefusal({ draft: true }, now)).toMatch(/published or closed/);
  });
});

describe("viewableKind and blobTypeFor", () => {
  it("shows images, PDF and text; Office files are download-only", () => {
    expect(viewableKind("image/png")).toBe("image");
    expect(viewableKind("application/pdf")).toBe("pdf");
    expect(viewableKind("text/plain; charset=utf-8")).toBe("text");
    expect(viewableKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBeNull();
    expect(viewableKind("text/html")).toBeNull();
  });

  it("never makes a blob that a browser would run as a page", () => {
    expect(blobTypeFor("image/png", "image")).toBe("image/png");
    expect(blobTypeFor("image/svg+xml", "image")).toBe("image/jpeg");
    expect(blobTypeFor("text/plain; charset=utf-8", "text")).toBe("text/plain");
  });
});
