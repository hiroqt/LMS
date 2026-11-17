import { describe, expect, it } from "vitest";
import { createInitialData } from "../../../roles/shared/lmsData.js";
import { activeInstructors, classMark, classroomsOf, classWork, contentByModule, gradebookAverages, gradedLabel, notHandedInGrades, reviewQueue, searchInstructor, studentsWithoutWork, subjectOf, yearLevels, yearOf } from "./selectors";
import type { User } from "./types";
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

  it("queues handed-in assignments without a grade and exam attempts waiting for essay scores", () => {
    const store = seed();
    store.activities.push({ id: "7", moduleId: "module-1", title: "Lab report", maxScore: 20 });
    store.activitySubmissions.push(
      { id: "21", activityId: "7", classroomId: "biology", studentId: "s1", status: "submitted", grade: null },
      { id: "22", activityId: "7", classroomId: "biology", studentId: "s2", status: "graded", grade: 18 },
    );
    store.examSubmissions.push(
      { id: "31", examId: "biology-1", classroomId: "biology", studentId: "s1", status: "submitted" },
      { id: "32", examId: "biology-1", classroomId: "biology", studentId: "s2", status: "graded", totalScore: 30 },
      { id: "33", examId: "math-0", classroomId: "math", studentId: "s1", status: "submitted" },
    );
    const rooms = classroomsOf(store, activeInstructors(store)[0]?.id);
    const queue = reviewQueue(store, rooms);
    // Graded work and another instructor's class (math) stay out.
    expect(queue.map((item) => [item.id, item.kind, item.courseworkId])).toEqual([["21", "activity", "7"], ["31", "exam", "biology-1"]]);
    expect(queue[0]?.student?.id).toBe("s1");
    expect(queue[1]?.maxScore).toBe(40);
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

  it("groups a class's content by the module or submodule it sits in", () => {
    const grouped = contentByModule({
      materials: [{ id: "m1", moduleId: "2", title: "Join notes", kind: "Reading", status: "archived" }],
      activities: [{ id: "a1", moduleId: "1", title: "ER diagram", maxScore: 10 }],
      exams: [{ id: "e1", classroomId: "c", moduleId: "2", title: "Joins quiz", totalMarks: 10 }, { id: "e2", classroomId: "c", title: "Unplaced", totalMarks: 5 }],
    });
    expect(grouped.get("1")?.map((item) => item.title)).toEqual(["ER diagram"]);
    expect(grouped.get("2")).toEqual([
      { kind: "material", id: "m1", title: "Join notes", label: "Material · Reading", archived: true },
      { kind: "exam", id: "e1", title: "Joins quiz", label: "Assessment", archived: false },
    ]);
    expect([...grouped.keys()]).toEqual(["2", "1"]);
  });

  it("carries closed and graded progress, and labels it", () => {
    const [item] = classWork({ activities: [{ id: "a", moduleId: "m", title: "Lab", maxScore: 5, closed: true, gradedCount: 12, rosterCount: 30 }], exams: [] });
    expect(item).toMatchObject({ closed: true, gradedCount: 12, rosterCount: 30 });
    expect(gradedLabel(item!)).toBe("12 of 30 graded");
  });

  it("finds students with no work and no not-handed-in grade, per assignment or assessment", () => {
    const people: User[] = ["s0", "s1", "s2"].map((id) => ({ id, firstName: id, lastName: "", role: "student", status: "active" }));
    const store = {
      activitySubmissions: [
        { id: "1", activityId: "7", classroomId: "c", studentId: "s0", status: "submitted", grade: null },
        { id: "2", activityId: "7", classroomId: "c", studentId: "s2", status: "graded", grade: 0, notHandedIn: true },
        { id: "3", activityId: "8", classroomId: "c", studentId: "s1", status: "graded", grade: 4 },
      ],
      examSubmissions: [{ id: "4", examId: "7", classroomId: "c", studentId: "s1", status: "graded", totalScore: 3 }],
    };
    expect(studentsWithoutWork(store, { id: "7", kind: "Assignment" }, people).map((s) => s.id)).toEqual(["s1"]);
    expect(studentsWithoutWork(store, { id: "7", kind: "Assessment" }, people).map((s) => s.id)).toEqual(["s0", "s2"]);
    expect(notHandedInGrades(store, { id: "7", kind: "Assignment" }, people)).toEqual([{ student: people[2], score: 0 }]);
    expect(notHandedInGrades(store, { id: "7", kind: "Assessment" }, people)).toEqual([]);
  });
});
