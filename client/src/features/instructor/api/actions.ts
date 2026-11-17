import { useMemo } from "react";
import { describeApiError, isApiError, sendJson } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import type { ReviewItem } from "./selectors";
import { useRefreshOverview } from "./store";
import type { GradebookSetting } from "./types";

/*
 * Every Instructor change is an LMS API call (D-032). The server checks who may
 * change what, validates, and writes a metadata-only audit row; on success the
 * overview is refreshed so every screen shows the change.
 */

export interface ActionResult {
  ok: boolean;
  /** A plain-language reason when the change was not saved. */
  message?: string;
  /** The server's field errors, e.g. { title: ["Enter a title."] }. */
  fieldErrors?: Record<string, string[]>;
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

export interface ActivityInput {
  moduleId: string;
  title: string;
  instructions: string;
  dueAt: string;
  points: number;
  allowLate: boolean;
  allowResubmission: boolean;
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

export interface AttendanceInput {
  schoolDays: number;
  entries: Array<{ studentId: string; daysPresent: number }>;
}

const classPath = (classroomId: string) => `/api/classes/${encodeURIComponent(classroomId)}`;
/** A datetime-local value ("2026-11-30T15:00") as an instant; empty stays empty. */
const instant = (value: string) => (value ? new Date(value).toISOString() : undefined);

async function attempt(change: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await change();
    return { ok: true };
  } catch (error) {
    const { title, detail } = describeApiError(error);
    return { ok: false, message: isApiError(error) && error.status === 400 ? "Check the highlighted fields." : `${title}. ${detail}`, fieldErrors: isApiError(error) ? error.fieldErrors : undefined };
  }
}

export function useInstructorActions() {
  const { instructorId } = useInstructorSession();
  const refresh = useRefreshOverview();

  return useMemo(() => {
    const viewer: Viewer = { id: instructorId, role: "instructor" };
    const send = <T = unknown>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) => sendJson<T>(method, path, body, { viewer });
    const run = async (change: () => Promise<unknown>) => {
      const result = await attempt(change);
      if (result.ok) await refresh();
      return result;
    };

    return {
      createMaterial: (classroomId: string, input: MaterialInput) =>
        run(() => {
          const type = input.fileType || "pdf";
          return send("POST", `${classPath(classroomId)}/materials`, {
            moduleId: Number(input.moduleId),
            title: input.title,
            kind: input.kind || "Study guide",
            description: input.description,
            fileName: input.fileName || `${input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}.${type}`,
            fileType: type,
            fileSize: input.fileSize,
          });
        }),

      createActivity: (classroomId: string, input: ActivityInput) =>
        run(() =>
          send("POST", `${classPath(classroomId)}/coursework`, {
            type: "assignment",
            moduleId: Number(input.moduleId),
            title: input.title,
            category: "Assignment",
            instructions: input.instructions,
            dueAt: instant(input.dueAt),
            maxPoints: input.points || 10,
            allowLate: input.allowLate,
            allowResubmission: input.allowResubmission,
            status: "published",
          }),
        ),

      // An exam needs a questionnaire first: create it, add the question, then publish the exam.
      createExam: (classroomId: string, input: ExamInput) =>
        run(async () => {
          const questionnaire = await send<{ id: number }>("POST", "/api/questionnaires", { title: input.title });
          await send("PUT", `/api/questionnaires/${questionnaire.id}/questions`, {
            questions: [{
              type: "multiple_choice",
              prompt: input.prompt,
              points: input.points || 10,
              options: input.options.map((text, index) => ({ text, isCorrect: index === input.correctIndex })).filter((option) => option.text.trim()),
            }],
          });
          await send("POST", `${classPath(classroomId)}/coursework`, {
            type: "exam",
            moduleId: Number(input.moduleId),
            title: input.title,
            category: "Assessment",
            instructions: input.instructions,
            dueAt: instant(input.dueAt),
            timeLimitMinutes: input.timeLimit || 0,
            questionnaireId: questionnaire.id,
            status: "published",
          });
        }),

      publishAnnouncement: (classroomId: string, input: { title: string; message: string }) =>
        run(() => send("POST", `${classPath(classroomId)}/announcements`, input)),

      setMaterialArchived: (classroomId: string, materialId: string, archived: boolean) =>
        run(() => send("PATCH", `${classPath(classroomId)}/materials/${materialId}`, { status: archived ? "archived" : "active" })),

      deleteMaterial: (classroomId: string, materialId: string) =>
        run(() => send("DELETE", `${classPath(classroomId)}/materials/${materialId}`)),

      /** Assignments: one score. Exams: points for each essay; the server adds up the rest. */
      saveGrade: (item: ReviewItem, score: number, feedback: string, answerPoints?: Record<string, number>) =>
        run(() =>
          send("PUT", `${classPath(item.classroomId)}/coursework/${item.courseworkId}/submissions/${item.id}/grade`,
            item.kind === "activity" ? { points: score, feedback } : { feedback, answerPoints: answerPoints ?? {} }),
        ),

      /** Saved only as a whole; the server requires the two weights to add up to 100. */
      saveGradebook: (classroomId: string, settings: GradebookSetting) =>
        run(() => send("PUT", `${classPath(classroomId)}/gradebook`, settings)),

      /** A whole month in one call. Students left out keep their saved days (D-035). */
      saveAttendance: (classroomId: string, year: number, month: number, input: AttendanceInput) =>
        run(() => send("PUT", `${classPath(classroomId)}/attendance/${year}/${month}`, input)),
    };
  }, [instructorId, refresh]);
}
