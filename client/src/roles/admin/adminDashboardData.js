import { buildRecentWorkspaceActivity } from "./mockWorkspaceActivity.js";

const list = (value) => Array.isArray(value) ? value : [];
const active = (record) => record?.status === "active";

function makeEvent(type, title, detail, date, classroomId = "") {
  if (!date || Number.isNaN(new Date(date).getTime())) return null;
  return { type, title, detail, date, classroomId };
}

function inRange(event, range, now) {
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  if (!days) return true;
  const date = new Date(event.date).getTime();
  return date >= now.getTime() - days * 86400000 && date <= now.getTime();
}

function sorted(events) {
  return events.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getWeeklyActivity(events, now) {
  return Array.from({ length: 8 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - (7 - index) * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return {
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: events.filter((event) => {
        const date = new Date(event.date);
        return date >= start && date < end;
      }).length,
    };
  });
}

export function buildAdminDashboard(data, { term = "all", range = "term", now = new Date(), legacyCompleted = [] } = {}) {
  const users = list(data.users);
  const classrooms = list(data.classrooms);
  const subjects = list(data.subjects);
  const enrollments = list(data.enrollments);
  const modules = list(data.modules);
  const activities = list(data.activities);
  const exams = list(data.exams);
  const activitySubmissions = list(data.activitySubmissions);
  const examSubmissions = list(data.examSubmissions);
  const announcements = list(data.announcements);
  const roomById = new Map(classrooms.map((room) => [room.id, room]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const roomForModule = new Map(modules.map((module) => [module.id, module.classroomId]));
  const activeRooms = classrooms.filter((room) => active(room) && (term === "all" || room.term === term));
  const activeRoomIds = new Set(activeRooms.map((room) => room.id));
  const terms = [...new Set(classrooms.map((room) => room.term).filter(Boolean))];
  const inTerm = (classroomId) => !classroomId || term === "all" || roomById.get(classroomId)?.term === term;
  const activityEvents = [];
  const studentEvents = [];
  const systemEvents = [];
  const addEvent = (target, type, title, detail, date, classroomId) => {
    const event = makeEvent(type, title, detail, date, classroomId);
    if (!event || !inTerm(classroomId) || !inRange(event, range, now)) return;
    target.push(event);
  };
  const classroomLabel = (classroomId) => {
    const room = roomById.get(classroomId);
    const subject = subjectById.get(room?.subjectId);
    return [subject?.title || "Course", room?.section].filter(Boolean).join(" · ");
  };
  const studentName = (studentId) => {
    const user = userById.get(studentId);
    return user ? `${user.firstName} ${user.lastName}`.trim() : "Student";
  };

  for (const room of classrooms) {
    const course = classroomLabel(room.id);
    addEvent(activityEvents, "coursework", "Classroom created", course, room.createdAt, room.id);
    addEvent(systemEvents, "classroom", "Classroom created", course, room.createdAt, room.id);
    if (room.statusChangedAt) addEvent(activityEvents, "coursework", "Classroom status changed", `${course} · ${room.status}`, room.statusChangedAt, room.id);
    if (room.statusChangedAt) addEvent(systemEvents, "classroom", "Classroom status changed", `${course} · ${room.status}`, room.statusChangedAt, room.id);
  }
  for (const user of users) {
    addEvent(systemEvents, "user", "User added", `${user.firstName} ${user.lastName} · ${user.role}`, user.createdAt);
    if (user.statusChangedAt) addEvent(systemEvents, "user", "User status changed", `${user.firstName} ${user.lastName} · ${user.status}`, user.statusChangedAt);
  }
  for (const subject of subjects) addEvent(systemEvents, "subject", "Subject added", `${subject.code} · ${subject.title}`, subject.createdAt);
  for (const enrollment of enrollments) {
    const course = classroomLabel(enrollment.classroomId);
    const student = studentName(enrollment.studentId);
    addEvent(activityEvents, "enrollment", "Student enrolled", `${student} · ${course}`, enrollment.createdAt, enrollment.classroomId);
    addEvent(studentEvents, "enrollment", "Enrolled in a course", course, enrollment.createdAt, enrollment.classroomId);
    addEvent(systemEvents, "enrollment", "Student enrolled", `${student} · ${course}`, enrollment.createdAt, enrollment.classroomId);
    if (enrollment.statusChangedAt) addEvent(systemEvents, "enrollment", "Enrollment status changed", `${student} · ${enrollment.status}`, enrollment.statusChangedAt, enrollment.classroomId);
  }
  for (const material of list(data.materials)) {
    const classroomId = roomForModule.get(material.moduleId);
    const detail = `${material.title} · ${classroomLabel(classroomId)}`;
    addEvent(activityEvents, "material", "Course material shared", detail, material.createdAt, classroomId);
    addEvent(systemEvents, "material", "Course material shared", detail, material.createdAt, classroomId);
  }
  for (const activity of activities) {
    const classroomId = roomForModule.get(activity.moduleId);
    const detail = `${activity.title} · ${classroomLabel(classroomId)}`;
    addEvent(activityEvents, "coursework", "Assignment published", detail, activity.createdAt, classroomId);
    addEvent(systemEvents, "coursework", "Assignment published", detail, activity.createdAt, classroomId);
  }
  for (const exam of exams) {
    const detail = `${exam.title} · ${classroomLabel(exam.classroomId)}`;
    addEvent(activityEvents, "coursework", "Assessment published", detail, exam.createdAt, exam.classroomId);
    addEvent(systemEvents, "coursework", "Assessment published", detail, exam.createdAt, exam.classroomId);
  }
  for (const announcement of announcements) {
    const detail = `${announcement.title} · ${classroomLabel(announcement.classroomId)}`;
    addEvent(activityEvents, "announcement", "Announcement posted", detail, announcement.createdAt, announcement.classroomId);
    addEvent(systemEvents, "announcement", "Announcement posted", detail, announcement.createdAt, announcement.classroomId);
  }
  for (const submission of activitySubmissions) {
    const activity = activities.find((item) => item.id === submission.activityId);
    const detail = `${studentName(submission.studentId)} submitted ${activity?.title || "an assignment"} · ${classroomLabel(submission.classroomId)}`;
    addEvent(activityEvents, "submission", "Assignment submitted", detail, submission.submittedAt, submission.classroomId);
    addEvent(studentEvents, "submission", "Assignment submitted", detail, submission.submittedAt, submission.classroomId);
    addEvent(systemEvents, "submission", "Assignment submitted", detail, submission.submittedAt, submission.classroomId);
    if (submission.gradedAt) {
      const graded = `${studentName(submission.studentId)} · ${activity?.title || "Assignment"} · ${classroomLabel(submission.classroomId)}`;
      addEvent(activityEvents, "grade", "Assignment graded", graded, submission.gradedAt, submission.classroomId);
      addEvent(studentEvents, "grade", "Assignment graded", graded, submission.gradedAt, submission.classroomId);
      addEvent(systemEvents, "grade", "Assignment graded", graded, submission.gradedAt, submission.classroomId);
    }
  }
  for (const submission of examSubmissions) {
    const exam = exams.find((item) => item.id === submission.examId);
    const classroomId = submission.classroomId || exam?.classroomId;
    const detail = `${studentName(submission.studentId)} submitted ${exam?.title || "an assessment"} · ${classroomLabel(classroomId)}`;
    addEvent(activityEvents, "submission", "Assessment submitted", detail, submission.submittedAt, classroomId);
    addEvent(studentEvents, "submission", "Assessment submitted", detail, submission.submittedAt, classroomId);
    addEvent(systemEvents, "submission", "Assessment submitted", detail, submission.submittedAt, classroomId);
    if (submission.gradedAt) {
      const graded = `${studentName(submission.studentId)} · ${exam?.title || "Assessment"} · ${classroomLabel(classroomId)}`;
      addEvent(activityEvents, "grade", "Assessment graded", graded, submission.gradedAt, classroomId);
      addEvent(studentEvents, "grade", "Assessment graded", graded, submission.gradedAt, classroomId);
      addEvent(systemEvents, "grade", "Assessment graded", graded, submission.gradedAt, classroomId);
    }
  }

  const coursework = [
    ...activities.filter(active).map((item) => ({ id: item.id, type: "activity", classroomId: roomForModule.get(item.moduleId), dueAt: item.dueAt })),
    ...exams.filter(active).map((item) => ({ id: item.id, type: "exam", classroomId: item.classroomId, dueAt: item.dueAt })),
  ].filter((item) => activeRoomIds.has(item.classroomId) && (range === "term" || range === "all" || (item.dueAt && inRange({ date: item.dueAt }, range, now))));
  const activeEnrollments = enrollments.filter((item) => active(item) && activeRoomIds.has(item.classroomId));
  const opportunityKeys = new Set();
  for (const enrollment of activeEnrollments) {
    for (const item of coursework) {
      if (item.classroomId === enrollment.classroomId) opportunityKeys.add(`${item.type}:${item.id}:${enrollment.studentId}`);
    }
  }
  const completedKeys = new Set([
    ...activitySubmissions.filter((item) => item.status === "submitted" || item.status === "graded").map((item) => `activity:${item.activityId}:${item.studentId}`),
    ...examSubmissions.filter((item) => item.status === "submitted" || item.status === "graded").map((item) => `exam:${item.examId}:${item.studentId}`),
    ...(range === "term" || range === "all" ? list(legacyCompleted).map((examId) => `exam:${examId}:s0`) : []),
  ]);
  let completed = 0;
  for (const key of opportunityKeys) if (completedKeys.has(key)) completed += 1;

  const metrics = {
    totalStudents: users.filter((user) => user.role === "student").length,
    totalFaculty: users.filter((user) => user.role === "instructor").length,
    activeCourses: classrooms.filter(active).length,
    activeUsers: users.filter(active).length,
    totalSubjects: subjects.length,
  };
  const events = {
    course: sorted(activityEvents),
    students: sorted(studentEvents),
    system: sorted(systemEvents),
  };
  return {
    terms,
    metrics,
    events,
    recentActivity: buildRecentWorkspaceActivity(events, { now, range }),
    weeklyActivity: {
      course: getWeeklyActivity(events.course, now),
      students: getWeeklyActivity(events.students, now),
      system: getWeeklyActivity(events.system, now),
    },
    analytics: {
      activeCoursework: coursework.length,
      activeEnrollments: activeEnrollments.length,
      opportunities: opportunityKeys.size,
      completed,
      outstanding: Math.max(0, opportunityKeys.size - completed),
      completionRate: opportunityKeys.size ? Math.round(completed / opportunityKeys.size * 100) : 0,
    },
  };
}

export function buildReport(data, type) {
  const users = list(data.users);
  const classrooms = list(data.classrooms);
  const subjects = list(data.subjects);
  const rooms = new Map(classrooms.map((room) => [room.id, room]));
  const courses = new Map(subjects.map((subject) => [subject.id, subject]));
  const people = new Map(users.map((user) => [user.id, user]));
  const name = (user) => user ? `${user.firstName} ${user.lastName}`.trim() : "";
  if (type === "users") return {
    filename: "users.csv",
    headers: ["ID", "First name", "Last name", "Email", "Role", "Status"],
    rows: users.map((user) => [user.id, user.firstName, user.lastName, user.email, user.role, user.status]),
  };
  if (type === "courses") return {
    filename: "courses-and-classrooms.csv",
    headers: ["Subject ID", "Code", "Subject", "Description", "Classroom ID", "Section", "Instructor", "Year", "Term", "Classroom status"],
    rows: subjects.flatMap((subject) => {
      const sections = classrooms.filter((room) => room.subjectId === subject.id);
      return (sections.length ? sections : [null]).map((room) => [subject.id, subject.code, subject.title, subject.description, room?.id, room?.section, name(people.get(room?.instructorId)), room?.yearLevel, room?.term, room?.status]);
    }),
  };
  if (type === "roster") return {
    filename: "course-rosters.csv",
    headers: ["Classroom ID", "Term", "Subject", "Section", "Instructor", "Student", "Student email", "Enrollment status", "Classroom status"],
    rows: classrooms.flatMap((room) => {
      const enrolled = list(data.enrollments).filter((enrollment) => enrollment.classroomId === room.id);
      const subject = courses.get(room.subjectId);
      return (enrolled.length ? enrolled : [null]).map((enrollment) => {
        const student = people.get(enrollment?.studentId);
        return [room.id, room.term, subject?.title, room.section, name(people.get(room.instructorId)), name(student), student?.email, enrollment?.status || "No enrollments", room.status];
      });
    }),
  };
  const activityRows = [
    ...list(data.activitySubmissions).map((submission) => {
      const activity = list(data.activities).find((item) => item.id === submission.activityId);
      return ["Assignment", name(people.get(submission.studentId)), activity?.title, classroomLabel(rooms, courses, submission.classroomId), submission.status, submission.submittedAt, submission.grade ?? "", activity?.maxScore ?? ""];
    }),
    ...list(data.examSubmissions).map((submission) => {
      const exam = list(data.exams).find((item) => item.id === submission.examId);
      return ["Assessment", name(people.get(submission.studentId)), exam?.title, classroomLabel(rooms, courses, submission.classroomId || exam?.classroomId), submission.status, submission.submittedAt, submission.totalScore ?? "", exam?.totalMarks ?? ""];
    }),
  ];
  return {
    filename: "learning-activity.csv",
    headers: ["Type", "Student", "Coursework", "Classroom", "Status", "Submitted at", "Score", "Maximum score"],
    rows: activityRows,
  };
}

function classroomLabel(rooms, subjects, classroomId) {
  const room = rooms.get(classroomId);
  return [subjects.get(room?.subjectId)?.title, room?.section].filter(Boolean).join(" · ");
}

export function serializeCsv(rows) {
  return rows.map((row) => row.map((value) => {
    let cell = String(value ?? "");
    if ("=+-@".includes(cell.trimStart()[0])) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
