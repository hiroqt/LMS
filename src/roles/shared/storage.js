export const LMS_STORAGE_KEY = "tmcc-lms-roles-v1";

export function readRoleData() {
  try {
    return JSON.parse(localStorage.getItem(LMS_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveRoleData(data) {
  try {
    localStorage.setItem(LMS_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("tmcc-lms-data"));
    return true;
  } catch {
    return false;
  }
}

export function getStudentExtensions() {
  const data = readRoleData();
  if (!data) return { synced: false, activeCourseIds: [], courses: [], assessments: [], materials: [], questions: {} };
  const users = data.users || [];
  const student = users.find((item) => item.email === "alex.rivera@school.edu");
  const activeClassrooms = (data.classrooms || []).filter((room) =>
    room.status !== "inactive" && (data.enrollments || []).some((enrollment) =>
      enrollment.classroomId === room.id && enrollment.studentId === student?.id && enrollment.status === "active"));
  const courses = activeClassrooms.map((room) => {
    const subject = (data.subjects || []).find((item) => item.id === room.subjectId);
    const instructor = users.find((item) => item.id === room.instructorId);
    return { id: room.id, name: subject?.title || "New class", subject: subject?.title || "Class", section: room.section, room: "Room 210", teacher: instructor ? `${instructor.firstName} ${instructor.lastName}` : "Instructor", count: (data.enrollments || []).filter((item) => item.classroomId === room.id && item.status === "active").length, next: "See classwork", symbol: subject?.code?.slice(0, 2) || "CL", about: subject?.description || "Course workspace" };
  });
  const courseIds = new Set(courses.map((item) => item.id));
  const modules = data.modules || [];
  const moduleCourse = (moduleId) => modules.find((item) => item.id === moduleId)?.classroomId;
  const assessments = [
    ...(data.exams || []).filter((item) => courseIds.has(item.classroomId) && item.status !== "inactive").map((item) => ({ id: item.id, courseId: item.classroomId, title: item.title, type: "Exam", description: item.instructions || "Instructor-created assessment", dueAt: item.dueAt || new Date(Date.now() + 7 * 86400000).toISOString(), questionCount: item.questions?.length || 1, points: item.totalMarks || 10, timeLimit: item.timeLimitMinutes ? `${item.timeLimitMinutes} minutes` : "No time limit", instructions: item.instructions || "Read each question carefully.", courseIndex: courses.findIndex((course) => course.id === item.classroomId) })),
    ...(data.activities || []).filter((item) => courseIds.has(moduleCourse(item.moduleId)) && item.status !== "inactive").map((item) => ({ id: item.id, courseId: moduleCourse(item.moduleId), title: item.title, type: "Assignment", kind: "activity", description: item.instructions || "Instructor-assigned classwork", dueAt: item.dueAt || new Date(Date.now() + 7 * 86400000).toISOString(), points: item.maxScore || 10, timeLimit: "—", instructions: item.instructions || "Submit your work below.", allowLate: item.allowLate, allowResubmission: item.allowResubmission, courseIndex: courses.findIndex((course) => course.id === moduleCourse(item.moduleId)) })),
  ];
  const materials = (data.materials || []).filter((item) => courseIds.has(moduleCourse(item.moduleId)) && item.status !== "inactive").map((item) => ({ id: item.id, courseId: moduleCourse(item.moduleId), title: item.title, kind: item.kind || "Class material", readTime: "5 min", summary: item.description || "Shared by your instructor.", added: "Just added", goal: "Review this resource", points: [] }));
  const questions = Object.fromEntries((data.exams || []).filter((item) => courseIds.has(item.classroomId)).map((exam) => [exam.id, (exam.questions || []).map((question, index) => ({ id: `${exam.id}-${index}`, prompt: question.prompt, options: question.options?.length ? question.options : ["Written response"], correct: question.correctIndex ?? 0, points: question.points || 1 }))]));
  return { synced: true, activeCourseIds: activeClassrooms.map((room) => room.id), courses, assessments, materials, questions };
}
