import { formatDue } from "../../../shared/lib/format";
import { instant } from "./actions";
import type { Activity } from "./types";

/*
 * One student's own terms for one assignment (D-062, ASSIGNMENTS_API_CONTRACT §11): a later due
 * date and last day for late work, or being excused. The server decides what they change (late,
 * the penalty, the turn-in verdict, "not handed in" grades); this only words them and sends them.
 */

/** `ExceptionDto`: what `GET …/submissions` answers in `exceptions`, and the PUT routes answer. */
export interface StudentException {
  studentId: string;
  /** Their own due date; it applies only while it is after the assignment's. */
  dueAt: string | null;
  /** Their own last day for late work, when the assignment has one. */
  closeAt: string | null;
  excused: boolean;
}

type Dates = Pick<Activity, "dueAt" | "closeAt">;

const time = (value: string | null | undefined) => (value ? new Date(value).getTime() : Number.NaN);
const later = (a: string, b: string) => (time(a) >= time(b) ? a : b);

/**
 * The student's own due date while it gives them more time; null otherwise. Mirrors the server:
 * an own date that the assignment's due date has since moved past no longer applies.
 */
export function extendedDue(activity: Dates, exception: StudentException | undefined): string | null {
  const own = exception?.dueAt;
  if (!own || !activity.dueAt) return null;
  return time(own) > time(activity.dueAt) ? own : null;
}

/**
 * The student's last day for late work: the latest of their own last day, the assignment's last
 * day, and their own due date. When the assignment has no last day, neither has the student, and
 * their due date is when they stop handing in. Without own dates, the assignment's.
 */
export function studentLastDay(activity: Dates, exception: StudentException | undefined): string | null {
  const own = extendedDue(activity, exception);
  if (!own) return activity.closeAt ?? activity.dueAt ?? null;
  if (!activity.closeAt) return own;
  return later(later(exception?.closeAt ?? own, activity.closeAt), own);
}

/** "Own due date: Oct 30, 9:00 AM" (and their last day), for the list and the student's work; null without own dates. */
export function ownDatesLabel(activity: Dates, exception: StudentException | undefined): string | null {
  const own = extendedDue(activity, exception);
  if (!own) return null;
  const last = activity.closeAt ? studentLastDay(activity, exception) : null;
  return `Own due date: ${formatDue(own)}${last && last !== own ? ` · Own last day: ${formatDue(last)}` : ""}`;
}

export interface ExtensionForm {
  /** datetime-local values; "" for none. */
  dueAt: string;
  closeAt: string;
}

/**
 * What is wrong with an extension before it is sent, by field, in the server's words. The
 * server checks again; its field errors land on the same fields.
 */
export function extensionProblems(form: ExtensionForm, activity: Dates & Pick<Activity, "allowLate">): Partial<Record<keyof ExtensionForm, string>> {
  const problems: Partial<Record<keyof ExtensionForm, string>> = {};
  const due = form.dueAt ? new Date(form.dueAt).getTime() : Number.NaN;
  if (!form.dueAt || Number.isNaN(due)) problems.dueAt = "Choose this student's due date.";
  else if (activity.dueAt && due <= time(activity.dueAt)) problems.dueAt = "A student's own due date must be after the assignment's due date.";
  if (form.closeAt) {
    const close = new Date(form.closeAt).getTime();
    if (!activity.allowLate || !activity.closeAt) problems.closeAt = "This assignment has no last day for late work, so this student needs none either.";
    else if (!Number.isNaN(due) && close <= due) problems.closeAt = "The last day for late work must be after this student's due date.";
  }
  return problems;
}

/** The body of `PUT …/extension`: instants, and no `closeAt` when none was chosen. */
export const extensionBody = (form: ExtensionForm) => ({ dueAt: instant(form.dueAt), ...(form.closeAt ? { closeAt: instant(form.closeAt) } : {}) });

/** An instant as a datetime-local value in the browser's time zone; null stays "". */
export function localInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The dialog's first values: their own dates when they have them, else the assignment's due date plus a day. */
export function extensionStart(activity: Dates, exception: StudentException | undefined): ExtensionForm {
  const own = extendedDue(activity, exception);
  if (own) return { dueAt: localInput(own), closeAt: activity.closeAt ? localInput(exception?.closeAt ?? null) : "" };
  const due = activity.dueAt ? new Date(time(activity.dueAt) + 24 * 60 * 60 * 1000).toISOString() : null;
  return { dueAt: localInput(due), closeAt: "" };
}
