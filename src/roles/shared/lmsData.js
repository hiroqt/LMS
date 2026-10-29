import { assessments, courses, questionsByAssessment, students, materials } from "../../data.js";
import { readRoleData, saveRoleData } from "./storage.js";
import { initializeSystemAdministration } from "./systemAdministrationData.js";

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
  const modules = classrooms.map((room, index) => ({ id: `module-${index + 1}`, classroomId: room.id, subjectId: subjects[index]?.id, title: "Unit 1 · Foundations", order: 1 }));
  const materialRecords = materials.map((material, index) => {
    const courseIndex = courses.findIndex((course) => course.id === material.courseId);
    const mod = modules[courseIndex];
    const sub = subjects[courseIndex];
    const ext = material.kind === "Study guide" ? "pdf" : material.kind === "Reference sheet" ? "docx" : material.kind === "Practice set" ? "zip" : "pdf";
    return {
      id: material.id,
      subjectId: sub?.id,
      moduleId: mod?.id,
      title: material.title,
      kind: material.kind,
      description: material.summary,
      fileType: ext,
      fileName: `${material.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.${ext}`,
      fileSize: ["2.4 MB", "1.8 MB", "3.1 MB", "950 KB"][index % 4],
      uploadedBy: "Taylor Morgan",
      uploadedAt: `2026-10-${String(15 + (index % 10)).padStart(2, "0")}T09:30:00Z`,
      downloads: 12 + ((index * 9) % 35),
      scope: "Institutional",
      status: "active",
    };
  }).filter((item) => item.moduleId);
  const externalLinks = [
    {
      id: "ext-1",
      title: "MDN Web Docs — JavaScript Language Reference",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      subjectId: subjects[2]?.id || "subject-english",
      category: "Documentation",
      provider: "Mozilla Foundation",
      description: "Official standards reference for modern JavaScript syntax, APIs, and web specifications.",
      status: "verified",
      addedAt: "2026-10-12T08:00:00Z",
    },
    {
      id: "ext-2",
      title: "PostgreSQL 16 Interactive Documentation",
      url: "https://www.postgresql.org/docs/16/index.html",
      subjectId: subjects[1]?.id || "subject-math",
      category: "Documentation",
      provider: "PostgreSQL Global Development Group",
      description: "Official manual for SQL relational schemas, indexing strategies, and ACID integrity.",
      status: "verified",
      addedAt: "2026-10-14T09:30:00Z",
    },
    {
      id: "ext-3",
      title: "IEEE Xplore Digital Library",
      url: "https://ieeexplore.ieee.org/",
      subjectId: subjects[3]?.id || "subject-history",
      category: "Research Database",
      provider: "IEEE",
      description: "Peer-reviewed scientific journals, networking conference proceedings, and RFC standards.",
      status: "verified",
      addedAt: "2026-10-15T11:00:00Z",
    },
    {
      id: "ext-4",
      title: "Python Tutor — Code Visualizer",
      url: "https://pythontutor.com/",
      subjectId: subjects[0]?.id || "subject-biology",
      category: "Interactive Tool",
      provider: "Philip Guo / Open Source",
      description: "Visual execution tracing for algorithms, pointers, stack frames, and variables.",
      status: "verified",
      addedAt: "2026-10-16T14:15:00Z",
    },
  ];
  const exams = assessments.map((exam) => ({ id: exam.id, classroomId: exam.courseId, moduleId: modules[courses.findIndex((course) => course.id === exam.courseId)]?.id, title: exam.title, instructions: exam.instructions, dueAt: exam.dueAt, totalMarks: exam.points, timeLimitMinutes: Number.parseInt(exam.timeLimit, 10) || 0, attempts: 1, status: "active", questions: (questionsByAssessment[exam.id] || []).map((question) => ({ prompt: question.prompt, options: question.options, correctIndex: question.correct, points: question.points })) }));
  return initializeSystemAdministration({ users, subjects, classrooms, enrollments, modules, materials: materialRecords, externalLinks, announcements: [], activities: [], activitySubmissions: [], exams, examSubmissions: [], gradebookSettings: Object.fromEntries(classrooms.map((room) => [room.id, { activityWeight: 40, examWeight: 60, passingScore: 60 }])) });
}

export function loadLmsData() {
  const data = readRoleData();
  if (!data) return createInitialData();
  const seed = createInitialData();
  const syncSeedFields = (records, defaults, fields) => (records || []).map((record) => {
    const latest = defaults.find((item) => item.id === record.id);
    return latest ? { ...record, ...Object.fromEntries(fields.map((field) => [field, latest[field]])) } : record;
  });
  const updated = initializeSystemAdministration({
    ...data,
    announcements: data.announcements || [],
    subjects: syncSeedFields(data.subjects, seed.subjects, ["code", "title", "description"]),
    classrooms: syncSeedFields(data.classrooms, seed.classrooms, ["section", "yearLevel", "term", "enrollmentCode"]),
    externalLinks: data.externalLinks || seed.externalLinks || [],
    materials: (data.materials || seed.materials || []).map((mat, idx) => {
      const match = seed.materials.find((s) => s.id === mat.id);
      return {
        ...mat,
        fileType: mat.fileType || match?.fileType || "pdf",
        fileName: mat.fileName || match?.fileName || `${(mat.title || "document").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.pdf`,
        fileSize: mat.fileSize || match?.fileSize || "2.1 MB",
        uploadedBy: mat.uploadedBy || match?.uploadedBy || "Taylor Morgan",
        uploadedAt: mat.uploadedAt || match?.uploadedAt || "2026-10-18T10:00:00Z",
        downloads: mat.downloads ?? match?.downloads ?? (15 + (idx * 7) % 30),
        scope: mat.scope || match?.scope || "Institutional",
        subjectId: mat.subjectId || match?.subjectId || seed.subjects[0]?.id,
      };
    }),
    exams: syncSeedFields(data.exams, seed.exams, ["title", "instructions"]),
  });
  if (JSON.stringify(updated) !== JSON.stringify(data)) saveRoleData(updated);
  return updated;
}

export function persistLmsData(data) {
  return saveRoleData(data);
}

export function nextId(prefix) {
  return id(prefix);
}
