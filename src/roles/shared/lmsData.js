import { assessments, courses, questionsByAssessment, students, materials } from "../../data.js";
import { readRoleData, saveRoleData } from "./storage.js";

const id = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export function createInitialData() {
  const instructors = [...new Set(courses.map((course) => course.teacher))].map((name, index) => {
    const [firstName, ...rest] = name.replace(/^(Ms\.|Mr\.|Dr\.|Prof\.)\s*/, "").split(" ");
    return { id: `instructor-${index + 1}`, firstName, lastName: rest.join(" "), email: `${firstName}.${rest.join(".")}@tmcc.edu`.toLowerCase(), role: "instructor", status: "active" };
  });
  const users = [
    ...students.map((student) => ({ id: student.id, firstName: student.name.split(" ")[0], lastName: student.name.split(" ").slice(1).join(" "), email: student.email, role: "student", status: "active" })),
    ...instructors,
    { id: "admin-1", firstName: "Taylor", lastName: "Morgan", email: "taylor.morgan@tmcc.edu", role: "admin", status: "active" },
  ];
  const subjects = courses.map((course, index) => ({ id: `subject-${course.id}`, code: course.code || `IT${String(100 + index)}`, title: course.name, description: course.about }));
  const classrooms = courses.map((course, index) => ({ id: course.id, subjectId: subjects[index].id, instructorId: instructors[index % instructors.length].id, section: course.section, yearLevel: Number(course.section.match(/Year\s+(\d+)/i)?.[1]) || 1, term: "Fall 2026", enrollmentCode: `TMCC-${course.code || `IT${index + 1}`}-${index + 1}0`, status: "active" }));
  const enrollments = classrooms.flatMap((room) => students.map((student) => ({ id: `${room.id}-${student.id}`, classroomId: room.id, studentId: student.id, status: "active" })));
  const modules = classrooms.map((room, index) => ({ id: `module-${index + 1}`, classroomId: room.id, title: "Unit 1 · Foundations", order: 1 }));
  const materialRecords = materials.map((material) => ({ id: material.id, moduleId: modules[courses.findIndex((course) => course.id === material.courseId)]?.id, title: material.title, kind: material.kind, description: material.summary, status: "active" })).filter((item) => item.moduleId);
  const exams = assessments.map((exam) => ({ id: exam.id, classroomId: exam.courseId, moduleId: modules[courses.findIndex((course) => course.id === exam.courseId)]?.id, title: exam.title, instructions: exam.instructions, dueAt: exam.dueAt, totalMarks: exam.points, timeLimitMinutes: Number.parseInt(exam.timeLimit, 10) || 0, attempts: 1, status: "active", questions: (questionsByAssessment[exam.id] || []).map((question) => ({ prompt: question.prompt, options: question.options, correctIndex: question.correct, points: question.points })) }));
  return { users, subjects, classrooms, enrollments, modules, materials: materialRecords, announcements: [], activities: [], activitySubmissions: [], exams, examSubmissions: [], gradebookSettings: Object.fromEntries(classrooms.map((room) => [room.id, { activityWeight: 40, examWeight: 60, passingScore: 60 }])) };
}

export function loadLmsData() {
  const data = readRoleData();
  if (!data) return createInitialData();
  const seed = createInitialData();
  const syncSeedFields = (records, defaults, fields) => (records || []).map((record) => {
    const latest = defaults.find((item) => item.id === record.id);
    return latest ? { ...record, ...Object.fromEntries(fields.map((field) => [field, latest[field]])) } : record;
  });
  const updated = {
    ...data,
    announcements: data.announcements || [],
    subjects: syncSeedFields(data.subjects, seed.subjects, ["code", "title", "description"]),
    classrooms: syncSeedFields(data.classrooms, seed.classrooms, ["section", "yearLevel", "term", "enrollmentCode"]),
    materials: syncSeedFields(data.materials, seed.materials, ["title", "kind", "description"]),
    exams: syncSeedFields(data.exams, seed.exams, ["title", "instructions"]),
  };
  if (JSON.stringify(updated) !== JSON.stringify(data)) saveRoleData(updated);
  return updated;
}

export function persistLmsData(data) {
  return saveRoleData(data);
}

export function nextId(prefix) {
  return id(prefix);
}
