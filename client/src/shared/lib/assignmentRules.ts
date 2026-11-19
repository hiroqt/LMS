import { fileTypeList, MAX_FILE_BYTES, formatBytes } from "../api/assignments";
import type { Coursework } from "../api/overview";
import { formatDue } from "./format";

/** The settings that decide how an assignment is handed in and graded (contract §1, §5). */
export type HandInSettings = Pick<Coursework, "submissionKinds" | "allowedFileTypes" | "maxFiles" | "honorStatement" | "dueAt" | "allowLate" | "closeAt" | "allowResubmission" | "gradeRelease" | "latePenaltyPercentPerDay" | "latePenaltyMaxPercent">;

/** "Late work loses 10% of its score for each day late, up to 50%." Null when the assignment has no penalty. */
export function latePenaltyRule(settings: Pick<HandInSettings, "dueAt" | "allowLate" | "latePenaltyPercentPerDay" | "latePenaltyMaxPercent">): string | null {
  if (!settings.dueAt || !settings.allowLate || settings.latePenaltyPercentPerDay <= 0) return null;
  const cap = settings.latePenaltyMaxPercent < 100 && settings.latePenaltyMaxPercent > settings.latePenaltyPercentPerDay ? `, up to ${settings.latePenaltyMaxPercent}%` : "";
  return `Late work loses ${settings.latePenaltyPercentPerDay}% of its score for each day late${cap}.`;
}

/** "a written answer, a link, and up to 3 files" */
function whatToHandIn(settings: HandInSettings): string {
  const parts = [
    settings.submissionKinds.includes("text") ? "a written answer" : "",
    settings.submissionKinds.includes("link") ? "a link" : "",
    settings.submissionKinds.includes("file") ? (settings.maxFiles === 1 ? "1 file" : `up to ${settings.maxFiles} files`) : "",
  ].filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "nothing";
  return `${parts.slice(0, -1).join(", ")}${parts.length > 2 ? "," : ""} and ${parts[parts.length - 1]}`;
}

/**
 * An assignment's rules as a student reads them, one sentence each. The assignment builder's
 * summary and the student's assignment page both show these, so an instructor sees exactly what
 * students will be told. The server enforces the rules; this only words them.
 */
export function handInRules(settings: HandInSettings): string[] {
  const rules = [`You can hand in ${whatToHandIn(settings)}.`];
  if (settings.submissionKinds.includes("file"))
    rules.push(`Files: ${fileTypeList(settings.allowedFileTypes)}, up to ${formatBytes(MAX_FILE_BYTES)} each.`);
  if (!settings.dueAt) rules.push("There is no due date.");
  else {
    rules.push(`Due ${formatDue(settings.dueAt)}.`);
    if (!settings.allowLate) rules.push("Late work is not accepted.");
    else if (settings.closeAt) rules.push(`Late work is accepted until ${formatDue(settings.closeAt)} and is marked late.`);
    else rules.push("Late work is accepted and is marked late.");
    const penalty = latePenaltyRule(settings);
    if (penalty) rules.push(penalty);
  }
  if (!settings.allowResubmission) rules.push("You can turn in once, so check your work first.");
  else if (settings.dueAt) rules.push("You can take your work back before the due date, and turn in a new version.");
  else rules.push("You can take your work back and turn in a new version.");
  rules.push(settings.gradeRelease === "returned" ? "You see your grade when your instructor returns your work." : "You see your grade as soon as your instructor saves it.");
  if (settings.honorStatement) rules.push("You confirm that the work is your own when you turn it in.");
  return rules;
}
