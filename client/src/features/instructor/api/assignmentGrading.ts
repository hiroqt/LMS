import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { saveBlob } from "../../../shared/api/assignments";
import { getFile, getJson, isApiError, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import { splitName, type Submission } from "../../../shared/api/overview";
import { fetchCourseworkRubric, rubricKeys, type Rubric } from "../../../shared/api/rubrics";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { attempt, type ActionResult } from "./actions";
import { extendedDue, extensionBody, studentLastDay, type ExtensionForm, type StudentException } from "./exceptions";
import { instructorKeys } from "./store";
import type { Activity } from "./types";

/*
 * One assignment's grading page (D-061, D-064; ASSIGNMENTS_API_CONTRACT §3, §4, §6, §8, §10–§13):
 * every student's latest handed-in version, the filters and their counts, "next to grade", which
 * links are safe to open, which files a browser can show, late penalties, rubric grades, a
 * student's own dates and excuse, Return, and the zip. The server decides every rule; this only
 * reads what it answers and words it.
 */

// ------------------------------------------------------------------------- types

/** `GET …/coursework/{id}/submissions`: every handed-in version, who handed in nothing, and each student's own terms. */
export interface AssignmentSubmissions {
  items: Submission[];
  missing: Array<{ studentId: string; name: string }>;
  /** Each student's own dates or excuse for this assignment (contract §11). */
  exceptions?: StudentException[];
}

/** Where a student's latest work stands. */
export type RowStatus = "needs-grading" | "graded" | "returned" | "missing";

/** One student on the class list for this assignment. */
export interface StudentRow {
  studentId: string;
  name: string;
  /** Their handed-in versions, oldest first (a "not handed in" grade is one too). */
  versions: Submission[];
  /** The version that counts; absent when they handed in nothing and have no grade. */
  latest?: Submission;
  status: RowStatus;
  /** Their own due date, last day, or excuse, when they have one. */
  exception?: StudentException;
  /** Excused: out of Needs grading, Missing, the average and the close rule (contract §11). */
  excused: boolean;
}

export const GRADING_FILTERS = ["all", "needs-grading", "late", "missing", "graded", "returned", "excused"] as const;
export type GradingFilter = (typeof GRADING_FILTERS)[number];
export const isGradingFilter = (value: unknown): value is GradingFilter => GRADING_FILTERS.includes(value as GradingFilter);

export const FILTER_LABELS: Record<GradingFilter, string> = {
  all: "All",
  "needs-grading": "Needs grading",
  late: "Late",
  missing: "Missing",
  graded: "Graded",
  returned: "Returned",
  excused: "Excused",
};

// ---------------------------------------------------------------- pure helpers

export function rowStatus(latest: Submission | undefined): RowStatus {
  if (!latest) return "missing";
  if (latest.status === "returned") return "returned";
  if (latest.status === "graded") return "graded";
  return "needs-grading";
}

const sortKey = (name: string) => {
  const { firstName, lastName } = splitName(name);
  return `${lastName.toLowerCase()}\u0000${firstName.toLowerCase()}`;
};

/** One row per student, by last name: their latest version, or nothing at all, and their own terms. */
export function studentRows(list: AssignmentSubmissions): StudentRow[] {
  const exceptions = new Map((list.exceptions ?? []).map((item) => [item.studentId, item]));
  const terms = (studentId: string) => {
    const exception = exceptions.get(studentId);
    return { ...(exception ? { exception } : {}), excused: Boolean(exception?.excused) };
  };
  const byStudent = new Map<string, Submission[]>();
  for (const item of list.items) {
    if (item.status === "in_progress" || item.status === "withdrawn") continue; // never sent to instructors; ignored if they were
    byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), item]);
  }
  const rows: StudentRow[] = [...byStudent].map(([studentId, items]) => {
    const versions = [...items].sort((a, b) => a.attemptNumber - b.attemptNumber);
    const latest = versions[versions.length - 1];
    return { studentId, name: latest?.studentName?.trim() || studentId, versions, latest, status: rowStatus(latest), ...terms(studentId) };
  });
  for (const student of list.missing)
    if (!byStudent.has(student.studentId)) rows.push({ studentId: student.studentId, name: student.name || student.studentId, versions: [], status: "missing", ...terms(student.studentId) });
  return rows.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)) || a.studentId.localeCompare(b.studentId));
}

/** Handed in nothing: no row at all, or a "not handed in" grade. */
export const handedInNothing = (row: StudentRow) => !row.latest || Boolean(row.latest.notHandedIn);

/**
 * Filters overlap: late work can also need grading, and a "not handed in" grade is also graded.
 * An excused student is never under Needs grading or Missing: there is nothing to grade.
 */
export function matchesFilter(row: StudentRow, filter: GradingFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs-grading":
      return row.status === "needs-grading" && !row.excused;
    case "late":
      return Boolean(row.latest?.late);
    case "missing":
      return handedInNothing(row) && !row.excused;
    case "graded":
      return row.status === "graded";
    case "returned":
      return row.status === "returned";
    case "excused":
      return row.excused;
  }
}

export function filterCounts(rows: StudentRow[]): Record<GradingFilter, number> {
  return Object.fromEntries(GRADING_FILTERS.map((filter) => [filter, rows.filter((row) => matchesFilter(row, filter)).length])) as Record<GradingFilter, number>;
}

/** The next student after `currentId`, in list order, whose work needs grading; wraps to the top. */
export function nextToGrade(rows: StudentRow[], currentId: string | undefined): StudentRow | undefined {
  const start = rows.findIndex((row) => row.studentId === currentId);
  const ordered = start < 0 ? rows : [...rows.slice(start + 1), ...rows.slice(0, start)];
  return ordered.find((row) => matchesFilter(row, "needs-grading") && row.studentId !== currentId);
}

/**
 * "Save and next" stays in the list the instructor chose: the next student needing a grade among
 * those the filter shows, and only when none is left there, the next one in the whole class.
 */
export function nextToGradeIn(rows: StudentRow[], filter: GradingFilter, currentId: string | undefined): StudentRow | undefined {
  const shown = rows.filter((row) => matchesFilter(row, filter) || row.studentId === currentId);
  return nextToGrade(shown, currentId) ?? nextToGrade(rows, currentId);
}

/** After a dialog whose button is gone (the work was returned, nobody is missing any more): focus goes to the student's work, or the page heading. */
export function focusStudentWork(): void {
  (document.getElementById("student-work-title") ?? document.querySelector<HTMLElement>("main h1"))?.focus();
}

/** Graded and not returned yet: what "Return all graded" returns, and the rows that can be chosen for "Return selected". */
export const returnable = (rows: StudentRow[]) => rows.filter((row) => row.status === "graded");

/** The chosen students that can still be returned, in list order (a refresh can return or ungrade one). */
export function selectedReturnable(rows: StudentRow[], selected: ReadonlySet<string>): string[] {
  return returnable(rows).filter((row) => selected.has(row.studentId)).map((row) => row.studentId);
}

/** The link as a URL to open, only when it is `http:` or `https:`; anything else is shown as text. */
export function safeLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const points = (row: StudentRow) => `${row.latest?.score ?? 0} / ${row.latest?.maxPoints ?? 0}`;

/**
 * The row's state in words, so it never depends on color: "Needs grading", "Missing", "Excused",
 * "Graded · 15 / 20", "Graded, not returned · 15 / 20", "Returned · 15 / 20". The points are
 * the score after any late penalty.
 */
export function statusLabel(row: StudentRow, gradeRelease: Activity["gradeRelease"]): string {
  if (row.excused && (row.status === "missing" || row.status === "needs-grading")) return "Excused";
  const nothing = row.latest?.notHandedIn ? "Not handed in · " : "";
  switch (row.status) {
    case "missing":
      return "Missing";
    case "needs-grading":
      return "Needs grading";
    case "graded":
      return `${nothing}${gradeRelease === "returned" ? "Graded, not returned" : "Graded"} · ${points(row)}`;
    case "returned":
      return `${nothing}Returned · ${points(row)}`;
  }
}

/**
 * Why a "not handed in" grade would be refused now, in the server's own words (D-036, contract
 * §4, §11): published work waits for the student's last day (their own when they have own dates,
 * else the "accept until" date, else the due date). Null when the server would accept it. A
 * refusal the server gives anyway is shown as well.
 */
export function notHandedInRefusal(activity: Pick<Activity, "dueAt" | "closeAt" | "closed" | "draft">, now: Date, exception?: StudentException): string | null {
  if (activity.closed) return null;
  if (activity.draft) return "Only published or closed coursework can be graded.";
  const own = extendedDue(activity, exception);
  const last = studentLastDay(activity, exception);
  if (!last || now.getTime() > new Date(last).getTime()) return null;
  if (own) return "This student has their own dates and can still hand in. Grade them after their last day passes.";
  return activity.closeAt
    ? "Students can still hand in late work until the last day. Grade those who didn't hand in after it passes."
    : "Students can still hand in until the due date. Grade those who didn't hand in after it passes.";
}

/** What the file viewer can show from a blob; Word, PowerPoint and Excel are download-only. */
export type Viewable = "image" | "pdf" | "text";

export function viewableKind(contentType: string): Viewable | null {
  if (contentType === "image/png" || contentType === "image/jpeg") return "image";
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("text/plain")) return "text";
  return null;
}

/** The only types a blob is ever shown as: never HTML, whatever the server sent. */
export const blobTypeFor = (contentType: string, kind: Viewable) => (kind === "pdf" ? "application/pdf" : kind === "image" ? (contentType === "image/png" ? "image/png" : "image/jpeg") : "text/plain");

export const studentsLabel = (count: number) => `${count} ${count === 1 ? "student" : "students"}`;

// ------------------------------------------------------------- late penalty (§10)

export const daysLateLabel = (days: number) => `${days} ${days === 1 ? "day" : "days"} late`;

/**
 * The percent a late penalty takes off, as the server works it out: per day late, up to the cap;
 * 0 when waived, on time, or the assignment has no penalty. Used to preview a grade being typed
 * and to word a waived one (the server answers 0 for both).
 */
export function penaltyPercentFor(activity: Pick<Activity, "latePenaltyPercentPerDay" | "latePenaltyMaxPercent">, daysLate: number, waived = false): number {
  const perDay = activity.latePenaltyPercentPerDay ?? 0;
  if (waived || daysLate <= 0 || perDay <= 0) return 0;
  return Math.min(perDay * daysLate, Math.min(100, Math.max(1, activity.latePenaltyMaxPercent ?? 100)));
}

/**
 * The points left after a penalty, rounded to two decimals half away from zero, exactly as the
 * server does with decimals: worked out in whole ten-thousandths, because 7.5 × 0.63 in floating
 * point is 4.7249…, which would show 4.72 where the server stores 4.73.
 */
export function afterPenalty(raw: number, percent: number): number {
  const tenThousandths = Math.round(Math.abs(raw) * 100) * Math.round((100 - percent) * 100);
  const cents = Math.floor((tenThousandths + 5000) / 10000);
  return (Math.sign(raw) * cents) / 100;
}

/** Whether this assignment takes points off late work. */
export const hasLatePenalty = (activity: Pick<Activity, "latePenaltyPercentPerDay">) => (activity.latePenaltyPercentPerDay ?? 0) > 0;

/**
 * The sum in words and numbers for late work on an assignment with a penalty:
 * "18 − 20% (2 days late) = 14.4 of 20", or "18 of 20: late penalty waived (2 days late)".
 * Null when the work is on time or the assignment has no penalty.
 */
export function penaltySum(
  activity: Pick<Activity, "latePenaltyPercentPerDay" | "latePenaltyMaxPercent" | "maxScore">,
  grade: { raw: number; daysLate: number; waived: boolean },
): string | null {
  if (grade.daysLate <= 0 || !hasLatePenalty(activity)) return null;
  const late = daysLateLabel(grade.daysLate);
  if (grade.waived) return `${grade.raw} of ${activity.maxScore}: late penalty waived (${late})`;
  const percent = penaltyPercentFor(activity, grade.daysLate);
  return `${grade.raw} − ${percent}% (${late}) = ${afterPenalty(grade.raw, percent)} of ${activity.maxScore}`;
}

// ------------------------------------------------------------------ rubric (§12)

/** A message under each criterion with no level chosen, by criterion id; empty when every one has a level. */
export function rubricProblems(rubric: Pick<Rubric, "criteria">, chosen: Record<number, number>): Record<number, string> {
  const problems: Record<number, string> = {};
  for (const criterion of rubric.criteria)
    if (!criterion.levels.some((level) => level.id === chosen[criterion.id])) problems[criterion.id] = `Choose a level for ${criterion.title}.`;
  return problems;
}

/** The server's `rubric[<criterionId>]` field errors, by criterion id. */
export function rubricErrorsFrom(fieldErrors: Record<string, string[]> | undefined): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    const match = /^rubric\[(\d+)\]$/i.exec(key);
    if (match && messages[0]) errors[Number(match[1])] = messages[0];
  }
  return errors;
}

// --------------------------------------------------------------- writes, worded

/**
 * Runs a write and words the answer. A refusal (403, 404, 409) shows the server's own sentence,
 * its `title`; a 400 keeps the field errors, and its message is the first one when there is
 * only one. Everything else is worded as `attempt` does.
 */
export async function writeResult(write: () => Promise<unknown>): Promise<ActionResult> {
  let refusal: string | undefined;
  const result = await attempt(async () => {
    try {
      await write();
    } catch (error) {
      if (isApiError(error) && (error.status === 403 || error.status === 404 || error.status === 409) && error.title) refusal = error.title;
      throw error;
    }
  });
  if (result.ok) return result;
  if (refusal) return { ...result, message: refusal };
  const messages = Object.values(result.fieldErrors ?? {}).flat();
  return messages.length === 1 ? { ...result, message: messages[0] } : result;
}

/** "Give N to everyone who didn't hand in", answered: how many were graded, and how many still have time. */
export function gradedMissingSentence(graded: number, waiting: number, points: string): string {
  const given = graded ? `${points} for ${studentsLabel(graded)} who didn't hand in.` : "Nobody was graded.";
  const later = waiting ? ` ${studentsLabel(waiting)} skipped: their own last day has not passed.` : "";
  return `${given}${later}`;
}

// ------------------------------------------------------------------ queries

const queryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;
const workPath = (classId: string, id: string) => `/api/classes/${encodeURIComponent(classId)}/coursework/${encodeURIComponent(id)}`;

export const assignmentGradingKeys = {
  all: ["instructor", "assignment-grading"] as const,
  instructor: (instructorId: string) => [...assignmentGradingKeys.all, instructorId] as const,
  submissions: (instructorId: string, classId: string, id: string) => [...assignmentGradingKeys.instructor(instructorId), classId, id, "submissions"] as const,
};

function useViewer(): Viewer {
  const { instructorId } = useInstructorSession();
  return useMemo(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
}

/** Every handed-in version of one assignment, the students with nothing handed in, and their own terms. */
export function useAssignmentSubmissions(classId: string, id: string) {
  const viewer = useViewer();
  return useQuery({
    queryKey: assignmentGradingKeys.submissions(viewer.id, classId, id),
    queryFn: ({ signal }) => getJson<AssignmentSubmissions>(`${workPath(classId, id)}/submissions`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id && classId && id),
  });
}

/** The assignment's rubric, when it has one (`rubricId`). */
export function useAssignmentRubric(classId: string, id: string, rubricId: number | undefined) {
  const viewer = useViewer();
  return useQuery({
    queryKey: [...rubricKeys.ofCoursework(viewer.id, classId, id), rubricId ?? 0],
    queryFn: ({ signal }) => fetchCourseworkRubric(viewer, classId, id, signal),
    ...queryOptions,
    enabled: Boolean(viewer.id && classId && id && rubricId),
  });
}

/** Refreshes the class list on this page and the overview every other screen reads. */
export function useRefreshAssignmentGrading(): () => Promise<void> {
  const queryClient = useQueryClient();
  const { instructorId } = useInstructorSession();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: assignmentGradingKeys.instructor(instructorId) }),
      queryClient.invalidateQueries({ queryKey: instructorKeys.overview(instructorId) }),
    ]);
  }, [queryClient, instructorId]);
}

/** What `PUT …/grade` takes for an assignment: raw points or rubric levels, feedback, and the waiver (contract §10, §12). */
export interface GradeInput {
  points?: number;
  rubric?: Record<number, number>;
  feedback: string;
  /** Sent only for late work on an assignment with a penalty; otherwise the server keeps what it has. */
  waivePenalty?: boolean;
}

/** Grades one handed-in version; answers the saved submission (its `score` is after the penalty). */
export function useGradeWork(classId: string, id: string) {
  const viewer = useViewer();
  const refresh = useRefreshAssignmentGrading();
  return useCallback(
    async (submissionId: number, input: GradeInput): Promise<ActionResult & { saved?: Submission }> => {
      let saved: Submission | undefined;
      const body = {
        feedback: input.feedback,
        ...(input.rubric ? { rubric: input.rubric } : { points: input.points }),
        ...(input.waivePenalty === undefined ? {} : { waivePenalty: input.waivePenalty }),
      };
      const result = await writeResult(async () => {
        saved = await sendJson<Submission>("PUT", `${workPath(classId, id)}/submissions/${submissionId}/grade`, body, { viewer });
      });
      await refresh();
      return { ...result, ...(saved ? { saved } : {}) };
    },
    [classId, id, viewer, refresh],
  );
}

/** "Give N to everyone who didn't hand in" (D-036): `waiting` is how many still have their own time (contract §11). */
export function useGradeEveryoneMissing(classId: string, id: string) {
  const viewer = useViewer();
  const refresh = useRefreshAssignmentGrading();
  return useCallback(
    async (value: number): Promise<ActionResult & { graded: number; waiting: number }> => {
      let answer = { graded: 0, waiting: 0 };
      const result = await writeResult(async () => {
        const body = await sendJson<{ graded: number; waiting?: number }>("POST", `${workPath(classId, id)}/grade-missing`, { points: value }, { viewer });
        answer = { graded: body.graded, waiting: body.waiting ?? 0 };
      });
      await refresh();
      return { ...result, ...answer };
    },
    [classId, id, viewer, refresh],
  );
}

/** Sets or removes a student's own dates and excuse (contract §11); refreshes the class list and the overview after each. */
export function useStudentExceptions(classId: string, id: string) {
  const viewer = useViewer();
  const refresh = useRefreshAssignmentGrading();
  const change = useCallback(
    async (method: "PUT" | "DELETE", studentId: string, what: "extension" | "excuse", body?: unknown): Promise<ActionResult> => {
      const result = await writeResult(() => sendJson(method, `${workPath(classId, id)}/students/${encodeURIComponent(studentId)}/${what}`, body, { viewer }));
      await refresh();
      return result;
    },
    [classId, id, viewer, refresh],
  );
  return useMemo(
    () => ({
      extend: (studentId: string, form: ExtensionForm) => change("PUT", studentId, "extension", extensionBody(form)),
      removeExtension: (studentId: string) => change("DELETE", studentId, "extension"),
      excuse: (studentId: string) => change("PUT", studentId, "excuse", {}),
      removeExcuse: (studentId: string) => change("DELETE", studentId, "excuse"),
    }),
    [change],
  );
}

/**
 * Returns graded work (contract §3): to the students named, or to every student whose latest
 * work is graded. Work that isn't graded is skipped; `returned` is how many were.
 */
export function useReturnGrades(classId: string, id: string) {
  const viewer = useViewer();
  const refresh = useRefreshAssignmentGrading();
  return useCallback(
    async (studentIds?: string[]): Promise<ActionResult & { returned: number }> => {
      let returned = 0;
      const result = await writeResult(async () => {
        returned = (await sendJson<{ returned: number }>("POST", `${workPath(classId, id)}/return`, studentIds ? { studentIds } : {}, { viewer })).returned;
      });
      await refresh();
      return { ...result, returned };
    },
    [classId, id, viewer, refresh],
  );
}

/** The zip's name when the server sends none: the title, safe as a file name. */
export const zipName = (title: string) => `${title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "assignment"}-work.zip`;

/**
 * Downloads every student's latest work as one zip (contract §13), with the instructor's headers
 * (a file can't be an `href`, L-075), and saves it. A 409 (over 250 MB) answers the server's sentence.
 */
export function useDownloadAllWork(classId: string, id: string, title: string) {
  const viewer = useViewer();
  return useCallback(async (): Promise<ActionResult & { fileName?: string }> => {
    let fileName: string | undefined;
    const result = await writeResult(async () => {
      const file = await getFile(`${workPath(classId, id)}/submissions.zip`, { viewer });
      fileName = file.fileName ?? zipName(title);
      saveBlob(file.blob, fileName);
    });
    return { ...result, ...(fileName ? { fileName } : {}) };
  }, [classId, id, title, viewer]);
}
