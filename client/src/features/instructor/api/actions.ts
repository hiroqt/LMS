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

export type ContentKind = "material" | "activity" | "exam";

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

export interface AttendanceInput {
  schoolDays: number;
  entries: Array<{ studentId: string; daysPresent: number }>;
}

export interface UngradedStudent {
  studentId: string;
  name: string;
}

export interface CloseResult extends ActionResult {
  /** When closing was refused: the students still without a grade. */
  ungraded: UngradedStudent[];
}

/** Reads the `ungraded` member of the close action's 409 problem. */
export function ungradedFrom(problem: Record<string, unknown>): UngradedStudent[] {
  const list = problem.ungraded;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const { studentId, name } = item as Record<string, unknown>;
    return typeof studentId === "string" ? [{ studentId, name: typeof name === "string" && name ? name : studentId }] : [];
  });
}

const classPath = (classroomId: string) => `/api/classes/${encodeURIComponent(classroomId)}`;
/** A datetime-local value ("2026-11-30T15:00") as an instant; empty stays empty. */
export const instant = (value: string) => (value ? new Date(value).toISOString() : undefined);

export async function attempt(change: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await change();
    return { ok: true };
  } catch (error) {
    const { title, detail } = describeApiError(error);
    // Validation problems are 400s today; the assessments contract answers 422.
    const invalid = isApiError(error) && (error.status === 400 || error.status === 422);
    // A refusal is the server's own sentence, with nothing to add ("Request to … failed with status 409" explains nothing to an instructor).
    const refusal = isApiError(error) && error.kind === "http" && error.title && !error.detail ? error.title : undefined;
    return { ok: false, message: invalid ? "Check the highlighted fields." : (refusal ?? `${title}${/[.!?]$/.test(title) ? "" : "."} ${detail}`), fieldErrors: isApiError(error) ? error.fieldErrors : undefined };
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

      /** A submodule sits one level under a module; the server refuses deeper nesting. */
      createSubmodule: (classroomId: string, parentId: string, title: string) =>
        run(() => send("POST", `${classPath(classroomId)}/modules`, { title, parentModuleId: Number(parentId) })),

      renameModule: (classroomId: string, moduleId: string, title: string) =>
        run(() => send("PATCH", `${classPath(classroomId)}/modules/${moduleId}`, { title })),

      /** One PATCH per changed sort order (see reorderSiblings). Refreshes even after a partial failure. */
      reorderModules: async (classroomId: string, changes: Array<{ id: string; order: number }>) => {
        const result = await attempt(async () => {
          for (const change of changes) await send("PATCH", `${classPath(classroomId)}/modules/${change.id}`, { sortOrder: change.order });
        });
        await refresh();
        return result;
      },

      /** Moves a material, assignment, or assessment to another module or submodule of the class. */
      moveContent: (classroomId: string, item: { kind: ContentKind; id: string }, moduleId: string) =>
        run(() => send("PATCH", `${classPath(classroomId)}/${item.kind === "material" ? "materials" : "coursework"}/${item.id}`, { moduleId: Number(moduleId) })),

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

      /** Refused (409) until every student is graded; the refusal names who is left (D-036). */
      closeCoursework: async (classroomId: string, courseworkId: string): Promise<CloseResult> => {
        let ungraded: UngradedStudent[] = [];
        const result = await run(async () => {
          try {
            await send("POST", `${classPath(classroomId)}/coursework/${courseworkId}/close`);
          } catch (error) {
            if (isApiError(error) && error.status === 409) ungraded = ungradedFrom(error.problem);
            throw error;
          }
        });
        return { ...result, ungraded };
      },

      reopenCoursework: (classroomId: string, courseworkId: string) =>
        run(() => send("POST", `${classPath(classroomId)}/coursework/${courseworkId}/reopen`)),

      /** A grade for a student who handed in nothing; corrects it when one is already there. */
      gradeNotHandedIn: (classroomId: string, courseworkId: string, studentId: string, points: number) =>
        run(() => send("PUT", `${classPath(classroomId)}/coursework/${courseworkId}/students/${encodeURIComponent(studentId)}/grade`, { points })),

      /** "Give N to everyone who didn't hand in": never touches handed-in or started work. */
      gradeEveryoneNotHandedIn: async (classroomId: string, courseworkId: string, points: number): Promise<ActionResult & { graded: number; waiting: number }> => {
        let graded = 0;
        // Students skipped because their own last day has not passed (contract §11).
        let waiting = 0;
        const result = await run(async () => {
          const answer = await send<{ graded: number; waiting?: number }>("POST", `${classPath(classroomId)}/coursework/${courseworkId}/grade-missing`, { points });
          graded = answer.graded;
          waiting = answer.waiting ?? 0;
        });
        return { ...result, graded, waiting };
      },

      /** Saved only as a whole; the server requires the two weights to add up to 100. */
      saveGradebook: (classroomId: string, settings: GradebookSetting) =>
        run(() => send("PUT", `${classPath(classroomId)}/gradebook`, settings)),

      /** A whole month in one call. Students left out keep their saved days (D-035). */
      saveAttendance: (classroomId: string, year: number, month: number, input: AttendanceInput) =>
        run(() => send("PUT", `${classPath(classroomId)}/attendance/${year}/${month}`, input)),
    };
  }, [instructorId, refresh]);
}
