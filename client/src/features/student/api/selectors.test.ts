import { describe, expect, it } from "vitest";
import { calendarEntries, courseModules, courseTopic, dueSoon, dueThisWeek, greeting, inMonth, materialSequence, materialsByModule, monthGrid, needsWork, newestFirst, scoreAttempt, searchWorkspace, taskGroups, weekBounds } from "./selectors";
import type { Assessment, Material } from "./types";

const NOW = new Date("2026-10-23T09:00:00").getTime(); // Friday
const material = (id: string, moduleId: string | undefined, title: string, createdAt = "2026-10-01T00:00:00Z"): Material => ({
  id, courseId: "c", ...(moduleId ? { moduleId } : {}), title, kind: "Study guide", summary: "", added: "", createdAt, file: null,
});
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
    materials: [material("m1", "2", "Join notes"), material("m2", "1", "Intro")],
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

describe("materials by module (D-067)", () => {
  const catalog = {
    modules: [
      { id: "3", courseId: "c", title: "Unit 2", order: 2 },
      { id: "2", courseId: "c", parentId: "1", title: "1.1 Joins", order: 1 },
      { id: "1", courseId: "c", title: "Unit 1", order: 1 },
      { id: "4", courseId: "c", title: "Unit 3 (empty)", order: 3 },
      { id: "9", courseId: "other", title: "Elsewhere", order: 1 },
    ],
    materials: [
      material("m1", "2", "Join notes", "2026-10-05T00:00:00Z"),
      material("m2", "3", "Indexes", "2026-10-09T00:00:00Z"),
      material("m3", "1", "Intro", "2026-10-02T00:00:00Z"),
      material("m4", "1", "Keys", "2026-10-03T00:00:00Z"),
      material("m5", "missing", "Loose sheet", "2026-10-07T00:00:00Z"),
      { ...material("x", "9", "Other class"), courseId: "other" },
    ],
  };

  it("groups by module, then submodule, in the instructor's order, leaving out empty modules", () => {
    const groups = materialsByModule(catalog, "c");
    expect(groups.map((group) => [group.title, group.materials.map((item) => item.title), group.submodules.map((sub) => [sub.title, sub.materials.map((item) => item.title)])])).toEqual([
      ["Unit 1", ["Intro", "Keys"], [["1.1 Joins", ["Join notes"]]]],
      ["Unit 2", ["Indexes"], []],
      ["Other materials", ["Loose sheet"], []],
    ]);
  });

  it("reads module by module for previous and next, and sorts newest first", () => {
    expect(materialSequence(catalog, "c").map((item) => item.id)).toEqual(["m3", "m4", "m1", "m2", "m5"]);
    expect(newestFirst(catalog.materials.filter((item) => item.courseId === "c")).map((item) => item.id)).toEqual(["m2", "m5", "m1", "m4", "m3"]);
  });
});

describe("courseTopic", () => {
  const work = (id: string, type: string, moduleId: string, kind?: "activity"): Assessment => ({ ...item(id, "", type), title: id, moduleId, ...(kind ? { kind } : {}) });
  const catalog = {
    modules: [
      { id: "4", courseId: "c", parentId: "1", title: "1.2 Views", order: 2 },
      { id: "2", courseId: "c", parentId: "1", title: "1.1 Joins", order: 1 },
      { id: "1", courseId: "c", title: "Unit 1", order: 1 },
      { id: "3", courseId: "c", title: "Unit 2", order: 2 },
      { id: "9", courseId: "other", title: "Elsewhere", order: 1 },
    ],
    materials: [
      material("m1", "2", "Join notes"),
      material("m2", "3", "Unit 2 notes"),
    ],
    assessments: [
      work("essay", "Assignment", "1", "activity"),
      work("lab", "Lab activity", "2", "activity"),
      work("quiz", "Quiz", "1"),
      work("exam", "Exam", "2"),
      work("later", "Quiz", "3"),
    ],
  };
  const titles = (topicId: string) => Object.fromEntries(courseTopic(catalog, "c", topicId)?.groups.map((group) => [group.category, group.entries.map((entry) => entry.title)]) ?? []);

  it("groups a topic's own and its submodules' content by category, and nothing from other topics", () => {
    expect(titles("1")).toEqual({ Assignments: ["essay"], Activities: ["lab"], Assessments: ["quiz", "exam"], Materials: ["Join notes"] });
    expect(titles("3")).toEqual({ Assignments: [], Activities: [], Assessments: ["later"], Materials: ["Unit 2 notes"] });
  });

  it("lists the columns in the module page's order (D-073)", () => {
    expect(courseTopic(catalog, "c", "1")?.groups.map((group) => group.category)).toEqual(["Assessments", "Activities", "Assignments", "Materials"]);
  });

  it("splits each column into the module's own items, then one group per submodule that has some (D-073)", () => {
    const sections = (category: string) =>
      courseTopic(catalog, "c", "1")
        ?.groups.find((group) => group.category === category)
        ?.sections.map((section) => [section.submodule?.title ?? "own", section.entries.map((entry) => entry.title)]);
    expect(sections("Assessments")).toEqual([["own", ["quiz"]], ["1.1 Joins", ["exam"]]]);
    expect(sections("Materials")).toEqual([["1.1 Joins", ["Join notes"]]]);
    expect(sections("Assignments")).toEqual([["own", ["essay"]]]);
  });

  it("lists every submodule in order with its items in column order, empty ones included (D-073)", () => {
    expect(courseTopic(catalog, "c", "1")?.submodules.map((sub) => [sub.module.title, sub.entries.map((entry) => `${entry.category}:${entry.title}`)])).toEqual([
      ["1.1 Joins", ["Assessments:exam", "Activities:lab", "Materials:Join notes"]],
      ["1.2 Views", []],
    ]);
    expect(courseTopic(catalog, "c", "3")?.submodules).toEqual([]);
  });

  it("is undefined for a submodule, another class's module, or an unknown id", () => {
    expect(courseTopic(catalog, "c", "2")).toBeUndefined();
    expect(courseTopic(catalog, "c", "9")).toBeUndefined();
    expect(courseTopic(catalog, "c", "nope")).toBeUndefined();
  });
});
