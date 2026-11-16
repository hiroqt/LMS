import { describeApiError, getJson, isApiError, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";

/** LMS API calls for the Student workspace (D-032). The server enforces every rule. */

export const studentKeys = {
  all: ["student"] as const,
  overview: (studentId: string) => ["student", "overview", studentId] as const,
  attempt: (studentId: string, assessmentId: string) => ["student", "attempt", studentId, assessmentId] as const,
  result: (studentId: string, attemptId: number) => ["student", "result", studentId, attemptId] as const,
};

export const studentQueryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;

export interface AttemptQuestion {
  id: number;
  type: string;
  prompt: string;
  points: number;
  timeLimitSeconds: number | null;
  options: Array<{ id: number; text: string }>;
}

export interface AttemptAnswer {
  questionId: number;
  optionId: number | null;
  text: string | null;
  pointsAwarded: number | null;
}

/** An exam attempt as the student sees it: questions without answers. */
export interface Attempt {
  id: number;
  attemptNumber: number;
  status: "in_progress" | "submitted" | "graded" | "returned";
  startedAt: string | null;
  submittedAt: string | null;
  deadline: string | null;
  score: number | null;
  maxPoints: number;
  feedback: string | null;
  questions: AttemptQuestion[];
  answers: AttemptAnswer[];
}

const workPath = (classId: string, assessmentId: string) => `/api/classes/${encodeURIComponent(classId)}/coursework/${assessmentId}`;

/** Starts an attempt, or returns the one already open, so a reload resumes it. */
export const startAttempt = (viewer: Viewer, classId: string, assessmentId: string) =>
  sendJson<Attempt>("POST", `${workPath(classId, assessmentId)}/attempts`, undefined, { viewer });

export const fetchAttempt = (viewer: Viewer, classId: string, assessmentId: string, attemptId: number, signal?: AbortSignal) =>
  getJson<Attempt>(`${workPath(classId, assessmentId)}/attempts/${attemptId}`, { identity: true, viewer, signal });

export type ChosenAnswers = Array<{ questionId: number; optionId: number }>;

export const saveAnswers = (viewer: Viewer, classId: string, assessmentId: string, attemptId: number, answers: ChosenAnswers) =>
  sendJson<Attempt>("PUT", `${workPath(classId, assessmentId)}/attempts/${attemptId}/answers`, { answers }, { viewer });

export const submitAttempt = (viewer: Viewer, classId: string, assessmentId: string, attemptId: number, answers: ChosenAnswers) =>
  sendJson<Attempt>("POST", `${workPath(classId, assessmentId)}/attempts/${attemptId}/submit`, { answers }, { viewer });

export const submitAssignment = (viewer: Viewer, classId: string, assessmentId: string, work: { fileName: string; comment: string }) =>
  sendJson("POST", `${workPath(classId, assessmentId)}/submissions`, { fileName: work.fileName.trim(), text: work.comment.trim() || undefined }, { viewer });

/** A plain-language reason for a failed change: the server's own words when it gave some. */
export function failureMessage(error: unknown): string {
  if (isApiError(error) && error.status === 409 && error.title) return error.title;
  if (isApiError(error) && error.status === 400) return Object.values(error.fieldErrors).flat()[0] ?? "Check your work and try again.";
  const { title, detail } = describeApiError(error);
  return `${title}. ${detail}`;
}
