import { isApiError } from "../../../shared/api/http";
import { isHandedIn, type Submission, type SubmissionKind, type TurnIn } from "../../../shared/api/overview";

/**
 * The student's work on one assignment, in words (contract §2, §6, §7). The server decides every
 * rule and sends its verdict as `turnIn`; this only names it and sorts the student's rows.
 */

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

/** The state in plain words, with the badge tone that goes with it. */
export const WORK_STATES: Record<TurnIn["state"], { label: string; tone: BadgeTone }> = {
  assigned: { label: "Assigned", tone: "brand" },
  draft: { label: "Draft", tone: "info" },
  turned_in: { label: "Turned in", tone: "success" },
  missing: { label: "Missing", tone: "danger" },
  graded: { label: "Graded", tone: "success" },
  returned: { label: "Returned", tone: "success" },
  not_handed_in: { label: "Not handed in", tone: "danger" },
  excused: { label: "Excused", tone: "neutral" },
};

/** Badges for the work card: the state, and "Late" when the work turned in was late. */
export function workBadges(turnIn: TurnIn, current: Submission | undefined): Array<{ label: string; tone: BadgeTone }> {
  const badges = [WORK_STATES[turnIn.state]];
  if (current?.late && current.submittedAt) badges.push({ label: "Late", tone: "warning" });
  return badges;
}

/** Why nothing can be handed in now. Past due and past the last day keep the page's earlier wording. */
export const REFUSALS: Record<NonNullable<TurnIn["reason"]>, string> = {
  closed: "This assignment is closed. Your instructor is no longer accepting work.",
  excused: "Your instructor excused you from this assignment. There is nothing to hand in, and it does not count toward your grade.",
  not_handed_in: "Your instructor recorded a grade without a submission, so nothing more can be handed in.",
  already_turned_in: "You have turned this in. This assignment takes one turn-in only.",
  past_due: "The due date has passed and late submissions are turned off.",
  past_close: "The last day for late work has passed.",
};

export interface WorkRows {
  /** The draft, `in_progress`: what the student is working on. */
  draft: Submission | undefined;
  /** The latest handed-in version, which the instructor sees; never a "not handed in" grade. */
  current: Submission | undefined;
  /** Every other version, turned in or taken back, newest first. */
  earlier: Submission[];
}

/** Sorts the rows of `my-submissions` into the draft, the current version, and earlier ones. */
export function splitWork(rows: Submission[]): WorkRows {
  const sorted = [...rows].sort((a, b) => b.attemptNumber - a.attemptNumber);
  const draft = sorted.find((row) => row.status === "in_progress");
  const current = sorted.find((row) => isHandedIn(row.status) && !row.notHandedIn);
  const earlier = sorted.filter((row) => row !== draft && row !== current && !row.notHandedIn && row.submittedAt);
  return { draft, current, earlier };
}

/** Replaces (or adds) one row after a write answered it, keeping the list in version order. */
export function withRow(rows: Submission[] | undefined, row: Submission): Submission[] {
  const others = (rows ?? []).filter((item) => item.id !== row.id);
  return [...others, row].sort((a, b) => a.attemptNumber - b.attemptNumber);
}

/** After a take-back: the version is withdrawn and the draft that replaces it is answered. */
export function afterUnsubmit(rows: Submission[] | undefined, draft: Submission): Submission[] {
  const latest = splitWork(rows ?? []).current;
  const updated = (rows ?? []).map((row) => (row.id === latest?.id ? { ...row, status: "withdrawn" as const } : row));
  return withRow(updated, draft);
}

export interface ConfirmItem {
  label: string;
  value: string;
}

/** Exactly what the turn-in hands in, as the confirmation lists it: one line per kind the assignment takes. */
export function turnInContents(draft: Pick<Submission, "text" | "link" | "files" | "fileName"> | undefined, kinds: SubmissionKind[]): ConfirmItem[] {
  const items: ConfirmItem[] = [];
  if (kinds.includes("text")) items.push({ label: "Written answer", value: draft?.text?.trim() ? "Yes" : "No" });
  if (kinds.includes("link")) items.push({ label: "Link", value: draft?.link || "None" });
  if (kinds.includes("file")) {
    const files = draft?.files ?? [];
    if (files.length === 0) items.push({ label: "Files", value: "None" });
    files.forEach((file, index) => items.push({ label: `File ${index + 1}`, value: file.name }));
  }
  return items;
}

/** Whether there is anything to turn in: the server refuses an empty draft. */
export const hasWork = (draft: Pick<Submission, "text" | "link" | "files"> | undefined) =>
  Boolean(draft && (draft.text?.trim() || draft.link || draft.files.length));

/** "2 more files", "1 more file", "No more files" */
export function filesLeftLabel(maxFiles: number, used: number): string {
  const left = Math.max(0, maxFiles - used);
  if (left === 0) return `No more files. This assignment takes at most ${maxFiles} ${maxFiles === 1 ? "file" : "files"}.`;
  return `You can add ${left} more ${left === 1 ? "file" : "files"}.`;
}

/** A link worth saving: an absolute http or https address (the server checks it again). */
export function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Whether trying again could help: the connection, a busy server, or the upload limit, not a refusal of the work itself. */
export const canRetry = (error: unknown) =>
  !isApiError(error) || error.kind === "network" || error.kind === "timeout" || error.status === 409 || error.status === 429 || error.status >= 500;

/** Whether an autosave should keep trying by itself: only the connection or a server error. */
export const shouldRetrySave = (error: unknown) =>
  !isApiError(error) || error.kind === "network" || error.kind === "timeout" || error.status >= 500;
