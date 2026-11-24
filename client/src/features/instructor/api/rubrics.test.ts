import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/http";
import type { Rubric } from "../../../shared/api/rubrics";
import {
  LIMITS,
  addCriterion,
  addLevel,
  changeCriterion,
  changeLevel,
  clearErrors,
  emptyRubricForm,
  formFromRubric,
  formTotal,
  mapRubricErrors,
  moveCriterion,
  refusal,
  removeCriterion,
  removeLevel,
  rubricBody,
  rubricErrorPaths,
  rubricFacts,
  validateRubric,
  type RubricForm,
} from "./rubrics";

const saved: Rubric = {
  id: 3, title: "Lab report", totalPoints: 15, locked: false, usedBy: 1,
  criteria: [
    { id: 7, title: "Analysis", description: "How well the data is explained.", levels: [{ id: 21, title: "Complete", description: null, points: 10 }, { id: 22, title: "Partial", description: null, points: 5 }, { id: 23, title: "Missing", description: null, points: 0 }] },
    { id: 8, title: "Presentation", description: null, levels: [{ id: 24, title: "Clear", description: null, points: 5 }, { id: 25, title: "Unclear", description: null, points: 2 }] },
  ],
};

const valid = (): RubricForm => formFromRubric(saved);

describe("the form", () => {
  it("starts with one criterion of three levels, worth 10", () => {
    const form = emptyRubricForm();
    expect(form.criteria).toHaveLength(1);
    expect(form.criteria[0]!.levels.map((item) => item.points)).toEqual(["10", "5", "0"]);
    expect(formTotal(form)).toBe(10);
  });

  it("reads a saved rubric, and its total is each criterion's highest level", () => {
    const form = valid();
    expect(form.title).toBe("Lab report");
    expect(form.criteria[1]).toMatchObject({ title: "Presentation", description: "" });
    expect(formTotal(form)).toBe(15);
    expect(formTotal(changeLevel(form, 1, 1, { points: "8" }))).toBe(18);
    // A level not yet a number counts as 0.
    expect(formTotal(changeLevel(form, 0, 0, { points: "" }))).toBe(10);
  });

  it("adds, removes and moves criteria within 1 to 12", () => {
    let form = valid();
    form = moveCriterion(form, 1, -1);
    expect(form.criteria.map((item) => item.title)).toEqual(["Presentation", "Analysis"]);
    expect(moveCriterion(form, 0, -1)).toBe(form);
    expect(moveCriterion(form, 1, 1)).toBe(form);
    form = removeCriterion(form, 0);
    expect(form.criteria.map((item) => item.title)).toEqual(["Analysis"]);
    expect(removeCriterion(form, 0)).toBe(form);
    for (let i = 0; i < 20; i++) form = addCriterion(form);
    expect(form.criteria).toHaveLength(LIMITS.maxCriteria);
  });

  it("adds and removes levels within 2 to 6", () => {
    let form = valid();
    expect(removeLevel(form, 1, 0)).toBe(form);
    form = removeLevel(form, 0, 1);
    expect(form.criteria[0]!.levels.map((item) => item.title)).toEqual(["Complete", "Missing"]);
    for (let i = 0; i < 10; i++) form = addLevel(form, 0);
    expect(form.criteria[0]!.levels).toHaveLength(LIMITS.maxLevels);
  });

  it("states the facts of a rubric", () => {
    expect(rubricFacts(saved)).toBe("15 points · 2 criteria · used by 1 assignment");
    expect(rubricFacts({ totalPoints: 1, criteria: [saved.criteria[0]!], usedBy: 0 })).toBe("1 point · 1 criterion · not used by any assignment");
  });
});

describe("validateRubric", () => {
  it("accepts a saved rubric", () => {
    expect(validateRubric(valid())).toEqual({});
  });

  it("names every problem by the server's path, in page order", () => {
    let form = changeCriterion(valid(), 1, { title: " " });
    form = changeLevel(form, 0, 2, { points: "-1" });
    form = changeLevel(form, 1, 0, { title: "", points: "1001" });
    form = { ...form, title: "" };
    const errors = validateRubric(form);
    expect(rubricErrorPaths(form, errors)).toEqual(["title", "criteria[0].levels[2].points", "criteria[1].title", "criteria[1].levels[0].title", "criteria[1].levels[0].points"]);
    expect(errors["criteria[0].levels[2].points"]).toBe("Give 0 to 1,000 points.");
  });

  it("limits lengths", () => {
    const form = changeLevel(changeCriterion(valid(), 0, { description: "x".repeat(501) }), 0, 0, { title: "y".repeat(61) });
    expect(validateRubric(form)).toEqual({ "criteria[0].description": "Use at most 500 characters.", "criteria[0].levels[0].title": "Use at most 60 characters." });
  });

  it("needs a total above 0 and at most 1,000", () => {
    const zero = changeLevel(changeLevel(changeLevel(valid(), 0, 0, { points: "0" }), 0, 1, { points: "0" }), 1, 0, { points: "0" });
    const none = changeLevel(zero, 1, 1, { points: "0" });
    expect(validateRubric(none).criteria).toMatch(/more than 0 points/);
    const big = changeLevel(changeLevel(valid(), 0, 0, { points: "900" }), 1, 0, { points: "200" });
    expect(validateRubric(big).criteria).toBe("A rubric can be worth at most 1,000 points; this one adds up to 1100.");
  });

  it("checks only the title of a locked rubric", () => {
    expect(validateRubric({ title: "", criteria: [] }, { locked: true })).toEqual({ title: "Enter a title." });
  });
});

describe("the server's errors", () => {
  it("land on the matching input; unknown paths are general", () => {
    const form = valid();
    expect(mapRubricErrors(form, { "criteria[1].levels[0].points": ["Give 0 to 1000 points."], "criteria[5].title": ["x"], status: ["y"] })).toEqual({ "criteria[1].levels[0].points": "Give 0 to 1000 points.", general: "x" });
  });

  it("are cleared by the change that fixes them", () => {
    const errors = { title: "a", "criteria[0].title": "b", "criteria[1].levels[0].points": "c", criteria: "d", general: "e" };
    expect(clearErrors(errors, "criteria[0].title")).toEqual({ title: "a", "criteria[1].levels[0].points": "c" });
    expect(clearErrors(errors, "all-criteria")).toEqual({ title: "a" });
    expect(clearErrors({ title: "a" }, "criteria[0].title")).toEqual({ title: "a" });
  });

  it("a refusal is the server's own sentence", () => {
    const conflict = new ApiError({ kind: "http", status: 409, url: "/x", title: "An assignment uses this rubric. Take it off the assignment first." });
    expect(refusal(conflict)).toEqual({ ok: false, message: "An assignment uses this rubric. Take it off the assignment first." });
    const invalid = new ApiError({ kind: "http", status: 400, url: "/x", fieldErrors: { title: ["Enter a title."] } });
    expect(refusal(invalid)).toEqual({ ok: false, message: "Check the highlighted fields.", fieldErrors: { title: ["Enter a title."] } });
  });
});

describe("rubricBody", () => {
  it("sends trimmed text, null for empty descriptions, and numbers", () => {
    const form = changeLevel(changeCriterion(valid(), 0, { title: " Analysis " }), 0, 0, { description: "  " });
    expect(rubricBody(form)).toEqual({
      title: "Lab report",
      criteria: [
        { title: "Analysis", description: "How well the data is explained.", levels: [{ title: "Complete", description: null, points: 10 }, { title: "Partial", description: null, points: 5 }, { title: "Missing", description: null, points: 0 }] },
        { title: "Presentation", description: null, levels: [{ title: "Clear", description: null, points: 5 }, { title: "Unclear", description: null, points: 2 }] },
      ],
    });
  });

  it("sends only the title of a locked rubric", () => {
    expect(rubricBody({ ...valid(), title: " New name " }, { locked: true })).toEqual({ title: "New name" });
  });
});
