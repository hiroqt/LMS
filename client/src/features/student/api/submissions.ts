import { createInitialData } from "../../../roles/shared/lmsData.js";
import { readRoleData, saveRoleData } from "../../../roles/shared/storage.js";
import { appendAuditEvent } from "../../../roles/shared/systemAdministrationData.js";
import { STUDENT } from "./catalog";
import { markCompleted } from "./progressStore";
import type { Assessment } from "./types";

/*
 * Writes go to the shared role store with exactly the records the classic
 * Student UI writes, so the classic Instructor UI and Admin read them
 * unchanged. Audit events stay metadata-only (no answers or comments).
 */

interface RoleStore {
  exams?: Array<{ id: string; status?: string }>;
  examSubmissions?: Array<{ id: string; examId: string; studentId: string; status: string }>;
  activitySubmissions?: Array<{ activityId: string; studentId: string }>;
}

const actor = { actorId: STUDENT.id, actorName: STUDENT.name, actorRole: "student", category: "activity", action: "submitted" };

/** Records a quiz/exam completion; instructor-created exams also get a submission for grading. */
export function submitExam(assessment: Assessment, answers: Record<number, number>): void {
  const role = (readRoleData() ?? createInitialData()) as RoleStore;
  const existing = (role.examSubmissions ?? []).find((item) => item.examId === assessment.id && item.studentId === STUDENT.id);
  const gradable = (role.exams ?? []).some((item) => item.id === assessment.id && item.status !== "inactive");
  if (existing?.status !== "graded" && gradable) {
    const submittedAt = new Date().toISOString();
    const submission = {
      id: existing?.id ?? `exam-submission-${assessment.id}-${STUDENT.id}`,
      examId: assessment.id,
      classroomId: assessment.courseId,
      studentId: STUDENT.id,
      status: "submitted",
      answers,
      submittedAt,
    };
    const updated = { ...role, examSubmissions: [...(role.examSubmissions ?? []).filter((item) => item.id !== existing?.id), submission] };
    saveRoleData(appendAuditEvent(updated, { ...actor, target: "Assessment", targetId: assessment.id, summary: assessment.title }, new Date(submittedAt)));
  }
  markCompleted(assessment.id);
}

/** Turns in an assignment: the attachment filename and a comment (no file upload in the demo). */
export function submitActivity(assessment: Assessment, work: { fileName: string; comment: string }): boolean {
  const role = readRoleData() as RoleStore | null;
  if (!role || assessment.kind !== "activity") return false;
  const submittedAt = new Date().toISOString();
  const submission = {
    id: `activity-submission-${assessment.id}-${STUDENT.id}`,
    activityId: assessment.id,
    classroomId: assessment.courseId,
    studentId: STUDENT.id,
    submissionText: work.comment.trim(),
    fileAttachmentUrl: work.fileName.trim(),
    status: "submitted",
    submittedAt,
    grade: null,
    feedback: "",
  };
  const others = (role.activitySubmissions ?? []).filter((item) => !(item.activityId === assessment.id && item.studentId === STUDENT.id));
  const saved = saveRoleData(appendAuditEvent({ ...role, activitySubmissions: [...others, submission] }, { ...actor, target: "Assignment", targetId: assessment.id, summary: assessment.title }, new Date(submittedAt)));
  markCompleted(assessment.id);
  return saved;
}
