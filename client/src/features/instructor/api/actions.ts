import { commit } from "./store";
import { DEFAULT_GRADEBOOK, type ReviewItem } from "./selectors";
import type { AuditEvent, Classroom, GradebookSetting, User } from "./types";

/*
 * Every write mirrors roles/instructor/Instructor.jsx: same record shapes,
 * ids, defaults, and metadata-only audit events, so Student, Admin, and the
 * classic UI read them unchanged. Each returns false if storage refused it.
 */

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function auditFor(instructor: User) {
  return (category: string, action: string, target: string, targetId: string, summary: string): AuditEvent => ({
    actorId: instructor.id,
    actorName: `${instructor.firstName} ${instructor.lastName}`,
    actorRole: "instructor",
    category,
    action,
    target,
    targetId,
    summary,
  });
}

export function createClassroom(instructor: User, input: { subjectId: string; yearLevel: number; section: string }, term: string): string | null {
  const id = `classroom-${uid()}`;
  const classroom: Classroom = {
    id,
    subjectId: input.subjectId,
    instructorId: instructor.id,
    section: input.section.trim(),
    yearLevel: input.yearLevel,
    term,
    enrollmentCode: `TMCC-${id.slice(-8).toUpperCase()}`,
    status: "active",
    createdAt: now(),
  };
  const saved = commit(
    (current) => ({
      ...current,
      classrooms: [...current.classrooms, classroom],
      modules: [...current.modules, { id: `module-${uid()}`, classroomId: id, title: "Unit 1 · Foundations", order: 1 }],
      gradebookSettings: { ...current.gradebookSettings, [id]: { ...DEFAULT_GRADEBOOK } },
    }),
    auditFor(instructor)("courses", "created", "Classroom", id, `${classroom.section} · ${term}`),
  );
  return saved ? id : null;
}

export interface MaterialInput {
  moduleId: string;
  title: string;
  kind: string;
  description: string;
  fileName?: string;
  fileType?: string;
  fileSize?: string;
}

export function createMaterial(instructor: User, classroomId: string, input: MaterialInput): boolean {
  const id = `material-${uid()}`;
  const ext = input.fileType || "pdf";
  const fileName = input.fileName || `${input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}.${ext}`;
  return commit(
    (current) => ({
      ...current,
      materials: [
        ...current.materials,
        {
          id,
          moduleId: input.moduleId || current.modules.find((item) => item.classroomId === classroomId)?.id || "",
          classroomId,
          title: input.title.trim(),
          kind: input.kind || "Study guide",
          description: input.description.trim(),
          fileName,
          fileType: ext,
          fileSize: input.fileSize || "1.8 MB",
          uploadedBy: `${instructor.firstName} ${instructor.lastName}`,
          uploadedAt: now(),
          downloads: 0,
          status: "active",
          createdAt: now(),
        },
      ],
    }),
    auditFor(instructor)("courses", "published", "Material", id, input.title.trim()),
  );
}

export interface ActivityInput {
  moduleId: string;
  title: string;
  instructions: string;
  dueAt: string;
  points: number;
  allowLate: boolean;
  allowResubmission: boolean;
}

export function createActivity(instructor: User, input: ActivityInput): boolean {
  const id = `activity-${uid()}`;
  return commit(
    (current) => ({
      ...current,
      activities: [
        ...current.activities,
        {
          id,
          moduleId: input.moduleId,
          title: input.title.trim(),
          instructions: input.instructions.trim(),
          dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : "",
          maxScore: input.points || 10,
          allowLate: input.allowLate,
          allowResubmission: input.allowResubmission,
          status: "active",
          createdAt: now(),
        },
      ],
    }),
    auditFor(instructor)("courses", "published", "Coursework", id, input.title.trim()),
  );
}

export interface ExamInput {
  moduleId: string;
  title: string;
  instructions: string;
  dueAt: string;
  points: number;
  timeLimit: number;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export function createExam(instructor: User, classroomId: string, input: ExamInput): boolean {
  const id = `exam-${uid()}`;
  return commit(
    (current) => ({
      ...current,
      exams: [
        ...current.exams,
        {
          id,
          classroomId,
          moduleId: input.moduleId,
          title: input.title.trim(),
          instructions: input.instructions.trim(),
          dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : "",
          totalMarks: input.points || 10,
          timeLimitMinutes: input.timeLimit || 0,
          attempts: 1,
          status: "active",
          createdAt: now(),
          questions: [{ prompt: input.prompt.trim(), options: input.options.filter(Boolean), correctIndex: input.correctIndex, points: input.points || 10 }],
        },
      ],
    }),
    auditFor(instructor)("courses", "published", "Assessment", id, input.title.trim()),
  );
}

export function publishAnnouncement(instructor: User, classroomId: string, input: { title: string; message: string }): boolean {
  const id = `announcement-${uid()}`;
  return commit(
    (current) => ({
      ...current,
      announcements: [
        ...(current.announcements ?? []),
        { id, classroomId, instructorId: instructor.id, title: input.title.trim(), message: input.message.trim(), createdAt: now(), status: "active" },
      ],
    }),
    auditFor(instructor)("courses", "published", "Announcement", id, input.title.trim()),
  );
}

export function setMaterialArchived(instructor: User, materialId: string, archived: boolean): boolean {
  const status = archived ? "archived" : "active";
  return commit(
    (current) => ({ ...current, materials: current.materials.map((item) => (item.id === materialId ? { ...item, status } : item)) }),
    auditFor(instructor)("courses", "updated", "Material", materialId, `Status set to ${status}`),
  );
}

export function deleteMaterial(instructor: User, materialId: string, title: string): boolean {
  return commit(
    (current) => ({ ...current, materials: current.materials.filter((item) => item.id !== materialId) }),
    auditFor(instructor)("courses", "deleted", "Material", materialId, title || "Class material"),
  );
}

/** Saves a final score and optional feedback; the item leaves the review queue. */
export function saveGrade(instructor: User, item: ReviewItem, score: number, feedback: string): boolean {
  const who = `${item.student?.firstName || "Student"} ${item.student?.lastName || ""}`;
  const audit = auditFor(instructor);
  if (item.kind === "activity") {
    return commit(
      (current) => ({
        ...current,
        activitySubmissions: current.activitySubmissions.map((record) =>
          record.id === item.id ? { ...record, grade: score, feedback: feedback.trim(), status: "graded", gradedAt: now(), gradedBy: instructor.id } : record,
        ),
      }),
      audit("activity", "graded", "Assignment", item.id, `${who} · ${item.title}`),
    );
  }
  const studentId = item.student?.id ?? "s0";
  return commit(
    (current) => ({
      ...current,
      examSubmissions: [
        ...current.examSubmissions.filter((record) => !(record.examId === item.id && record.studentId === studentId)),
        {
          id: item.existing?.id || `submission-${uid()}`,
          examId: item.id,
          classroomId: item.classroomId,
          studentId,
          status: "graded",
          totalScore: score,
          feedback: feedback.trim(),
          answers: item.answers,
          submittedAt: item.existing?.submittedAt || now(),
          gradedAt: now(),
          gradedBy: instructor.id,
        },
      ],
    }),
    audit("activity", "graded", "Assessment", item.id, `${who} · ${item.title}`),
  );
}

export function setGradebookSetting(instructor: User, classroomId: string, key: keyof GradebookSetting, value: number): boolean {
  return commit(
    (current) => ({
      ...current,
      gradebookSettings: { ...current.gradebookSettings, [classroomId]: { ...(current.gradebookSettings[classroomId] ?? DEFAULT_GRADEBOOK), [key]: value } },
    }),
    auditFor(instructor)("courses", "updated", "Gradebook settings", classroomId, `${key} updated`),
  );
}
