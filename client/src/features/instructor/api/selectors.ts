import type { Activity, Classroom, Exam, ExamSubmission, ActivitySubmission, Material, RoleStore, Subject, User } from "./types";

/*
 * Pure rules for the Instructor UI, carried over from the classic UI
 * (removed at cutover) so counts, queues, and defaults stayed identical (C-012).
 */

export const DEFAULT_GRADEBOOK = { activityWeight: 40, examWeight: 60, passingScore: 60 } as const;

export function activeInstructors(store: RoleStore): User[] {
  return store.users.filter((item) => item.role === "instructor" && item.status === "active");
}

export function classroomsOf(store: RoleStore, instructorId: string | undefined): Classroom[] {
  return store.classrooms.filter((item) => item.status === "active" && item.instructorId === instructorId);
}

/** Year level from the record, or parsed from a section like "BSIT · Year 2 · Section A". */
export function yearOf(room: Classroom): number {
  return Number(room.yearLevel) || Number(room.section.match(/Year\s+(\d+)/i)?.[1]) || 1;
}

export function yearLevels(rooms: Classroom[]): number[] {
  return [...new Set(rooms.map(yearOf))].sort((a, b) => a - b);
}

export function subjectOf(store: RoleStore, room: Classroom | undefined): Subject | undefined {
  return store.subjects.find((item) => item.id === room?.subjectId);
}

/** The course code shown before a class name, e.g. "IT101". */
export function classMark(subject: Subject | undefined): string {
  return subject?.code || "Class";
}

export function currentTermName(store: RoleStore): string {
  const admin = store.systemAdministration;
  return admin?.terms.find((term) => term.id === admin.settings.currentTermId)?.name || "Fall 2026";
}

const moduleIdsOf = (store: RoleStore, roomId: string) => new Set(store.modules.filter((item) => item.classroomId === roomId).map((item) => item.id));
const active = <T extends { status?: string }>(item: T) => item.status !== "inactive";

export interface ClassContent {
  modules: RoleStore["modules"];
  materials: Material[];
  activities: Activity[];
  exams: Exam[];
  announcements: NonNullable<RoleStore["announcements"]>;
  students: User[];
}

export function classContent(store: RoleStore, roomId: string): ClassContent {
  const modules = moduleIdsOf(store, roomId);
  return {
    modules: store.modules.filter((item) => item.classroomId === roomId),
    materials: store.materials.filter((item) => modules.has(item.moduleId) && active(item)),
    activities: store.activities.filter((item) => modules.has(item.moduleId) && active(item)),
    exams: store.exams.filter((item) => item.classroomId === roomId && active(item)),
    announcements: (store.announcements ?? []).filter((item) => item.classroomId === roomId && active(item)),
    students: store.enrollments
      .filter((item) => item.classroomId === roomId && item.status === "active")
      .map((item) => store.users.find((user) => user.id === item.studentId))
      .filter((user): user is User => Boolean(user)),
  };
}

export function enrolledCount(store: RoleStore, roomId: string): number {
  return store.enrollments.filter((item) => item.classroomId === roomId && item.status === "active").length;
}

export interface WorkItem {
  id: string;
  title: string;
  kind: "Assignment" | "Assessment";
  dueAt?: string;
  points: number;
  status?: string;
}

/** Assignments and assessments of a class, soonest due first; undated last. */
export function classWork(content: Pick<ClassContent, "activities" | "exams">): WorkItem[] {
  return [
    ...content.activities.map((item) => ({ id: item.id, title: item.title, kind: "Assignment" as const, dueAt: item.dueAt, points: item.maxScore, status: item.status })),
    ...content.exams.map((item) => ({ id: item.id, title: item.title, kind: "Assessment" as const, dueAt: item.dueAt, points: item.totalMarks, status: item.status })),
  ].sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999"));
}

export interface ReviewItem {
  /** The submission's id. */
  id: string;
  kind: "activity" | "exam";
  classroomId: string;
  /** The assignment's or exam's id. */
  courseworkId: string;
  title: string;
  maxScore: number;
  student?: User;
  /** Assignment: the student's note and attachment filename. */
  submission?: ActivitySubmission;
  /** Exam: the attempt waiting for essay scores (details load when it is opened). */
  existing?: ExamSubmission;
}

/**
 * Work waiting for a grade in these classrooms: handed-in assignments without
 * a grade, then exam attempts with essays the server could not score. Exams
 * without essays are graded on submit, so they never wait here (D-032).
 */
export function reviewQueue(store: RoleStore, rooms: Classroom[]): ReviewItem[] {
  const inRooms = (classroomId: string) => rooms.some((room) => room.id === classroomId);
  const studentOf = (id: string) => store.users.find((user) => user.id === id);

  const activities: ReviewItem[] = store.activitySubmissions
    .filter((record) => record.status === "submitted" && record.grade === null && inRooms(record.classroomId))
    .flatMap((record) => {
      const activity = store.activities.find((item) => item.id === record.activityId);
      return activity
        ? [{ id: record.id, kind: "activity" as const, classroomId: record.classroomId, courseworkId: activity.id, title: activity.title, maxScore: activity.maxScore, student: studentOf(record.studentId), submission: record }]
        : [];
    });

  const exams: ReviewItem[] = store.examSubmissions
    .filter((record) => record.status === "submitted" && inRooms(record.classroomId))
    .flatMap((record) => {
      const exam = store.exams.find((item) => item.id === record.examId);
      return exam
        ? [{ id: record.id, kind: "exam" as const, classroomId: record.classroomId, courseworkId: exam.id, title: exam.title, maxScore: exam.totalMarks, student: studentOf(record.studentId), existing: record }]
        : [];
    });

  return [...activities, ...exams];
}

export interface CategoryAverage {
  graded: number;
  /** Percentage 0–100, or null when nothing is graded. */
  average: number | null;
}

const averageOf = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

/** Illustrative category averages from graded work only (classic rule). */
export function gradebookAverages(store: RoleStore, roomId: string): { activities: CategoryAverage; exams: CategoryAverage } {
  const activityGrades = store.activitySubmissions.filter((item) => item.classroomId === roomId && item.grade !== null && item.grade !== undefined);
  const examGrades = store.examSubmissions.filter((item) => item.classroomId === roomId && item.status === "graded");
  const maxOf = (activityId: string) => store.activities.find((item) => item.id === activityId)?.maxScore || 1;
  return {
    activities: { graded: activityGrades.length, average: averageOf(activityGrades.map((item) => ((item.grade ?? 0) / maxOf(item.activityId)) * 100)) },
    exams: { graded: examGrades.length, average: averageOf(examGrades.map((item) => ((item.totalScore ?? 0) / (store.exams.find((exam) => exam.id === item.examId)?.totalMarks || 1)) * 100)) },
  };
}

export interface InstructorSearchResult {
  id: string;
  kind: string;
  title: string;
  classroomId: string;
  target: "class" | "material" | "assessment";
}

/** Classes, materials, and assessments, at most six (classic search). */
export function searchInstructor(store: RoleStore, rooms: Classroom[], query: string): InstructorSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const moduleRoom = new Map(store.modules.map((module) => [module.id, module.classroomId]));
  const roomIds = new Set(rooms.map((room) => room.id));
  return [
    ...rooms.map((room) => ({ id: room.id, kind: `Year ${yearOf(room)} classroom`, title: `${subjectOf(store, room)?.title || "Classroom"} · ${room.section}`, classroomId: room.id, target: "class" as const })),
    ...store.materials.filter((item) => roomIds.has(moduleRoom.get(item.moduleId) ?? "")).map((item) => ({ id: item.id, kind: "Material", title: item.title, classroomId: moduleRoom.get(item.moduleId) ?? "", target: "material" as const })),
    ...store.exams.filter((item) => active(item) && roomIds.has(item.classroomId)).map((item) => ({ id: item.id, kind: "Assessment", title: item.title, classroomId: item.classroomId, target: "assessment" as const })),
  ]
    .filter((item) => `${item.kind} ${item.title}`.toLowerCase().includes(q))
    .slice(0, 6);
}
