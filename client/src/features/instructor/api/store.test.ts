import { describe, expect, it } from "vitest";
import { overviewFixture } from "../../../shared/api/overviewFixture";
import { classContent, classroomsOf, gradebookAverages, reviewQueue, studentsWithoutWork } from "./selectors";
import { toRoleStore } from "./store";

const people = { instructors: [{ id: "EMP-1", name: "Ana Reyes" }, { id: "EMP-2", name: "Ben Cruz" }], students: [] };
const store = () => toRoleStore(overviewFixture((o) => (o.me = { id: "EMP-1", firstName: "Ana", lastName: "Reyes", role: "instructor" })), people);

describe("toRoleStore", () => {
  it("builds the classroom, its subject and its class list from ISMS data", () => {
    const s = store();
    const [room] = classroomsOf(s, "EMP-1");
    expect(room).toMatchObject({ id: "class-a", ismsSubjectId: 7, section: "BSIT 2-A", yearLevel: 2, term: "2026-2027 · 1st Semester", schedule: "MW 08:00–09:30", source: "isms" });
    expect(s.subjects[0]).toMatchObject({ code: "IT202", title: "Database Systems 1" });
    expect(classContent(s, "class-a").students.map((user) => user.id)).toEqual(["STU-1", "STU-2"]);
    expect(s.users.filter((user) => user.role === "instructor").map((user) => user.lastName)).toEqual(["Reyes", "Cruz"]);
  });

  it("hides archived coursework but keeps archived materials for the Materials tab", () => {
    const content = classContent(store(), "class-a");
    expect(content.activities.map((item) => item.id)).toEqual(["1"]);
    expect(content.exams.map((item) => item.id)).toEqual(["2"]);
    expect(content.materials[0]).toMatchObject({ id: "5", moduleId: "1", status: "archived" });
  });

  it("keeps a submodule's parent so the Modules tab can nest it", () => {
    const s = toRoleStore(overviewFixture((o) => o.modules.push({ id: 2, classId: "class-a", parentModuleId: 1, title: "1.1 Tables", sortOrder: 1 })), people);
    expect(s.modules).toEqual([
      { id: "1", classroomId: "class-a", title: "Unit 1", order: 1 },
      { id: "2", classroomId: "class-a", parentId: "1", title: "1.1 Tables", order: 1 },
    ]);
  });

  it("splits submissions by kind and carries grades and weights", () => {
    const s = store();
    expect(s.activitySubmissions.map((item) => [item.id, item.grade])).toEqual([["11", 4], ["12", 9]]);
    expect(s.examSubmissions.map((item) => [item.id, item.status])).toEqual([["21", "graded"], ["22", "in_progress"]]);
    expect(s.gradebookSettings["class-a"]).toEqual({ activityWeight: 30, examWeight: 70, passingScore: 75 });
    expect(gradebookAverages(s, "class-a").activities).toEqual({ graded: 2, average: 65 });
  });

  it("carries attendance by month with days present by student", () => {
    expect(store().attendance).toEqual([
      { classroomId: "class-a", year: 2026, month: 10, schoolDays: 20, daysPresent: { "STU-1": 18, "STU-2": 15 } },
      { classroomId: "class-a", year: 2026, month: 9, schoolDays: 22, daysPresent: { "STU-2": 22 } },
    ]);
  });

  it("queues only handed-in, ungraded work", () => {
    const s = store();
    s.activitySubmissions.push({ id: "13", activityId: "1", classroomId: "class-a", studentId: "STU-2", status: "submitted", grade: null });
    expect(reviewQueue(s, classroomsOf(s, "EMP-1")).map((item) => item.id)).toEqual(["13"]);
  });

  it("leaves out work of a student who was excused after handing in (D-062)", () => {
    const s = toRoleStore(overviewFixture((o) => {
      o.submissions = o.submissions.filter((item) => item.courseworkId !== 1);
      const row = overviewFixture().submissions[0]!;
      o.submissions.push(
        { ...row, submission: { ...row.submission, id: 31, studentId: "STU-1", status: "submitted", score: null, excused: true } },
        { ...row, submission: { ...row.submission, id: 32, studentId: "STU-2", status: "submitted", score: null } },
      );
    }), people);
    expect(s.activitySubmissions.map((item) => [item.id, item.excused])).toEqual([["31", true], ["32", false]]);
    expect(reviewQueue(s, classroomsOf(s, "EMP-1")).map((item) => item.id)).toEqual(["32"]);
    // Her graded work would not count either.
    s.activitySubmissions[0]!.grade = 5;
    s.activitySubmissions[1]!.grade = 10;
    expect(gradebookAverages(s, "class-a").activities).toEqual({ graded: 1, average: 100 });
  });

  it("does not list an excused student as having handed in nothing", () => {
    const s = toRoleStore(overviewFixture((o) => {
      o.submissions = [];
      o.exceptions = [
        { courseworkId: 1, classId: "class-a", studentId: "STU-1", dueAt: null, closeAt: null, excused: true },
        { courseworkId: 1, classId: "class-a", studentId: "STU-2", dueAt: "2026-11-05T15:59:00Z", closeAt: null, excused: false },
      ];
    }), people);
    expect(s.activityExceptions).toEqual([
      { activityId: "1", classroomId: "class-a", studentId: "STU-1", excused: true },
      { activityId: "1", classroomId: "class-a", studentId: "STU-2", dueAt: "2026-11-05T15:59:00Z", excused: false },
    ]);
    const students = classContent(s, "class-a").students;
    // Lia is excused; Max only has more time, so he is still missing.
    expect(studentsWithoutWork(s, { id: "1", kind: "Assignment" }, students).map((user) => user.id)).toEqual(["STU-2"]);
    // An excuse for an assignment says nothing about an exam.
    expect(studentsWithoutWork(s, { id: "2", kind: "Assessment" }, students).map((user) => user.id)).toEqual(["STU-1", "STU-2"]);
  });
});
