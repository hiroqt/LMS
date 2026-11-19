import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { FILE_TYPE_KEYS, MAX_FILES } from "../../../shared/api/assignments";
import { getJson, isApiError, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Coursework, FileTypeKey, SubmissionKind } from "../../../shared/api/overview";
import type { HandInSettings } from "../../../shared/lib/assignmentRules";
import type { AssignmentTab } from "../paths";
import { attempt, instant } from "./actions";
import { toLocalInput } from "./assessments";
import { useInstructorViewer } from "./questionSets";
import { useRefreshOverview } from "./store";
import type { Activity } from "./types";

/*
 * The assignment builder's form, presets, checks, and save (D-058, D-059; contract §1, §5).
 * The server enforces every rule; the checks here only show a problem before sending.
 * Everything here is pure except the two hooks at the end.
 */

export type GradeRelease = "immediate" | "returned";

/** The builder's fields; points and dates stay text (datetime-local, "" for none) until saved. */
export interface AssignmentForm {
  title: string;
  moduleId: string;
  description: string;
  instructions: string;
  points: string;
  submissionKinds: SubmissionKind[];
  allowedFileTypes: FileTypeKey[];
  maxFiles: number;
  honorStatement: boolean;
  availableFrom: string;
  dueAt: string;
  allowLate: boolean;
  /** "Accept until": only sent while late work is on and there is a due date. */
  closeAt: string;
  allowResubmission: boolean;
  gradeRelease: GradeRelease;
}

export type AssignmentField = keyof AssignmentForm;
export type AssignmentErrors = Partial<Record<AssignmentField | "general", string>>;

export const SUBMISSION_KINDS: Array<{ value: SubmissionKind; label: string; hint: string }> = [
  { value: "text", label: "A written answer", hint: "Typed on the assignment page." },
  { value: "file", label: "Files", hint: "Uploaded from a computer or phone." },
  { value: "link", label: "A link", hint: "For example, a shared document or a repository." },
];

export const GRADE_RELEASE_OPTIONS: Array<{ value: GradeRelease; label: string; hint: string }> = [
  { value: "immediate", label: "As soon as I save a grade", hint: "Each student sees the grade and feedback right away." },
  { value: "returned", label: "When I return the work", hint: "Grades wait until you press Return on the grading page." },
];

/** The server's defaults (contract §1, §5), with 10 points as the old inline form had. */
export function defaultForm(moduleId: string): AssignmentForm {
  return {
    title: "",
    moduleId,
    description: "",
    instructions: "",
    points: "10",
    submissionKinds: ["text", "file"],
    allowedFileTypes: [...FILE_TYPE_KEYS],
    maxFiles: MAX_FILES,
    honorStatement: false,
    availableFrom: "",
    dueAt: "",
    allowLate: false,
    closeAt: "",
    allowResubmission: false,
    gradeRelease: "immediate",
  };
}

/** A saved assignment as the builder edits it. */
export function formFromDto(dto: Coursework): AssignmentForm {
  return {
    title: dto.title,
    moduleId: String(dto.moduleId),
    description: dto.description ?? "",
    instructions: dto.instructions ?? "",
    points: String(dto.maxPoints),
    submissionKinds: dto.submissionKinds?.length ? [...dto.submissionKinds] : ["text", "file"],
    allowedFileTypes: dto.allowedFileTypes?.length ? [...dto.allowedFileTypes] : [...FILE_TYPE_KEYS],
    maxFiles: dto.maxFiles || MAX_FILES,
    honorStatement: Boolean(dto.honorStatement),
    availableFrom: toLocalInput(dto.availableFrom),
    dueAt: toLocalInput(dto.dueAt),
    allowLate: Boolean(dto.allowLate),
    closeAt: toLocalInput(dto.closeAt),
    allowResubmission: Boolean(dto.allowResubmission),
    gradeRelease: dto.gradeRelease === "returned" ? "returned" : "immediate",
  };
}

/* ---------- Presets (client-only: they fill the form, nothing more) ---------- */

export type PresetId = "homework" | "in-class" | "project";

interface Preset {
  label: string;
  /** Every setting the preset decides; the title, description, instructions and module are left alone. */
  settings: Omit<AssignmentForm, "title" | "moduleId" | "description" | "instructions" | "availableFrom" | "dueAt" | "closeAt">;
  /** Due this many days from today at 11:59 PM (0 is today). */
  dueInDays: number;
  /** The last day for late work, this many days after the due date; null for none. */
  lateDays: number | null;
}

/** D-059 records why these values. */
export const PRESETS: Record<PresetId, Preset> = {
  homework: {
    label: "Homework",
    settings: { points: "20", submissionKinds: ["text", "file"], allowedFileTypes: ["pdf", "word", "image"], maxFiles: 3, honorStatement: true, allowLate: true, allowResubmission: true, gradeRelease: "immediate" },
    dueInDays: 7,
    lateDays: 2,
  },
  "in-class": {
    label: "In-class activity",
    settings: { points: "10", submissionKinds: ["text", "file"], allowedFileTypes: ["pdf", "image"], maxFiles: 2, honorStatement: false, allowLate: false, allowResubmission: false, gradeRelease: "immediate" },
    dueInDays: 0,
    lateDays: null,
  },
  project: {
    label: "Project",
    settings: { points: "100", submissionKinds: ["file", "link"], allowedFileTypes: [...FILE_TYPE_KEYS], maxFiles: 5, honorStatement: true, allowLate: true, allowResubmission: true, gradeRelease: "returned" },
    dueInDays: 14,
    lateDays: 3,
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

const pad = (value: number) => String(value).padStart(2, "0");
const localInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

function endOfDay(from: Date, days: number): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date;
}

/**
 * Fills the form from a preset. A due date already chosen is kept; otherwise the preset's is set.
 * The last day for late work follows the due date.
 */
export function applyPreset(form: AssignmentForm, id: PresetId, now: Date = new Date()): AssignmentForm {
  const preset = PRESETS[id];
  const due = form.dueAt ? new Date(form.dueAt) : endOfDay(now, preset.dueInDays);
  const closeAt = preset.settings.allowLate && preset.lateDays !== null ? localInput(endOfDay(due, preset.lateDays)) : "";
  return { ...form, ...preset.settings, submissionKinds: [...preset.settings.submissionKinds], allowedFileTypes: [...preset.settings.allowedFileTypes], dueAt: form.dueAt || localInput(due), closeAt };
}

/** Copies another assignment's settings: never its title, text, module, or dates. */
export function copySettings(form: AssignmentForm, source: Activity): AssignmentForm {
  return {
    ...form,
    points: String(source.maxScore),
    submissionKinds: source.submissionKinds?.length ? [...source.submissionKinds] : form.submissionKinds,
    allowedFileTypes: source.allowedFileTypes?.length ? [...source.allowedFileTypes] : form.allowedFileTypes,
    maxFiles: source.maxFiles || form.maxFiles,
    honorStatement: Boolean(source.honorStatement),
    allowLate: Boolean(source.allowLate),
    allowResubmission: Boolean(source.allowResubmission),
    gradeRelease: source.gradeRelease === "returned" ? "returned" : "immediate",
    // The last day belongs to the other assignment's dates.
    closeAt: source.allowLate ? form.closeAt : "",
  };
}

/* ---------- What applies, and the checks ---------- */

/** "Accept until" only means something with late work and a due date (contract §1). */
export const closeAtApplies = (form: Pick<AssignmentForm, "allowLate" | "dueAt">) => form.allowLate && Boolean(form.dueAt);
export const filesApply = (form: Pick<AssignmentForm, "submissionKinds">) => form.submissionKinds.includes("file");

/** What the builder checks before sending anything; the server checks again. */
export function validateAssignment(form: AssignmentForm): AssignmentErrors {
  const errors: AssignmentErrors = {};
  if (!form.title.trim()) errors.title = "Enter a title.";
  else if (form.title.trim().length > 250) errors.title = "Use at most 250 characters.";
  if (!form.moduleId) errors.moduleId = "Choose a module.";
  if (form.description.length > 1000) errors.description = "Use at most 1,000 characters.";
  const points = Number(form.points);
  if (!form.points.trim() || !Number.isFinite(points) || points <= 0 || points > 1000) errors.points = "Enter points more than 0 and at most 1,000.";
  if (!form.submissionKinds.length) errors.submissionKinds = "Choose at least one way to hand in work.";
  if (filesApply(form)) {
    if (!form.allowedFileTypes.length) errors.allowedFileTypes = "Choose at least one file type.";
    if (!Number.isInteger(form.maxFiles) || form.maxFiles < 1 || form.maxFiles > MAX_FILES) errors.maxFiles = `Allow 1 to ${MAX_FILES} files.`;
  }
  if (form.dueAt && form.availableFrom && new Date(form.dueAt) <= new Date(form.availableFrom)) errors.dueAt = "The due date must be after the date it becomes available.";
  if (closeAtApplies(form) && form.closeAt && new Date(form.closeAt) <= new Date(form.dueAt)) errors.closeAt = "The last day for late work must be after the due date.";
  return errors;
}

/** The tab each field is on (D-058), in the order the fields appear. */
export const FIELD_TABS: Record<AssignmentField, AssignmentTab> = {
  title: "details",
  moduleId: "details",
  description: "details",
  instructions: "details",
  points: "details",
  submissionKinds: "hand-in",
  allowedFileTypes: "hand-in",
  maxFiles: "hand-in",
  honorStatement: "hand-in",
  availableFrom: "dates",
  dueAt: "dates",
  allowLate: "dates",
  closeAt: "dates",
  allowResubmission: "dates",
  gradeRelease: "dates",
};

export const FIELD_LABELS: Record<AssignmentField, string> = {
  title: "Title",
  moduleId: "Module",
  description: "Short description",
  instructions: "Instructions",
  points: "Points",
  submissionKinds: "What students hand in",
  allowedFileTypes: "File types",
  maxFiles: "Files per turn-in",
  honorStatement: "Own-work statement",
  availableFrom: "Available from",
  dueAt: "Due date",
  allowLate: "Late work",
  closeAt: "Accept late work until",
  allowResubmission: "Resubmission",
  gradeRelease: "When grades show",
};

/** The fields with an error, in page order. */
export const errorFields = (errors: AssignmentErrors): AssignmentField[] => (Object.keys(FIELD_TABS) as AssignmentField[]).filter((field) => errors[field]);
export const errorCount = (errors: AssignmentErrors, tab: AssignmentTab) => errorFields(errors).filter((field) => FIELD_TABS[field] === tab).length;

const SERVER_FIELDS: Record<string, AssignmentField> = { maxPoints: "points", clearDueAt: "dueAt", clearAvailableFrom: "availableFrom", clearCloseAt: "closeAt" };

/** The server's 400 field errors on the builder's fields; anything else (status, type) is general. */
export function mapServerErrors(fieldErrors: Record<string, string[]> | undefined): AssignmentErrors {
  const errors: AssignmentErrors = {};
  for (const [name, messages] of Object.entries(fieldErrors ?? {})) {
    const key: AssignmentField | "general" = SERVER_FIELDS[name] ?? (name in FIELD_TABS ? (name as AssignmentField) : "general");
    if (messages[0] && !errors[key]) errors[key] = messages[0];
  }
  return errors;
}

/* ---------- To and from the API ---------- */

export type SaveStatus = "draft" | "published";

/**
 * The create or patch body (contract §1, §5). A missing date means "unchanged" to the server,
 * so an update whose date is now empty (or no longer applies) asks to clear it. `status` is left
 * out when a published assignment is saved, so it stays published.
 */
export function assignmentBody(form: AssignmentForm, options: { existing: boolean; status?: SaveStatus }) {
  const dueAt = instant(form.dueAt);
  const availableFrom = instant(form.availableFrom);
  const closeAt = closeAtApplies(form) ? instant(form.closeAt) : undefined;
  return {
    ...(options.existing ? {} : { type: "assignment", category: "Assignment" }),
    moduleId: Number(form.moduleId),
    title: form.title.trim(),
    description: form.description.trim(),
    instructions: form.instructions,
    maxPoints: Number(form.points),
    submissionKinds: form.submissionKinds,
    allowedFileTypes: form.allowedFileTypes,
    maxFiles: form.maxFiles,
    honorStatement: form.honorStatement,
    // Late work needs a due date; the box is off (and disabled) without one.
    allowLate: form.allowLate && dueAt !== undefined,
    allowResubmission: form.allowResubmission,
    gradeRelease: form.gradeRelease,
    dueAt,
    availableFrom,
    closeAt,
    ...(options.existing && dueAt === undefined ? { clearDueAt: true } : {}),
    ...(options.existing && availableFrom === undefined ? { clearAvailableFrom: true } : {}),
    ...(options.existing && closeAt === undefined ? { clearCloseAt: true } : {}),
    ...(options.status ? { status: options.status } : {}),
  };
}

/** The settings `handInRules` words, from the form (what students will read once it is saved). */
export function handInSettings(form: AssignmentForm): HandInSettings {
  return {
    submissionKinds: form.submissionKinds,
    allowedFileTypes: form.allowedFileTypes,
    maxFiles: form.maxFiles,
    honorStatement: form.honorStatement,
    dueAt: instant(form.dueAt) ?? null,
    allowLate: form.allowLate && Boolean(form.dueAt),
    closeAt: closeAtApplies(form) ? (instant(form.closeAt) ?? null) : null,
    allowResubmission: form.allowResubmission,
    gradeRelease: form.gradeRelease,
    // The builder has no late-penalty fields yet (Phase 3).
    latePenaltyPercentPerDay: 0,
    latePenaltyMaxPercent: 100,
  };
}

export type Sender = <T>(method: "POST" | "PATCH", path: string, body?: unknown) => Promise<T>;

export interface SaveRequest {
  classId: string;
  /** Null until the assignment has been created. */
  id: number | null;
  form: AssignmentForm;
  /** Left out to keep a published assignment published. */
  status?: SaveStatus;
}

export interface SaveOutcome {
  ok: boolean;
  id: number | null;
  message?: string;
  errors: AssignmentErrors;
}

const courseworkPath = (classId: string) => `/api/classes/${encodeURIComponent(classId)}/coursework`;

export async function saveAssignment(send: Sender, request: SaveRequest): Promise<SaveOutcome> {
  let id = request.id;
  const body = assignmentBody(request.form, { existing: id !== null, status: request.status });
  const result = await attempt(async () => {
    if (id === null) id = (await send<Coursework>("POST", courseworkPath(request.classId), body)).id;
    else await send("PATCH", `${courseworkPath(request.classId)}/${id}`, body);
  });
  if (result.ok) return { ok: true, id, errors: {} };
  return { ok: false, id, message: result.message, errors: mapServerErrors(result.fieldErrors) };
}

/** Students who have handed in this assignment (instructors never receive drafts or work taken back). */
export function handedInCount(submissions: Array<{ activityId: string; studentId: string; notHandedIn?: boolean }>, id: string): number {
  return new Set(submissions.filter((item) => item.activityId === id && !item.notHandedIn).map((item) => item.studentId)).size;
}

export const assignmentKeys = {
  all: ["instructor", "assignment"] as const,
  detail: (instructorId: string, classId: string, id: number) => ["instructor", "assignment", instructorId, classId, id] as const,
};

export function useAssignment(classId: string, id: number) {
  const viewer = useInstructorViewer();
  return useQuery({
    queryKey: assignmentKeys.detail(viewer.id, classId, id),
    queryFn: ({ signal }) => getJson<Coursework>(`${courseworkPath(classId)}/${id}`, { identity: true, viewer, signal }),
    retry: shouldRetryApiRead,
    networkMode: "always",
    enabled: Boolean(viewer.id) && Number.isInteger(id) && id > 0,
    // The builder keeps its own copy while open; a refetch must not replace it.
    staleTime: Infinity,
  });
}

/** Saves as the viewed instructor, then refreshes Classwork and drops the cached copy so reopening reads it again. */
export function useSaveAssignment() {
  const viewer = useInstructorViewer();
  const queryClient = useQueryClient();
  const refreshOverview = useRefreshOverview();
  return useCallback(
    async (request: SaveRequest) => {
      const outcome = await saveAssignment((method, path, body) => sendJson(method, path, body, { viewer }), request);
      await Promise.all([refreshOverview(), queryClient.invalidateQueries({ queryKey: assignmentKeys.all, refetchType: "none" })]);
      return outcome;
    },
    [viewer, queryClient, refreshOverview],
  );
}

export const isNotFound = (error: unknown) => isApiError(error) && error.status === 404;
