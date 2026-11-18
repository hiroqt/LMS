import type { AssessmentSettings, SettingsErrors } from "../../api/assessments";
import type { BuilderTab } from "../../paths";

export const BUILDER_TAB_LABELS: Record<BuilderTab, string> = { details: "Details", questions: "Questions", settings: "Settings" };

type ErrorField = Exclude<keyof SettingsErrors, "publish">;

/** The tab that holds each field, so an error on a hidden tab can open it (D-056). */
const FIELD_TABS: Record<ErrorField, BuilderTab> = {
  title: "details",
  moduleId: "details",
  category: "details",
  instructions: "details",
  questions: "questions",
  availableFrom: "settings",
  dueAt: "settings",
  attempts: "settings",
  timeLimit: "settings",
  answerReview: "settings",
  spellingMode: "settings",
  shuffleQuestions: "settings",
  shuffleChoices: "settings",
};

export const tabOfField = (field: ErrorField): BuilderTab => FIELD_TABS[field];

/** The fields with an error, in the order they appear on the page. */
export function errorFields(errors: SettingsErrors): ErrorField[] {
  return (Object.keys(FIELD_TABS) as ErrorField[]).filter((field) => errors[field]);
}

/** How many fields on a tab have an error. */
export function errorCount(errors: SettingsErrors, tab: BuilderTab): number {
  return errorFields(errors).filter((field) => FIELD_TABS[field] === tab).length;
}

/** A new assessment starts with its details; a draft opens where work usually continues. */
export const defaultTab = (editing: boolean): BuilderTab => (editing ? "questions" : "details");

/** "Due Nov 20, 4:00 PM · 1 attempt · 30 min": the settings at a glance, for the Summary. */
export function settingsGlance(settings: Pick<AssessmentSettings, "dueAt" | "attempts" | "timeLimit">): string {
  const due = settings.dueAt ? new Date(settings.dueAt) : null;
  const dueText =
    due && !Number.isNaN(due.getTime())
      ? `Due ${due.toLocaleDateString([], { month: "short", day: "numeric" })}, ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "No due date";
  const attempts = Number(settings.attempts);
  const attemptsText = Number.isInteger(attempts) && attempts > 0 ? `${attempts} ${attempts === 1 ? "attempt" : "attempts"}` : "Attempts not set";
  const minutes = Number(settings.timeLimit || "0");
  const limitText = Number.isInteger(minutes) && minutes > 0 ? `${minutes} min` : "No time limit";
  return `${dueText} · ${attemptsText} · ${limitText}`;
}
