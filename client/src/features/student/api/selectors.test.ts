import { describe, expect, it } from "vitest";
import { calendarEntries, courseModules, dueSoon, dueThisWeek, greeting, inMonth, monthGrid, needsWork, scoreAttempt, searchWorkspace, taskGroups, weekBounds } from "./selectors";
import type { Assessment } from "./types";

const NOW = new Date("2026-10-23T09:00:00").getTime(); // Friday
const item = (id: string, dueAt: string, type = "Quiz"): Assessment => ({
  id, courseId: "c", title: `Item ${id}`, type, description: "", dueAt, points: 10, timeLimit: "5 minutes", instructions: "",
});
const all = [
  item("past", "2026-10-22T16:00:00"),
  item("sat", "2026-10-24T23:59:00"),
  item("mon", "2026-10-26T23:59:00", "Long Quiz"),
  item("nov", "2026-11-03T09:00:00", "Exam"),
];

describe("student selectors", () => {
  it("bounds the week from Sunday to Sunday", () => {
    const { start, end } = weekBounds(NOW);
    expect(start.toDateString()).toBe("Sun Oct 18 2026");
    expect(end.toDateString()).toBe("Sun Oct 25 2026");
  });

  it("lists the next three unfinished items, skipping completed and past work", () => {
    expect(dueSoon(all, ["mon"], NOW).map((a) => a.id)).toEqual(["sat", "nov"]);
  });

  it("counts only unfinished work due before the week ends", () => {
    expect(dueThisWeek(all, [], NOW).map((a) => a.id)).toEqual(["sat"]);
  });

  it("groups tasks exactly like the classic Tasks page", () => {
    const groups = Object.fromEntries(taskGroups(all, ["mon"], NOW).map((g) => [g.status, g.items.map((a) => a.id)]));
    expect(groups).toEqual({ "Due soon": ["sat", "nov"], "Due this week": ["sat"], Missing: ["past"], Done: ["mon"] });
  });

  it("never lists excused work as due, due this week, or missing; work handed in before stays done (D-062)", () => {
    const excused = [...all.map((a) => (a.id === "past" || a.id === "sat" ? { ...a, excused: true } : a)), { ...item("done", "2026-10-22T16:00:00"), excused: true }];
    const groups = Object.fromEntries(taskGroups(excused, ["done"], NOW).map((g) => [g.status, g.items.map((a) => a.id)]));
    expect(groups).toEqual({ "Due soon": ["mon", "nov"], "Due this week": [], Missing: [], Done: ["done"] });
    expect(dueSoon(excused, [], NOW).map((a) => a.id)).toEqual(["mon", "nov"]);
    expect(dueThisWeek(excused, [], NOW)).toEqual([]);
    expect(needsWork({ id: "x", excused: true }, [])).toBe(false);
    expect(needsWork({ id: "x" }, [])).toBe(true);
    expect(needsWork({ id: "x" }, ["x"])).toBe(false);
  });

  it("searches classes, assessments by title or type, and materials, capped at six", () => {
    const results = searchWorkspace("exam", { courses: [], assessments: all, materials: [] });
    expect(results).toEqual([{ kind: "Exam", title: "Item nov", id: "nov", target: "assessment" }]);
    expect(searchWorkspace("  ", { courses: [], assessments: all, materials: [] })).toEqual([]);
  });

  it("builds month grids and month entries", () => {
    const october = new Date(2026, 9, 1);
    expect(monthGrid(october).slice(0, 5)).toEqual([null, null, null, null, 1]);
    expect(monthGrid(october, 42)).toHaveLength(42);
    const entries = calendarEntries(all, [{ id: "e", title: "Holiday", date: "2026-11-11", category: "No classes" }]);
    expect(inMonth(entries, new Date(2026, 10, 1)).map((e) => e.id)).toEqual(["nov", "e"]);
  });

  it("scores attempts and greets by time of day", () => {
    expect(scoreAttempt([{ correct: 0 }, { correct: 2 }], { 0: 0, 1: 1 })).toBe(1);
    expect(greeting(NOW)).toBe("Good morning");
    expect(greeting(new Date("2026-10-23T19:00:00").getTime())).toBe("Good evening");
  });
});

describe("courseModules", () => {
  const catalog = {
    modules: [
      { id: "2", courseId: "c", parentId: "1", title: "1.1 Joins", order: 1 },
      { id: "1", courseId: "c", title: "Unit 1", order: 1 },
      { id: "9", courseId: "other", title: "Elsewhere", order: 1 },
    ],
    materials: [
      { id: "m1", courseId: "c", moduleId: "2", title: "Join notes", kind: "Reading", readTime: "1 min", summary: "", added: "", goal: "", points: [] },
      { id: "m2", courseId: "c", moduleId: "1", title: "Intro", kind: "Study guide", readTime: "1 min", summary: "", added: "", goal: "", points: [] },
    ],
    assessments: [{ ...item("q1", ""), moduleId: "2" }],
  };

  it("nests each submodule under its module with the content placed in it", () => {
    const [unit, ...rest] = courseModules(catalog, "c");
    expect(rest).toEqual([]);
    expect(unit?.module.title).toBe("Unit 1");
    expect(unit?.entries.map((entry) => entry.title)).toEqual(["Intro"]);
    expect(unit?.submodules.map((sub) => [sub.module.title, sub.entries.map((entry) => `${entry.kind}:${entry.title}`)])).toEqual([
      ["1.1 Joins", ["material:Join notes", "assessment:Item q1"]],
    ]);
  });
});
