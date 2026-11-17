import { describe, expect, it } from "vitest";
import { overviewFixture } from "../../../shared/api/overviewFixture";
import { toStudentCatalog } from "./catalog";

describe("toStudentCatalog", () => {
  it("turns an ISMS class into a course, using its meetings when there are no demo extras", () => {
    const [course] = toStudentCatalog(overviewFixture()).courses;
    expect(course).toMatchObject({ id: "class-a", code: "IT202", name: "Database Systems 1", section: "BSIT 2-A", teacher: "Ana Reyes", count: 2, room: "Room 203", next: "MW 08:00–09:30" });
  });

  it("keeps modules, submodules, and where each material and assessment is placed", () => {
    const catalog = toStudentCatalog(overviewFixture((o) => {
      o.modules.push({ id: 2, classId: "class-a", parentModuleId: 1, title: "1.1 Tables", sortOrder: 1 });
      o.materials[0]!.moduleId = 2;
    }));
    expect(catalog.modules).toEqual([
      { id: "1", courseId: "class-a", title: "Unit 1", order: 1 },
      { id: "2", courseId: "class-a", parentId: "1", title: "1.1 Tables", order: 1 },
    ]);
    expect(catalog.materials[0]?.moduleId).toBe("2");
    expect(catalog.assessments.map((item) => item.moduleId)).toEqual(["1", "1", "1"]);
  });

  it("counts handed-in work as completed, never an open attempt", () => {
    const catalog = toStudentCatalog(overviewFixture());
    expect(catalog.completed).toEqual(["1", "2"]);
    expect(catalog.attempts["2"]).toEqual({ openId: 22, latestId: 21, used: 2 });
  });

  it("shows the latest assignment submission and the best graded exam attempt", () => {
    const catalog = toStudentCatalog(overviewFixture((o) => o.submissions.push({ ...o.submissions[2]!, submission: { ...o.submissions[2]!.submission, id: 23, attemptNumber: 3, score: 12 } })));
    expect(catalog.activitySubmissions["1"]).toMatchObject({ id: "12", grade: 9, feedback: "Much better" });
    expect(catalog.examGrades["2"]).toEqual({ examId: "2", totalScore: 16, feedback: undefined });
  });

  it("maps coursework to assessments, keeping a missing due date empty", () => {
    const catalog = toStudentCatalog(overviewFixture());
    expect(catalog.assessments.find((item) => item.id === "2")).toMatchObject({ type: "Quiz", points: 20, questionCount: 5, timeLimit: "5 minutes", maxAttempts: 2, kind: undefined });
    expect(catalog.assessments.find((item) => item.id === "1")).toMatchObject({ type: "Assignment", kind: "activity", description: "Do it." });
    expect(catalog.assessments.find((item) => item.id === "3")?.dueAt).toBe("");
  });

  it("keeps only the student's own days per month, and null when their days were not recorded", () => {
    const catalog = toStudentCatalog(overviewFixture());
    expect(catalog.attendance).toEqual([
      { courseId: "class-a", year: 2026, month: 10, schoolDays: 20, daysPresent: 18 },
      { courseId: "class-a", year: 2026, month: 9, schoolDays: 22, daysPresent: null },
    ]);
  });

  it("names the student, marks them in the class list, and credits announcements", () => {
    const catalog = toStudentCatalog(overviewFixture());
    expect(catalog.me).toEqual({ id: "STU-1", firstName: "Lia", name: "Lia Abad" });
    expect(catalog.classmates.map((item) => [item.name, item.role])).toEqual([["Lia Abad", "You"], ["Max Bautista", "Student"]]);
    expect(catalog.announcements[0]).toMatchObject({ id: "9", author: "Ana Reyes", classroomId: "class-a" });
  });
});
