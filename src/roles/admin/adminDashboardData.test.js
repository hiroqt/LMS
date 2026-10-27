import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminDashboard, buildReport, serializeCsv } from "./adminDashboardData.js";

const now = new Date("2026-10-27T12:00:00.000Z");

function dataFixture() {
  return {
    users: [
      { id: "s1", firstName: "Ari", lastName: "Reyes", email: "ari@example.test", role: "student", status: "active" },
      { id: "s2", firstName: "Bea", lastName: "Lee", email: "bea@example.test", role: "student", status: "inactive" },
      { id: "i1", firstName: "Cam", lastName: "Santos", email: "cam@example.test", role: "instructor", status: "active" },
    ],
    subjects: [{ id: "sub1", code: "IT101", title: "Programming" }],
    classrooms: [
      { id: "c1", subjectId: "sub1", instructorId: "i1", section: "Year 1 A", term: "Fall 2026", status: "active" },
      { id: "c2", subjectId: "sub1", instructorId: "i1", section: "Year 1 B", term: "Spring 2026", status: "inactive" },
    ],
    enrollments: [{ id: "e1", classroomId: "c1", studentId: "s1", status: "active" }],
    modules: [{ id: "m1", classroomId: "c1" }],
    activities: [{ id: "a1", moduleId: "m1", title: "Lab", dueAt: "2026-10-26T00:00:00.000Z", status: "active", createdAt: "2026-10-20T00:00:00.000Z" }],
    exams: [{ id: "x1", classroomId: "c1", title: "Quiz", dueAt: "2026-10-25T00:00:00.000Z", status: "active" }],
    activitySubmissions: [{ id: "as1", activityId: "a1", classroomId: "c1", studentId: "s1", status: "submitted", submittedAt: "2026-10-26T12:00:00.000Z" }],
    examSubmissions: [{ id: "xs1", examId: "x1", classroomId: "c1", studentId: "s1", status: "graded", submittedAt: "2026-10-25T12:00:00.000Z", gradedAt: "2026-10-26T12:00:00.000Z", totalScore: 8 }],
  };
}

test("dashboard uses all-user totals and active classroom sections", () => {
  const model = buildAdminDashboard(dataFixture(), { term: "Fall 2026", range: "term", now });

  assert.deepEqual(model.metrics, {
    totalStudents: 2,
    totalFaculty: 1,
    activeCourses: 1,
    activeUsers: 2,
    totalSubjects: 1,
  });
});

test("dashboard completion counts unique submitted opportunities in the selected term", () => {
  const model = buildAdminDashboard(dataFixture(), { term: "Fall 2026", range: "term", now });

  assert.equal(model.analytics.opportunities, 2);
  assert.equal(model.analytics.completed, 2);
  assert.equal(model.analytics.completionRate, 100);
  assert.equal(model.events.students.length, 3);
});

test("dashboard exposes shared weekly counts for course, student, and system charts", () => {
  const model = buildAdminDashboard(dataFixture(), { term: "Fall 2026", range: "term", now });

  for (const series of Object.values(model.weeklyActivity)) assert.equal(series.length, 8);
  assert.equal(model.weeklyActivity.course.reduce((sum, week) => sum + week.count, 0), model.events.course.length);
  assert.equal(model.weeklyActivity.students.reduce((sum, week) => sum + week.count, 0), model.events.students.length);
  assert.equal(model.weeklyActivity.system.reduce((sum, week) => sum + week.count, 0), model.events.system.length);
  assert.equal(model.events.course.some((event) => event.type === "grade"), true);
});

test("dashboard retains legacy student quiz completions without inventing activity timestamps", () => {
  const data = dataFixture();
  data.users.push({ id: "s0", firstName: "Alex", lastName: "Rivera", role: "student", status: "active" });
  data.enrollments.push({ id: "e0", classroomId: "c1", studentId: "s0", status: "active" });
  data.examSubmissions = [];
  data.activitySubmissions = [];
  const model = buildAdminDashboard(data, { term: "Fall 2026", range: "term", now, legacyCompleted: ["x1"] });

  assert.equal(model.analytics.completed, 1);
  assert.equal(model.events.students.length, 0);
  assert.equal(buildAdminDashboard(data, { term: "Fall 2026", range: "30d", now, legacyCompleted: ["x1"] }).analytics.completed, 0);
});

test("dashboard filters activity by time range and term", () => {
  const data = dataFixture();
  data.classrooms.push({ id: "c3", subjectId: "sub1", instructorId: "i1", section: "Year 1 C", term: "Spring 2026", status: "active" });
  data.enrollments.push({ id: "e3", classroomId: "c3", studentId: "s1", status: "active" });
  data.modules.push({ id: "m3", classroomId: "c3" });
  data.activities.push({ id: "a3", moduleId: "m3", title: "Spring lab", dueAt: "2026-10-26T00:00:00.000Z", status: "active", createdAt: "2026-10-26T00:00:00.000Z" });
  data.activitySubmissions.push({ id: "as3", activityId: "a3", classroomId: "c3", studentId: "s1", status: "submitted", submittedAt: "2026-10-26T12:00:00.000Z" });
  data.activitySubmissions.push({ id: "old", activityId: "a1", classroomId: "c1", studentId: "s1", status: "submitted", submittedAt: "2026-09-01T12:00:00.000Z" });

  const recent = buildAdminDashboard(data, { term: "Fall 2026", range: "7d", now });
  const otherTerm = buildAdminDashboard(data, { term: "Spring 2026", range: "all", now });

  assert.equal(recent.events.students.length, 3);
  assert.equal(recent.events.course.some((event) => event.detail.includes("Spring lab")), false);
  assert.equal(otherTerm.events.course.some((event) => event.detail.includes("Spring lab")), true);
  assert.equal(otherTerm.analytics.opportunities, 1);
});

test("CSV reports include roster rows and protect spreadsheet formulas", () => {
  const report = buildReport(dataFixture(), "roster");
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0][1], "Fall 2026");
  assert.equal(report.rows[1][7], "No enrollments");
  assert.equal(buildReport(dataFixture(), "courses").rows[0][1], "IT101");
  assert.equal(serializeCsv([["Name", "Email"], ["=SUM(1,1)", "ari@example.test"], ["  +2", "quoted \"name\""]]), '"Name","Email"\r\n"\'=SUM(1,1)","ari@example.test"\r\n"\'  +2","quoted ""name"""');
});
