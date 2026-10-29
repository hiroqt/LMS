import { paginateRecords } from "../admin/pagination.js";

const list = (items) => Array.isArray(items) ? items : [];
const roles = ["student", "instructor", "admin"];
const modules = ["overview", "systemConfiguration", "academicTerms", "users", "courses", "learningResources", "reports", "auditLogs"];
const actions = ["view", "create", "edit", "deactivate", "export"];

function slug(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function defaultRolePermissions() {
  return Object.fromEntries(roles.map((role) => [role, Object.fromEntries(modules.map((module) => [module, Object.fromEntries(actions.map((action) => [action, role === "admin" || (role === "instructor" && ["courses", "learningResources"].includes(module) && ["view", "create", "edit"].includes(action)) || (role === "student" && ["courses", "learningResources"].includes(module) && action === "view") || (role !== "admin" && module === "overview" && action === "view")]))]))]));
}

function makeHistoricalEvent({ id, actorId, actorName, actorRole, category, action, target, targetId, summary, timestamp }) {
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) return null;
  return {
    id: `history-${id || targetId}-${action}-${timestamp}`,
    actorId: actorId || "",
    actorName: actorName || "Not recorded",
    actorRole: actorRole || "unknown",
    category,
    action,
    target,
    targetId: String(targetId || ""),
    summary,
    timestamp,
  };
}

function historicalAuditLogs(data) {
  const users = list(data.users);
  const name = (userId) => {
    const user = users.find((item) => item.id === userId);
    return user ? `${user.firstName} ${user.lastName}`.trim() : "Not recorded";
  };
  const events = [];
  const add = (record, category, action, target, targetId, summary, timestamp, actorId, actorRole) => {
    const actorName = actorId ? name(actorId) : "Not recorded";
    const event = makeHistoricalEvent({ id: record.id || targetId, actorId, actorName, actorRole, category, action, target, targetId, summary, timestamp });
    if (event) events.push(event);
  };
  for (const user of users) {
    add(user, "users", "created", "User", user.id, `${user.firstName} ${user.lastName} · ${user.role}`, user.createdAt);
    add(user, "users", user.status === "inactive" ? "deactivated" : "activated", "User", user.id, `${user.firstName} ${user.lastName}`, user.statusChangedAt);
  }
  for (const subject of list(data.subjects)) add(subject, "courses", "created", "Subject", subject.id, `${subject.code} · ${subject.title}`, subject.createdAt);
  for (const room of list(data.classrooms)) {
    add(room, "courses", "created", "Classroom", room.id, room.section, room.createdAt);
    add(room, "courses", room.status === "inactive" ? "deactivated" : "activated", "Classroom", room.id, room.section, room.statusChangedAt);
  }
  for (const enrollment of list(data.enrollments)) {
    const student = name(enrollment.studentId);
    add(enrollment, "courses", "enrolled", "Enrollment", enrollment.id, student, enrollment.createdAt);
    add(enrollment, "courses", enrollment.status === "inactive" ? "deactivated" : "activated", "Enrollment", enrollment.id, student, enrollment.statusChangedAt);
  }
  for (const material of list(data.materials)) add(material, "courses", "published", "Material", material.id, material.title, material.createdAt);
  for (const activity of list(data.activities)) add(activity, "courses", "published", "Coursework", activity.id, activity.title, activity.createdAt);
  for (const exam of list(data.exams)) add(exam, "courses", "published", "Assessment", exam.id, exam.title, exam.createdAt);
  for (const announcement of list(data.announcements)) add(announcement, "courses", "published", "Announcement", announcement.id, announcement.title, announcement.createdAt, announcement.instructorId, "instructor");
  for (const submission of list(data.activitySubmissions)) {
    add(submission, "activity", "submitted", "Assignment", submission.activityId, "Assignment submission", submission.submittedAt, submission.studentId, "student");
    add(submission, "activity", "graded", "Assignment", submission.activityId, "Assignment graded", submission.gradedAt, submission.gradedBy, "instructor");
  }
  for (const submission of list(data.examSubmissions)) {
    add(submission, "activity", "submitted", "Assessment", submission.examId, "Assessment submission", submission.submittedAt, submission.studentId, "student");
    add(submission, "activity", "graded", "Assessment", submission.examId, "Assessment graded", submission.gradedAt, submission.gradedBy, "instructor");
  }
  return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function initializeSystemAdministration(data, { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } = {}) {
  const existing = data.systemAdministration || {};
  if (existing.version === 1) return data;

  const existingTerms = list(existing.terms);
  const terms = existingTerms.length ? existingTerms : [...new Set(list(data.classrooms).map((room) => room.term).filter(Boolean))].map((name) => ({
    id: `term-${slug(name)}`,
    name,
    startDate: "",
    endDate: "",
    status: "archived",
  }));
  const classroomTerm = list(data.classrooms).find((room) => room.status === "active")?.term || list(data.classrooms)[0]?.term;
  const wantedTermId = existing.settings?.currentTermId || terms.find((term) => term.status === "current")?.id || (classroomTerm ? `term-${slug(classroomTerm)}` : terms[0]?.id);
  const currentTerm = terms.find((term) => term.id === wantedTermId) || terms[0];
  const normalizedTerms = currentTerm ? terms.map((term) => ({
    ...term,
    startDate: term.startDate || "",
    endDate: term.endDate || "",
    status: term.id === currentTerm.id ? "current" : (term.status === "current" ? "archived" : term.status || "archived"),
  })) : [];
  const settings = {
    institutionName: existing.settings?.institutionName || "TMCC",
    timeZone: existing.settings?.timeZone || timeZone,
    currentTermId: currentTerm?.id || "",
    notifications: {
      setupIssues: existing.settings?.notifications?.setupIssues ?? true,
      userChanges: existing.settings?.notifications?.userChanges ?? true,
      courseworkActivity: existing.settings?.notifications?.courseworkActivity ?? true,
    },
  };
  const auditLogs = existing.version === 1 ? list(existing.auditLogs) : [
    ...list(existing.auditLogs),
    ...historicalAuditLogs(data),
  ];
  return {
    ...data,
    systemAdministration: {
      ...existing,
      version: 1,
      settings,
      terms: normalizedTerms,
      rolePermissions: existing.rolePermissions || defaultRolePermissions(),
      auditLogs,
    },
  };
}

export function appendAuditEvent(data, event, now = new Date()) {
  const initialized = initializeSystemAdministration(data);
  const safeEvent = {
    id: `audit-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    actorId: event.actorId || "",
    actorName: event.actorName || "Not recorded",
    actorRole: event.actorRole || "unknown",
    category: event.category || "system",
    action: event.action || "updated",
    target: event.target || "System",
    targetId: String(event.targetId || ""),
    summary: String(event.summary || "").slice(0, 160),
    timestamp: now.toISOString(),
  };
  return {
    ...initialized,
    systemAdministration: {
      ...initialized.systemAdministration,
      auditLogs: [safeEvent, ...initialized.systemAdministration.auditLogs],
    },
  };
}

export function setCurrentAcademicTerm(data, termId) {
  const initialized = initializeSystemAdministration(data);
  if (!initialized.systemAdministration.terms.some((term) => term.id === termId)) return initialized;
  const terms = initialized.systemAdministration.terms.map((term) => ({
    ...term,
    status: term.id === termId ? "current" : term.status === "current" ? "planned" : term.status,
  }));
  return {
    ...initialized,
    systemAdministration: {
      ...initialized.systemAdministration,
      settings: { ...initialized.systemAdministration.settings, currentTermId: termId },
      terms,
    },
  };
}

export function getAuditLogPage(data, filters = {}, page = 1, pageSize = 8) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity;
  const through = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Infinity;
  const rows = list(data.systemAdministration?.auditLogs).filter((event) => {
    const timestamp = new Date(event.timestamp).getTime();
    return (!filters.category || filters.category === "all" || event.category === filters.category)
      && (!filters.role || filters.role === "all" || event.actorRole === filters.role)
      && timestamp >= from && timestamp <= through;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { ...paginateRecords(rows, page, pageSize), total: rows.length };
}

export function createBackupSnapshot(data, createdAt = new Date()) {
  return { version: 1, createdAt: createdAt.toISOString(), data: JSON.parse(JSON.stringify(data)) };
}

export function buildSystemAdministrationReport(data, type) {
  const system = data.systemAdministration || {};
  if (type === "terms") return {
    filename: "academic-terms.csv",
    headers: ["ID", "Term", "Start date", "End date", "Status"],
    rows: list(system.terms).map((term) => [term.id, term.name, term.startDate, term.endDate, term.status]),
  };
  if (type === "roles") return {
    filename: "role-permissions.csv",
    headers: ["Role", "Module", ...actions],
    rows: roles.flatMap((role) => modules.map((module) => [role, module, ...actions.map((action) => Boolean(system.rolePermissions?.[role]?.[module]?.[action]))])),
  };
  if (type === "audit") return {
    filename: "audit-logs.csv",
    headers: ["Timestamp", "Actor", "Role", "Category", "Action", "Target", "Target ID", "Summary"],
    rows: list(system.auditLogs).map((event) => [event.timestamp, event.actorName, event.actorRole, event.category, event.action, event.target, event.targetId, event.summary]),
  };
  return null;
}
