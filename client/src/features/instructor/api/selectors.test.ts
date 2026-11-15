import { describe, expect, it } from "vitest";
import { createInitialData } from "../../../roles/shared/lmsData.js";
import { activeInstructors, classMark, classroomsOf, classWork, gradebookAverages, reviewQueue, searchInstructor, subjectOf, suggestedScore, yearLevels, yearOf } from "./selectors";
import type { RoleStore } from "./types";

const seed = () => createInitialData() as RoleStore;

describe("instructor selectors", () => {
  it("lists active instructors and their active classrooms", () => {
    const store = seed();
    const [first] = activeInstructors(store);
    expect(first?.firstName).toBe("Angela");
    const rooms = classroomsOf(store, first?.id);
    expect(rooms).toHaveLength(1);
    expect(classMark(subjectOf(store, rooms[0]))).toBe("IT101");
  });

  it("reads year levels from the record or the section text", () => {
    expect(yearOf({ id: "a", subjectId: "", instructorId: "", section: "BSIT · Year 3 · Section B", status: "active" })).toBe(3);
    expect(yearOf({ id: "a", subjectId: "", instructorId: "", section: "X", yearLevel: 2, status: "active" })).toBe(2);
    expect(yearLevels([
      { id: "a", subjectId: "", instructorId: "", section: "Year 2", status: "active" },
      { id: "b", subjectId: "", instructorId: "", section: "Year 1", status: "active" },
      { id: "c", subjectId: "", instructorId: "", section: "Year 2", status: "active" },
    ])).toEqual([1, 2]);
  });

  it("sorts classwork by due date with undated work last", () => {
    const work = classWork({
      activities: [{ id: "a", moduleId: "m", title: "Undated", maxScore: 5 }],
      exams: [{ id: "e", classroomId: "c", title: "Dated", totalMarks: 10, dueAt: "2026-10-01T00:00:00Z" }],
    });
    expect(work.map((item) => [item.title, item.kind, item.points])).toEqual([["Dated", "Assessment", 10], ["Undated", "Assignment", 5]]);
  });

  it("queues completed, ungraded exams with the classic auto-score suggestion", () => {
    const store = seed();
    const rooms = classroomsOf(store, activeInstructors(store)[0]?.id);
    const queue = reviewQueue(store, rooms, { completed: ["biology-1", "math-0"], answers: { "biology-1": { 0: 0 } } });
    expect(queue.map((item) => item.id)).toEqual(["biology-1"]); // math-0 belongs to another instructor
    const [item] = queue;
    expect(item?.questions).toHaveLength(10);
    expect(suggestedScore(item!)).toBe(Math.round(((item?.correct ?? 0) / 10) * 40));
  });

  it("leaves graded exams out of the queue", () => {
    const store = seed();
    store.examSubmissions.push({ id: "x", examId: "biology-1", classroomId: "biology", studentId: "s0", status: "graded", totalScore: 30 });
    const rooms = classroomsOf(store, activeInstructors(store)[0]?.id);
    expect(reviewQueue(store, rooms, { completed: ["biology-1"] })).toEqual([]);
  });

  it("averages graded assignments by the activity's maximum (classic showed NaN%)", () => {
    const store = seed();
    store.activities.push({ id: "act", moduleId: "module-1", title: "Lab", maxScore: 20 });
    store.activitySubmissions.push({ id: "s", activityId: "act", classroomId: "biology", studentId: "s0", status: "graded", grade: 15 });
    expect(gradebookAverages(store, "biology").activities).toEqual({ graded: 1, average: 75 });
    expect(gradebookAverages(store, "biology").exams).toEqual({ graded: 0, average: null });
  });

  it("searches classes, materials, and assessments like the classic top bar", () => {
    const store = seed();
    const rooms = classroomsOf(store, activeInstructors(store)[0]?.id);
    expect(searchInstructor(store, rooms, "intro")[0]).toMatchObject({ kind: "Year 1 classroom", title: "Introduction to Programming · BSIT · Year 1 · Section A", target: "class" });
    expect(searchInstructor(store, rooms, "assessment").every((item) => item.target === "assessment")).toBe(true);
    expect(searchInstructor(store, rooms, "")).toEqual([]);
  });
});
