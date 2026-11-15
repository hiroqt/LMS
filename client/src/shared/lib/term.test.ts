import { describe, expect, it } from "vitest";
import { academicEvents } from "../../data.js";
import { termStatus } from "./term";
import type { SchoolEvent } from "./schoolNews";

const events = academicEvents as SchoolEvent[];
const at = (date: string) => new Date(`${date}T09:00:00`).getTime();

describe("termStatus", () => {
  it("knows the week of term and the next milestone", () => {
    const term = termStatus(events, at("2026-10-23"))!;
    expect(term).toMatchObject({ name: "Fall 2026", week: 10, totalWeeks: 18, phase: "in" });
    expect(term.next).toMatchObject({ title: "Midterm exam week begins", week: 12, inDays: 10, kind: "exam" });
  });

  it("lists exams, breaks, and deadlines as milestones, once each", () => {
    const titles = termStatus(events, at("2026-10-23"))!.milestones.map((item) => item.title);
    expect(titles).toContain("Midterm exam week begins");
    expect(titles).toContain("Fall break begins");
    expect(titles).toContain("Final exam week begins");
    expect(titles).not.toContain("Midterm exam week ends");
  });

  it("clamps before and after the term", () => {
    expect(termStatus(events, at("2026-08-01"))).toMatchObject({ week: 1, phase: "before" });
    expect(termStatus(events, at("2027-01-10"))).toMatchObject({ week: 18, phase: "after", next: undefined });
  });

  it("returns null without term dates", () => {
    expect(termStatus([], Date.now())).toBeNull();
  });
});
