import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAuditEvent,
  buildSystemAdministrationReport,
  createBackupSnapshot,
  getAuditLogPage,
  initializeSystemAdministration,
  setCurrentAcademicTerm,
} from "../shared/systemAdministrationData.js";

test("system administration migrates existing classroom terms without changing assignments", () => {
  const data = {
    users: [{ id: "student-1", firstName: "Alex", lastName: "Rivera", role: "student" }],
    classrooms: [
      { id: "current-class", term: "Fall 2026", status: "active" },
      { id: "past-class", term: "Spring 2026", status: "inactive" },
    ],
    activitySubmissions: [{ id: "submission-1", studentId: "student-1", submittedAt: "2026-10-20T12:00:00.000Z" }],
  };

  const migrated = initializeSystemAdministration(data, { timeZone: "Asia/Manila" });
  const system = migrated.systemAdministration;

  assert.equal(system.settings.institutionName, "TMCC");
  assert.equal(system.settings.timeZone, "Asia/Manila");
  assert.equal(system.terms.filter((term) => term.status === "current").length, 1);
  assert.equal(system.terms.find((term) => term.status === "current").name, "Fall 2026");
  assert.deepEqual(system.terms.map((term) => [term.name, term.startDate, term.endDate]), [
    ["Fall 2026", "", ""],
    ["Spring 2026", "", ""],
  ]);
  assert.equal(system.auditLogs[0].actorName, "Alex Rivera");
  assert.equal(system.auditLogs[0].timestamp, "2026-10-20T12:00:00.000Z");
  assert.deepEqual(migrated.classrooms.map((room) => room.term), ["Fall 2026", "Spring 2026"]);
  assert.deepEqual(data.classrooms.map((room) => room.term), ["Fall 2026", "Spring 2026"]);
});

test("changing the current academic term only changes the new-class default", () => {
  const data = initializeSystemAdministration({ classrooms: [{ id: "old", term: "Fall 2026", status: "active" }] }, { timeZone: "UTC" });
  const nextTerm = { id: "term-spring-2027", name: "Spring 2027", startDate: "2027-01-10", endDate: "2027-05-20", status: "planned" };
  const changed = setCurrentAcademicTerm({ ...data, systemAdministration: { ...data.systemAdministration, terms: [...data.systemAdministration.terms, nextTerm] } }, nextTerm.id);

  assert.equal(changed.systemAdministration.settings.currentTermId, nextTerm.id);
  assert.deepEqual(changed.systemAdministration.terms.map((term) => term.status), ["planned", "current"]);
  assert.equal(changed.classrooms[0].term, "Fall 2026");
});

test("audit entries contain only metadata and filters paginate newest matches", () => {
  const initial = initializeSystemAdministration({ users: [], classrooms: [] }, { timeZone: "UTC" });
  const first = appendAuditEvent(initial, { actorName: "Taylor Morgan", actorRole: "admin", category: "users", action: "created", target: "User", summary: "Jordan Rivera", answers: ["private"] }, new Date("2026-10-20T10:00:00.000Z"));
  const second = appendAuditEvent(first, { actorName: "Alex Rivera", actorRole: "student", category: "activity", action: "submitted", target: "Assignment" }, new Date("2026-10-21T10:00:00.000Z"));
  const third = appendAuditEvent(second, { actorName: "Sam Lee", actorRole: "instructor", category: "courses", action: "published", target: "Coursework" }, new Date("2026-10-22T10:00:00.000Z"));
  const page = getAuditLogPage(third, { role: "student", from: "2026-10-21" }, 1, 8);

  assert.equal(page.total, 1);
  assert.equal(page.records[0].actorName, "Alex Rivera");
  assert.equal(page.pageCount, 1);
  assert.equal(Object.hasOwn(first.systemAdministration.auditLogs[0], "answers"), false);
  assert.equal(getAuditLogPage(third, {}, 1, 8).records[0].actorName, "Sam Lee");
});

test("backup snapshot preserves complete local data without mutating its source", () => {
  const data = initializeSystemAdministration({ users: [{ id: "u1" }], classrooms: [] }, { timeZone: "UTC" });
  const backup = createBackupSnapshot(data, new Date("2026-10-22T10:00:00.000Z"));

  assert.equal(backup.version, 1);
  assert.equal(backup.createdAt, "2026-10-22T10:00:00.000Z");
  assert.deepEqual(JSON.parse(JSON.stringify(backup)).data, data);
  assert.equal(Object.hasOwn(data, "createdAt"), false);
});

test("system administration reports export terms, permission rows, and audit metadata", () => {
  const data = initializeSystemAdministration({ users: [], classrooms: [{ id: "c1", term: "Fall 2026", status: "active" }] }, { timeZone: "UTC" });
  const termReport = buildSystemAdministrationReport(data, "terms");
  const roleReport = buildSystemAdministrationReport(data, "roles");
  const auditReport = buildSystemAdministrationReport(appendAuditEvent(data, { actorName: "Taylor Morgan", actorRole: "admin", category: "settings", action: "updated", summary: "Timezone changed" }), "audit");

  assert.equal(termReport.rows[0][1], "Fall 2026");
  assert.ok(roleReport.rows.some((row) => row[0] === "admin" && row[2] === true));
  assert.deepEqual(auditReport.rows[0].slice(1, 6), ["Taylor Morgan", "admin", "settings", "updated", "System"]);
});
