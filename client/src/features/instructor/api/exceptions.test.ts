import { describe, expect, it } from "vitest";
import { extendedDue, extensionBody, extensionProblems, extensionStart, localInput, ownDatesLabel, studentLastDay, type StudentException } from "./exceptions";

const own = (dueAt: string | null, closeAt: string | null = null): StudentException => ({ studentId: "s1", dueAt, closeAt, excused: false });
const DUE = "2026-10-22T08:00:00Z";
const CLOSE = "2026-10-24T08:00:00Z";

describe("extendedDue", () => {
  it("is their own due date only while it is after the class's", () => {
    expect(extendedDue({ dueAt: DUE }, own("2026-10-23T08:00:00Z"))).toBe("2026-10-23T08:00:00Z");
    expect(extendedDue({ dueAt: DUE }, own("2026-10-21T08:00:00Z"))).toBeNull();
    expect(extendedDue({ dueAt: DUE }, own(DUE))).toBeNull();
    expect(extendedDue({ dueAt: DUE }, own(null))).toBeNull();
    expect(extendedDue({}, own("2026-10-23T08:00:00Z"))).toBeNull();
    expect(extendedDue({ dueAt: DUE }, undefined)).toBeNull();
  });
});

describe("studentLastDay", () => {
  it("is the class's without own dates", () => {
    expect(studentLastDay({ dueAt: DUE, closeAt: CLOSE }, undefined)).toBe(CLOSE);
    expect(studentLastDay({ dueAt: DUE }, undefined)).toBe(DUE);
    expect(studentLastDay({}, undefined)).toBeNull();
  });

  it("is the latest of their last day, the class's last day, and their due date", () => {
    expect(studentLastDay({ dueAt: DUE, closeAt: CLOSE }, own("2026-10-23T08:00:00Z", "2026-10-26T08:00:00Z"))).toBe("2026-10-26T08:00:00Z");
    expect(studentLastDay({ dueAt: DUE, closeAt: CLOSE }, own("2026-10-23T08:00:00Z"))).toBe(CLOSE);
    expect(studentLastDay({ dueAt: DUE, closeAt: CLOSE }, own("2026-10-25T08:00:00Z"))).toBe("2026-10-25T08:00:00Z");
  });

  it("is their due date when the class has no last day", () => {
    expect(studentLastDay({ dueAt: DUE }, own("2026-10-25T08:00:00Z", "2026-10-28T08:00:00Z"))).toBe("2026-10-25T08:00:00Z");
  });
});

describe("ownDatesLabel", () => {
  it("names their own due date, and their own last day when the class has one", () => {
    expect(ownDatesLabel({ dueAt: DUE }, own("2026-10-25T08:00:00Z"))).toMatch(/^Own due date: Oct 25/);
    expect(ownDatesLabel({ dueAt: DUE, closeAt: CLOSE }, own("2026-10-23T08:00:00Z", "2026-10-26T08:00:00Z"))).toMatch(/^Own due date: Oct 23.* · Own last day: Oct 26/);
    expect(ownDatesLabel({ dueAt: DUE }, undefined)).toBeNull();
  });
});

describe("extensionProblems", () => {
  const settings = { dueAt: DUE, closeAt: CLOSE, allowLate: true };
  const at = (iso: string) => localInput(iso);
  it("needs a due date after the class's", () => {
    expect(extensionProblems({ dueAt: "", closeAt: "" }, settings)).toEqual({ dueAt: "Choose this student's due date." });
    expect(extensionProblems({ dueAt: at("2026-10-21T08:00:00Z"), closeAt: "" }, settings).dueAt).toMatch(/after the assignment's due date/);
    expect(extensionProblems({ dueAt: at("2026-10-23T08:00:00Z"), closeAt: "" }, settings)).toEqual({});
  });

  it("needs a last day after their due date, and only when the class has a last day", () => {
    expect(extensionProblems({ dueAt: at("2026-10-23T08:00:00Z"), closeAt: at("2026-10-23T07:00:00Z") }, settings).closeAt).toMatch(/after this student's due date/);
    expect(extensionProblems({ dueAt: at("2026-10-23T08:00:00Z"), closeAt: at("2026-10-26T08:00:00Z") }, settings)).toEqual({});
    expect(extensionProblems({ dueAt: at("2026-10-23T08:00:00Z"), closeAt: at("2026-10-26T08:00:00Z") }, { dueAt: DUE, allowLate: true }).closeAt).toMatch(/no last day/);
  });
});

describe("extensionStart and extensionBody", () => {
  it("starts from their own dates, or a day after the class's due date", () => {
    expect(extensionStart({ dueAt: DUE }, undefined)).toEqual({ dueAt: localInput("2026-10-23T08:00:00Z"), closeAt: "" });
    expect(extensionStart({ dueAt: DUE, closeAt: CLOSE }, own("2026-10-25T08:00:00Z", "2026-10-27T08:00:00Z"))).toEqual({ dueAt: localInput("2026-10-25T08:00:00Z"), closeAt: localInput("2026-10-27T08:00:00Z") });
  });

  it("sends instants, and no last day when none was chosen", () => {
    const form = { dueAt: localInput("2026-10-25T08:00:00Z"), closeAt: "" };
    expect(extensionBody(form)).toEqual({ dueAt: "2026-10-25T08:00:00.000Z" });
    expect(extensionBody({ ...form, closeAt: localInput("2026-10-27T08:00:00Z") })).toEqual({ dueAt: "2026-10-25T08:00:00.000Z", closeAt: "2026-10-27T08:00:00.000Z" });
  });
});
