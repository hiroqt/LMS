import { academicEvents, featuredAnnouncements, students, studentSeed } from "../../../data.js";
import { getStudentExtensions, readRoleData } from "../../../roles/shared/storage.js";
import type { ActivitySubmission, ClassAnnouncement, ExamGrade, StudentCatalog } from "./types";

/** The demo student. The classic UI and the role store both use id s0. */
export const STUDENT_ID = "s0";
export const STUDENT = { id: STUDENT_ID, firstName: "Alex", name: "Alex Rivera", program: "BS Information Technology" } as const;

interface Extensions {
  synced: boolean;
  activeCourseIds: string[];
  courses: StudentCatalog["courses"];
  assessments: StudentCatalog["assessments"];
  materials: StudentCatalog["materials"];
  questions: StudentCatalog["questions"];
}

interface RoleData {
  subjects?: Array<{ id: string; code?: string }>;
  classrooms?: Array<{ id: string; subjectId: string }>;
  users?: Array<{ id: string; firstName: string; lastName: string }>;
  announcements?: Array<{ id: string; classroomId: string; instructorId: string; title: string; message: string; createdAt: string; status?: string }>;
  activitySubmissions?: Array<ActivitySubmission & { studentId: string }>;
  examSubmissions?: Array<ExamGrade & { studentId: string; status: string }>;
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const ids = new Set(base.map((item) => item.id));
  return [...base, ...extra.filter((item) => !ids.has(item.id))];
}

/**
 * Builds the Student workspace from the seed plus the shared role store,
 * with the same rules as the classic merge at the bottom of data.js: when
 * role data exists, keep only actively enrolled classes, then add
 * instructor-created classes, assessments, assignments, and materials.
 *
 * Unlike the classic merge (once, at import), this runs on every read, so
 * instructor changes appear without a page reload.
 */
export function buildStudentCatalog(): StudentCatalog {
  const ext = getStudentExtensions() as Extensions;
  const role = (readRoleData() ?? {}) as RoleData;
  const active = new Set(ext.activeCourseIds);
  const keep = <T>(items: T[], courseOf: (item: T) => string) => (ext.synced ? items.filter((item) => active.has(courseOf(item))) : items);

  // Instructor-created classes carry no course code; take it from the class's subject.
  const subjectCode = (classroomId: string) => role.subjects?.find((subject) => subject.id === role.classrooms?.find((room) => room.id === classroomId)?.subjectId)?.code;
  const courses = mergeById(keep(studentSeed.courses as StudentCatalog["courses"], (item) => item.id), ext.courses).map((course) =>
    course.code ? course : { ...course, code: subjectCode(course.id) },
  );
  const assessments = mergeById(keep(studentSeed.assessments as StudentCatalog["assessments"], (item) => item.courseId), ext.assessments);
  const materials = mergeById(keep(studentSeed.materials as StudentCatalog["materials"], (item) => item.courseId), ext.materials);
  const teacherOf = (classroomId: string) => courses.find((course) => course.id === classroomId)?.teacher ?? "Instructor";

  const announcements: ClassAnnouncement[] = (role.announcements ?? [])
    .filter((item) => item.status !== "inactive")
    .map((item) => {
      const author = role.users?.find((user) => user.id === item.instructorId);
      return {
        id: item.id,
        classroomId: item.classroomId,
        title: item.title,
        message: item.message,
        createdAt: item.createdAt,
        author: author ? `${author.firstName} ${author.lastName}` : teacherOf(item.classroomId),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activitySubmissions = Object.fromEntries(
    (role.activitySubmissions ?? []).filter((item) => item.studentId === STUDENT_ID).map((item) => [item.activityId, item]),
  );
  const examGrades = Object.fromEntries(
    (role.examSubmissions ?? []).filter((item) => item.studentId === STUDENT_ID && item.status === "graded").map((item) => [item.examId, item]),
  );

  return {
    courses,
    assessments,
    materials,
    questions: { ...(studentSeed.questionsByAssessment as StudentCatalog["questions"]), ...ext.questions },
    academicEvents: academicEvents as StudentCatalog["academicEvents"],
    featured: featuredAnnouncements as StudentCatalog["featured"],
    classmates: students as StudentCatalog["classmates"],
    announcements,
    activitySubmissions,
    examGrades,
  };
}

/** The course code shown on cards and headers, e.g. "IT101" (falls back to the class symbol). */
export function courseCode(course: { code?: string; symbol: string }): string {
  return course.code || course.symbol;
}
