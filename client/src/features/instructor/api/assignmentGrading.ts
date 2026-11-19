import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { getJson, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import { splitName, type Submission } from "../../../shared/api/overview";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { attempt, type ActionResult } from "./actions";
import { instructorKeys } from "./store";
import type { Activity } from "./types";

/*
 * One assignment's grading page (D-061; ASSIGNMENTS_API_CONTRACT §3, §4, §6, §8): every
 * student's latest handed-in version, the filters and their counts, "next to grade", which
 * links are safe to open, which files a browser can show, and Return. The server decides
 * every rule; this only reads what it answers and words it.
 */

// ------------------------------------------------------------------------- types

/** `GET …/coursework/{id}/submissions`: every handed-in version, and who handed in nothing. */
export interface AssignmentSubmissions {
  items: Submission[];
  missing: Array<{ studentId: string; name: string }>;
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
}

export const GRADING_FILTERS = ["all", "needs-grading", "late", "missing", "graded", "returned"] as const;
export type GradingFilter = (typeof GRADING_FILTERS)[number];
export const isGradingFilter = (value: unknown): value is GradingFilter => GRADING_FILTERS.includes(value as GradingFilter);

export const FILTER_LABELS: Record<GradingFilter, string> = {
  all: "All",
  "needs-grading": "Needs grading",
  late: "Late",
  missing: "Missing",
  graded: "Graded",
  returned: "Returned",
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

/** One row per student, by last name: their latest version, or nothing at all. */
export function studentRows(list: AssignmentSubmissions): StudentRow[] {
  const byStudent = new Map<string, Submission[]>();
  for (const item of list.items) {
    if (item.status === "in_progress" || item.status === "withdrawn") continue; // never sent to instructors; ignored if they were
    byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), item]);
  }
  const rows: StudentRow[] = [...byStudent].map(([studentId, items]) => {
    const versions = [...items].sort((a, b) => a.attemptNumber - b.attemptNumber);
    const latest = versions[versions.length - 1];
    return { studentId, name: latest?.studentName?.trim() || studentId, versions, latest, status: rowStatus(latest) };
  });
  for (const student of list.missing)
    if (!byStudent.has(student.studentId)) rows.push({ studentId: student.studentId, name: student.name || student.studentId, versions: [], status: "missing" });
  return rows.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)) || a.studentId.localeCompare(b.studentId));
}

/** Handed in nothing: no row at all, or a "not handed in" grade. */
export const handedInNothing = (row: StudentRow) => !row.latest || Boolean(row.latest.notHandedIn);

/** Filters overlap: late work can also need grading, and a "not handed in" grade is also graded. */
export function matchesFilter(row: StudentRow, filter: GradingFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs-grading":
      return row.status === "needs-grading";
    case "late":
      return Boolean(row.latest?.late);
    case "missing":
      return handedInNothing(row);
    case "graded":
      return row.status === "graded";
    case "returned":
      return row.status === "returned";
  }
}

export function filterCounts(rows: StudentRow[]): Record<GradingFilter, number> {
  return Object.fromEntries(GRADING_FILTERS.map((filter) => [filter, rows.filter((row) => matchesFilter(row, filter)).length])) as Record<GradingFilter, number>;
}

/** The next student after `currentId`, in list order, whose work needs grading; wraps to the top. */
export function nextToGrade(rows: StudentRow[], currentId: string | undefined): StudentRow | undefined {
  const start = rows.findIndex((row) => row.studentId === currentId);
  const ordered = start < 0 ? rows : [...rows.slice(start + 1), ...rows.slice(0, start)];
  return ordered.find((row) => row.status === "needs-grading" && row.studentId !== currentId);
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

/** Graded and not returned yet: what "Return all graded" returns. */
export const returnable = (rows: StudentRow[]) => rows.filter((row) => row.status === "graded");

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
 * The row's state in words, so it never depends on color: "Needs grading", "Missing",
 * "Graded · 15 / 20", "Graded, not returned · 15 / 20", "Returned · 15 / 20".
 */
export function statusLabel(row: StudentRow, gradeRelease: Activity["gradeRelease"]): string {
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
 * §4): published work waits for its last day (the "accept until" date, else the due date).
 * Null when the server would accept it. A refusal the server gives anyway is shown as well.
 */
export function notHandedInRefusal(activity: Pick<Activity, "dueAt" | "closeAt" | "closed" | "draft">, now: Date): string | null {
  if (activity.closed) return null;
  if (activity.draft) return "Only published or closed coursework can be graded.";
  const last = activity.closeAt ?? activity.dueAt;
  if (!last || now.getTime() > new Date(last).getTime()) return null;
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

/** Every handed-in version of one assignment, and the students with nothing handed in. */
export function useAssignmentSubmissions(classId: string, id: string) {
  const viewer = useViewer();
  return useQuery({
    queryKey: assignmentGradingKeys.submissions(viewer.id, classId, id),
    queryFn: ({ signal }) => getJson<AssignmentSubmissions>(`${workPath(classId, id)}/submissions`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id && classId && id),
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
      const result = await attempt(async () => {
        returned = (await sendJson<{ returned: number }>("POST", `${workPath(classId, id)}/return`, studentIds ? { studentIds } : {}, { viewer })).returned;
      });
      await refresh();
      return { ...result, returned };
    },
    [classId, id, viewer, refresh],
  );
}
