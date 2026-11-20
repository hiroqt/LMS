import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/http";
import type { Submission } from "../../../shared/api/overview";
import {
  afterPenalty,
  blobTypeFor,
  filterCounts,
  gradedMissingSentence,
  matchesFilter,
  nextToGrade,
  nextToGradeIn,
  notHandedInRefusal,
  penaltyPercentFor,
  penaltySum,
  returnable,
  rowStatus,
  rubricErrorsFrom,
  rubricProblems,
  safeLink,
  selectedReturnable,
  statusLabel,
  studentRows,
  viewableKind,
  writeResult,
  zipName,
  type AssignmentSubmissions,
} from "./assignmentGrading";

const version = (over: Partial<Submission>): Submission => ({
  id: 1, studentId: "s0", studentName: "Alex Rivera", attemptNumber: 1, status: "submitted", startedAt: null, submittedAt: "2026-10-23T01:00:00Z",
  late: false, text: null, fileName: null, link: null, files: [], score: null, maxPoints: 20, feedback: null, gradedAt: null, daysLate: 0, penaltyPercent: 0, penaltyWaived: false, rawScore: null, rubricScores: [], excused: false, ...over,
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
    expect(filterCounts(studentRows(list))).toEqual({ all: 6, "needs-grading": 2, late: 1, missing: 2, graded: 2, returned: 1, excused: 0 });
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

describe("nextToGradeIn", () => {
  // Needing a grade: Mia Bell (s5, on time) and Alex Rivera (s0, late), plus a second late student.
  const rows = studentRows({ ...list, items: [...list.items, version({ id: 7, studentId: "s6", studentName: "Zed Young", status: "submitted", late: true })] });

  it("stays among the students the filter shows", () => {
    // In "Late", after Alex comes Zed, not Mia, who is next in the whole class.
    expect(nextToGrade(rows, "s0")?.studentId).toBe("s6");
    expect(nextToGradeIn(rows, "late", "s6")?.studentId).toBe("s0");
    expect(nextToGrade(rows, "s6")?.studentId).toBe("s5");
    expect(nextToGradeIn(rows, "all", "s6")?.studentId).toBe("s5");
  });

  it("moves on to the rest of the class only when nobody in the filter is left", () => {
    const oneLate = studentRows(list);
    expect(nextToGradeIn(oneLate, "late", "s0")?.studentId).toBe("s5");
    expect(nextToGradeIn(oneLate.filter((row) => row.studentId !== "s5"), "late", "s0")).toBeUndefined();
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

describe("excused students (contract §11)", () => {
  // Mia needs grading, Ana handed in nothing, Jamie is graded; all three are excused.
  const excused = { dueAt: null, closeAt: null, excused: true };
  const rows = studentRows({ ...list, exceptions: [{ studentId: "s5", ...excused }, { studentId: "s4", ...excused }, { studentId: "s1", ...excused }, { studentId: "s0", dueAt: "2026-10-30T00:00:00Z", closeAt: null, excused: false }] });
  const row = (id: string) => rows.find((item) => item.studentId === id)!;

  it("keeps each student's own terms on their row", () => {
    expect(row("s5")).toMatchObject({ excused: true, exception: { studentId: "s5" } });
    expect(row("s0")).toMatchObject({ excused: false, exception: { dueAt: "2026-10-30T00:00:00Z" } });
    expect(row("s2").exception).toBeUndefined();
  });

  it("moves them out of Needs grading and Missing, into Excused", () => {
    expect(filterCounts(rows)).toEqual({ all: 6, "needs-grading": 1, late: 1, missing: 1, graded: 2, returned: 1, excused: 3 });
    expect(matchesFilter(row("s4"), "missing")).toBe(false);
    expect(matchesFilter(row("s5"), "needs-grading")).toBe(false);
  });

  it("says Excused instead of Missing or Needs grading, and keeps a grade already given", () => {
    expect(statusLabel(row("s4"), "immediate")).toBe("Excused");
    expect(statusLabel(row("s5"), "immediate")).toBe("Excused");
    expect(statusLabel(row("s1"), "immediate")).toBe("Graded · 18 / 20");
  });

  it("is never next to grade", () => {
    expect(nextToGrade(rows, "s0")).toBeUndefined();
  });
});

describe("notHandedInRefusal with a student's own dates", () => {
  const now = new Date("2026-10-23T01:00:00Z");
  const own = (dueAt: string, closeAt: string | null = null) => ({ studentId: "s3", dueAt, closeAt, excused: false });
  it("waits for their own last day, in the server's words", () => {
    expect(notHandedInRefusal({ dueAt: "2026-10-22T00:00:00Z" }, now, own("2026-10-24T00:00:00Z"))).toMatch(/their own dates/);
    expect(notHandedInRefusal({ dueAt: "2026-10-20T00:00:00Z", closeAt: "2026-10-22T00:00:00Z" }, now, own("2026-10-21T00:00:00Z", "2026-10-25T00:00:00Z"))).toMatch(/their own dates/);
  });

  it("allows it once their own last day has passed, and ignores a date the class has moved past", () => {
    expect(notHandedInRefusal({ dueAt: "2026-10-20T00:00:00Z" }, now, own("2026-10-22T00:00:00Z"))).toBeNull();
    expect(notHandedInRefusal({ dueAt: "2026-10-22T00:00:00Z" }, now, own("2026-10-21T00:00:00Z"))).toBeNull();
  });
});

describe("late penalty (contract §10)", () => {
  const settings = { latePenaltyPercentPerDay: 10, latePenaltyMaxPercent: 30, maxScore: 20 };
  it("takes a percent per day late, up to the cap, and nothing when waived or on time", () => {
    expect(penaltyPercentFor(settings, 2)).toBe(20);
    expect(penaltyPercentFor(settings, 5)).toBe(30);
    expect(penaltyPercentFor(settings, 2, true)).toBe(0);
    expect(penaltyPercentFor(settings, 0)).toBe(0);
    expect(penaltyPercentFor({ latePenaltyPercentPerDay: 0, latePenaltyMaxPercent: 100 }, 3)).toBe(0);
  });

  it("rounds the score after it to two decimals, as the server does", () => {
    expect(afterPenalty(18, 20)).toBe(14.4);
    expect(afterPenalty(7, 15)).toBe(5.95);
    expect(afterPenalty(0.05, 10)).toBe(0.05);
  });

  it("words the sum, or the waiver, and nothing for work on time or without a penalty", () => {
    expect(penaltySum(settings, { raw: 18, daysLate: 2, waived: false })).toBe("18 − 20% (2 days late) = 14.4 of 20");
    expect(penaltySum(settings, { raw: 18, daysLate: 1, waived: false })).toBe("18 − 10% (1 day late) = 16.2 of 20");
    expect(penaltySum(settings, { raw: 18, daysLate: 2, waived: true })).toBe("18 of 20: late penalty waived (2 days late)");
    expect(penaltySum(settings, { raw: 18, daysLate: 0, waived: false })).toBeNull();
    expect(penaltySum({ ...settings, latePenaltyPercentPerDay: 0 }, { raw: 18, daysLate: 2, waived: false })).toBeNull();
  });
});

describe("rubric grading (contract §12)", () => {
  const rubric = {
    criteria: [
      { id: 7, title: "Analysis", description: null, levels: [{ id: 21, title: "Complete", description: null, points: 10 }, { id: 22, title: "Partial", description: null, points: 5 }] },
      { id: 8, title: "Presentation", description: null, levels: [{ id: 31, title: "Clear", description: null, points: 5 }] },
    ],
  };
  it("asks for a level on every criterion without one", () => {
    expect(rubricProblems(rubric, { 7: 22 })).toEqual({ 8: "Choose a level for Presentation." });
    expect(rubricProblems(rubric, { 7: 99, 8: 31 })).toEqual({ 7: "Choose a level for Analysis." });
    expect(rubricProblems(rubric, { 7: 21, 8: 31 })).toEqual({});
  });

  it("reads the server's rubric[<id>] errors by criterion", () => {
    expect(rubricErrorsFrom({ "rubric[8]": ["Choose a level."], points: ["x"], feedback: [] })).toEqual({ 8: "Choose a level." });
    expect(rubricErrorsFrom(undefined)).toEqual({});
  });
});

describe("selectedReturnable", () => {
  it("keeps only chosen students whose work is graded and not returned, in list order", () => {
    // s2 is returned, s5 needs grading: neither can be returned.
    expect(selectedReturnable(studentRows(list), new Set(["s3", "s2", "s5", "s1"]))).toEqual(["s1", "s3"]);
  });
});

describe("gradedMissingSentence", () => {
  it("says how many were graded and how many were skipped for their own last day", () => {
    expect(gradedMissingSentence(8, 0, "0 / 20")).toBe("0 / 20 for 8 students who didn't hand in.");
    expect(gradedMissingSentence(7, 1, "0 / 20")).toBe("0 / 20 for 7 students who didn't hand in. 1 student skipped: their own last day has not passed.");
    expect(gradedMissingSentence(0, 2, "0 / 20")).toBe("Nobody was graded. 2 students skipped: their own last day has not passed.");
  });
});

describe("zipName", () => {
  it("makes a safe file name from the title", () => {
    expect(zipName("ER diagram")).toBe("ER diagram-work.zip");
    expect(zipName("Lab 1/2: <loops>")).toBe("Lab 12 loops-work.zip");
    expect(zipName("???")).toBe("assignment-work.zip");
  });
});

describe("writeResult", () => {
  const fail = (error: ApiError) => () => Promise.reject(error);
  it("shows the server's own sentence for a refusal", async () => {
    const result = await writeResult(fail(new ApiError({ kind: "http", status: 409, url: "/x", title: "These files add up to more than 250 MB. Download them from each student's work instead." })));
    expect(result).toMatchObject({ ok: false, message: "These files add up to more than 250 MB. Download them from each student's work instead." });
  });

  it("keeps field errors, and uses a lone one as the message", async () => {
    const one = await writeResult(fail(new ApiError({ kind: "http", status: 400, url: "/x", fieldErrors: { dueAt: ["A student's own due date must be after the assignment's due date."] } })));
    expect(one.message).toBe("A student's own due date must be after the assignment's due date.");
    expect(one.fieldErrors?.dueAt).toHaveLength(1);
    const two = await writeResult(fail(new ApiError({ kind: "http", status: 400, url: "/x", fieldErrors: { dueAt: ["a"], closeAt: ["b"] } })));
    expect(two.message).toBe("Check the highlighted fields.");
  });

  it("is ok when the write is stored", async () => {
    expect(await writeResult(() => Promise.resolve())).toEqual({ ok: true });
  });
});

describe("afterPenalty", () => {
  it("rounds half away from zero exactly as the server's decimals do", () => {
    // 7.5 × 0.63 is 4.725: floating point would give 4.72, the server stores 4.73.
    expect(afterPenalty(7.5, 37)).toBe(4.73);
    expect(afterPenalty(2.5, 13)).toBe(2.18);
    expect(afterPenalty(4.5, 7)).toBe(4.19);
    expect(afterPenalty(18, 20)).toBe(14.4);
    expect(afterPenalty(18.52, 10)).toBe(16.67);
    expect(afterPenalty(20, 0)).toBe(20);
    expect(afterPenalty(20, 100)).toBe(0);
    expect(afterPenalty(0, 50)).toBe(0);
  });

  it("agrees with exact arithmetic for every half point and percent", () => {
    for (let half = 0; half <= 200; half += 1)
      for (let percent = 0; percent <= 100; percent += 1) {
        // Exact, in integers: (half × 50 cents) × (100 − percent) hundredths, rounded half up to cents.
        const exact = Math.floor((half * 50 * (100 - percent) + 50) / 100) / 100;
        expect(afterPenalty(half / 2, percent)).toBe(exact);
      }
  });
});
