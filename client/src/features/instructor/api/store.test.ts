import { describe, expect, it } from "vitest";
import { overviewFixture } from "../../../shared/api/overviewFixture";
import { classContent, classroomsOf, gradebookAverages, reviewQueue } from "./selectors";
import { toRoleStore } from "./store";

const people = { instructors: [{ id: "EMP-1", name: "Ana Reyes" }, { id: "EMP-2", name: "Ben Cruz" }], students: [] };
const store = () => toRoleStore(overviewFixture((o) => (o.me = { id: "EMP-1", firstName: "Ana", lastName: "Reyes", role: "instructor" })), people);

describe("toRoleStore", () => {
  it("builds the classroom, its subject and its class list from ISMS data", () => {
    const s = store();
    const [room] = classroomsOf(s, "EMP-1");
    expect(room).toMatchObject({ id: "class-a", section: "BSIT 2-A", yearLevel: 2, term: "2026-2027 · 1st Semester", schedule: "MW 08:00–09:30", source: "isms" });
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

  it("splits submissions by kind and carries grades and weights", () => {
    const s = store();
    expect(s.activitySubmissions.map((item) => [item.id, item.grade])).toEqual([["11", 4], ["12", 9]]);
    expect(s.examSubmissions.map((item) => [item.id, item.status])).toEqual([["21", "graded"], ["22", "in_progress"]]);
    expect(s.gradebookSettings["class-a"]).toEqual({ activityWeight: 30, examWeight: 70, passingScore: 75 });
    expect(gradebookAverages(s, "class-a").activities).toEqual({ graded: 2, average: 65 });
  });

  it("queues only handed-in, ungraded work", () => {
    const s = store();
    s.activitySubmissions.push({ id: "13", activityId: "1", classroomId: "class-a", studentId: "STU-2", status: "submitted", grade: null });
    expect(reviewQueue(s, classroomsOf(s, "EMP-1")).map((item) => item.id)).toEqual(["13"]);
  });
});
