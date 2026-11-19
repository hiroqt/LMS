import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { describeApiError, getJson, isApiError, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Rubric } from "../../../shared/api/rubrics";
import type { Viewer } from "../../../shared/api/viewer";
import type { ActionResult } from "./actions";
import { assignmentKeys } from "./assignments";
import { useInstructorViewer } from "./questionSets";
import { useRefreshOverview } from "./store";

/*
 * A class's grading rubrics, for the instructor (D-062, D-063; contract §12): the list, the
 * editor's form, its checks (the server's limits), the server's field errors on the form's
 * inputs, and the writes. Everything here is pure except the hooks at the end.
 */

export const LIMITS = { titleMax: 120, levelTitleMax: 60, descriptionMax: 500, minCriteria: 1, maxCriteria: 12, minLevels: 2, maxLevels: 6, maxPoints: 1000 } as const;

/** The server's sentence for changing the criteria of a locked rubric (contract §12). */
export const LOCKED_MESSAGE = "This rubric has been used to grade. Copy it to change its criteria.";

export interface LevelForm {
  /** A stable React key; not sent. */
  key: string;
  title: string;
  description: string;
  /** Text until saved, as the builder keeps points. */
  points: string;
}

export interface CriterionForm {
  key: string;
  title: string;
  description: string;
  levels: LevelForm[];
}

export interface RubricForm {
  title: string;
  criteria: CriterionForm[];
}

/**
 * Errors by the server's own paths: `title`, `criteria`, `criteria[1].title`,
 * `criteria[1].levels`, `criteria[1].levels[0].points`, and `general` for the rest.
 */
export type RubricErrors = Record<string, string>;

let nextKey = 0;
const newKey = () => `k${++nextKey}`;

const level = (title = "", points = ""): LevelForm => ({ key: newKey(), title, description: "", points });

export function newCriterion(): CriterionForm {
  return { key: newKey(), title: "", description: "", levels: [level("Complete", "10"), level("Partial", "5"), level("Missing", "0")] };
}

/** A new rubric: one criterion with three levels to adjust. */
export function emptyRubricForm(): RubricForm {
  return { title: "", criteria: [newCriterion()] };
}

export function formFromRubric(rubric: Pick<Rubric, "title" | "criteria">): RubricForm {
  return {
    title: rubric.title,
    criteria: rubric.criteria.map((criterion) => ({
      key: newKey(),
      title: criterion.title,
      description: criterion.description ?? "",
      levels: criterion.levels.map((item) => ({ key: newKey(), title: item.title, description: item.description ?? "", points: String(item.points) })),
    })),
  };
}

/* ---------- Changing the form (each returns a new form) ---------- */

export function addCriterion(form: RubricForm): RubricForm {
  if (form.criteria.length >= LIMITS.maxCriteria) return form;
  return { ...form, criteria: [...form.criteria, newCriterion()] };
}

export function removeCriterion(form: RubricForm, index: number): RubricForm {
  if (form.criteria.length <= LIMITS.minCriteria) return form;
  return { ...form, criteria: form.criteria.filter((_, at) => at !== index) };
}

/** Swaps a criterion with its neighbour; nothing happens past either end. */
export function moveCriterion(form: RubricForm, index: number, by: -1 | 1): RubricForm {
  const to = index + by;
  if (to < 0 || to >= form.criteria.length) return form;
  const criteria = [...form.criteria];
  [criteria[index], criteria[to]] = [criteria[to]!, criteria[index]!];
  return { ...form, criteria };
}

export function changeCriterion(form: RubricForm, index: number, change: Partial<Omit<CriterionForm, "key" | "levels">>): RubricForm {
  return { ...form, criteria: form.criteria.map((item, at) => (at === index ? { ...item, ...change } : item)) };
}

export function addLevel(form: RubricForm, index: number): RubricForm {
  const criterion = form.criteria[index];
  if (!criterion || criterion.levels.length >= LIMITS.maxLevels) return form;
  return { ...form, criteria: form.criteria.map((item, at) => (at === index ? { ...item, levels: [...item.levels, level()] } : item)) };
}

export function removeLevel(form: RubricForm, index: number, levelIndex: number): RubricForm {
  const criterion = form.criteria[index];
  if (!criterion || criterion.levels.length <= LIMITS.minLevels) return form;
  return { ...form, criteria: form.criteria.map((item, at) => (at === index ? { ...item, levels: item.levels.filter((_, k) => k !== levelIndex) } : item)) };
}

export function changeLevel(form: RubricForm, index: number, levelIndex: number, change: Partial<Omit<LevelForm, "key">>): RubricForm {
  return {
    ...form,
    criteria: form.criteria.map((item, at) => (at === index ? { ...item, levels: item.levels.map((one, k) => (k === levelIndex ? { ...one, ...change } : one)) } : item)),
  };
}

/* ---------- Totals ---------- */

const pointsOf = (value: string) => {
  const number = Number(value);
  return value.trim() && Number.isFinite(number) ? number : null;
};

/** The most a criterion of the form can earn: its highest level (levels not yet a number count as 0). */
export const criterionFormMax = (criterion: CriterionForm) => Math.max(0, ...criterion.levels.map((item) => pointsOf(item.points) ?? 0));

/** What an assignment using the rubric is worth: the sum of each criterion's highest level, to two decimals. */
export const formTotal = (form: RubricForm) => Math.round(form.criteria.reduce((sum, criterion) => sum + criterionFormMax(criterion), 0) * 100) / 100;

export const pointsLabel = (points: number) => `${points} ${points === 1 ? "point" : "points"}`;

/** "15 points · 2 criteria · used by 1 assignment" */
export function rubricFacts(rubric: Pick<Rubric, "totalPoints" | "criteria" | "usedBy">): string {
  const criteria = `${rubric.criteria.length} ${rubric.criteria.length === 1 ? "criterion" : "criteria"}`;
  const used = rubric.usedBy === 0 ? "not used by any assignment" : `used by ${rubric.usedBy} ${rubric.usedBy === 1 ? "assignment" : "assignments"}`;
  return `${pointsLabel(rubric.totalPoints)} · ${criteria} · ${used}`;
}

/* ---------- Checks (the server's limits, contract §12) ---------- */

function text(errors: RubricErrors, path: string, value: string, max: number, required: boolean) {
  const trimmed = value.trim();
  if (required && !trimmed) errors[path] = "Enter a title.";
  else if (trimmed.length > max) errors[path] = `Use at most ${max} characters.`;
}

/** What the editor checks before sending; the server checks again with the same paths. */
export function validateRubric(form: RubricForm, options: { locked?: boolean } = {}): RubricErrors {
  const errors: RubricErrors = {};
  text(errors, "title", form.title, LIMITS.titleMax, true);
  // A locked rubric sends its title only.
  if (options.locked) return errors;
  if (form.criteria.length < LIMITS.minCriteria) errors.criteria = "Add at least one criterion.";
  else if (form.criteria.length > LIMITS.maxCriteria) errors.criteria = `Use at most ${LIMITS.maxCriteria} criteria.`;
  form.criteria.forEach((criterion, index) => {
    const at = `criteria[${index}]`;
    text(errors, `${at}.title`, criterion.title, LIMITS.titleMax, true);
    text(errors, `${at}.description`, criterion.description, LIMITS.descriptionMax, false);
    if (criterion.levels.length < LIMITS.minLevels || criterion.levels.length > LIMITS.maxLevels) errors[`${at}.levels`] = `Give each criterion ${LIMITS.minLevels} to ${LIMITS.maxLevels} levels.`;
    criterion.levels.forEach((item, k) => {
      const path = `${at}.levels[${k}]`;
      text(errors, `${path}.title`, item.title, LIMITS.levelTitleMax, true);
      text(errors, `${path}.description`, item.description, LIMITS.descriptionMax, false);
      const points = pointsOf(item.points);
      if (points === null || points < 0 || points > LIMITS.maxPoints) errors[`${path}.points`] = `Give 0 to ${LIMITS.maxPoints.toLocaleString("en-US")} points.`;
    });
  });
  if (!errors.criteria && !Object.keys(errors).some((key) => key.startsWith("criteria["))) {
    const total = formTotal(form);
    if (total <= 0) errors.criteria = "A rubric must be worth more than 0 points: give at least one level points.";
    else if (total > LIMITS.maxPoints) errors.criteria = `A rubric can be worth at most ${LIMITS.maxPoints.toLocaleString("en-US")} points; this one adds up to ${total}.`;
  }
  return errors;
}

/** Every path the form can show an error on, in page order; `criteria` (the whole list) comes last. */
export function errorPaths(form: RubricForm): string[] {
  const paths = ["title"];
  form.criteria.forEach((criterion, index) => {
    const at = `criteria[${index}]`;
    paths.push(`${at}.title`, `${at}.description`);
    criterion.levels.forEach((_, k) => paths.push(`${at}.levels[${k}].title`, `${at}.levels[${k}].points`, `${at}.levels[${k}].description`));
    paths.push(`${at}.levels`);
  });
  paths.push("criteria");
  return paths;
}

/** The paths with an error, in page order. */
export const rubricErrorPaths = (form: RubricForm, errors: RubricErrors): string[] => errorPaths(form).filter((path) => errors[path]);

/** The server's 400 field errors on the form's inputs; a path the form doesn't have becomes `general`. */
export function mapRubricErrors(form: RubricForm, fieldErrors: Record<string, string[]> | undefined): RubricErrors {
  const known = new Set(errorPaths(form));
  const errors: RubricErrors = {};
  for (const [name, messages] of Object.entries(fieldErrors ?? {})) {
    const key = known.has(name) ? name : "general";
    if (messages[0] && !errors[key]) errors[key] = messages[0];
  }
  return errors;
}

/** Drops the errors on paths a change touched. A change to the criteria list clears every criterion's errors, since indexes move. */
export function clearErrors(errors: RubricErrors, prefix: string | "all-criteria"): RubricErrors {
  const keys = Object.keys(errors);
  const drop = prefix === "all-criteria" ? (key: string) => key === "criteria" || key.startsWith("criteria[") || key === "general" : (key: string) => key === prefix || key === "general" || (prefix.startsWith("criteria[") && key === "criteria");
  if (!keys.some(drop)) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([key]) => !drop(key)));
}

/** The create or update body. A locked rubric takes a new title only (contract §12). */
export function rubricBody(form: RubricForm, options: { locked?: boolean } = {}) {
  const title = form.title.trim();
  if (options.locked) return { title };
  return {
    title,
    criteria: form.criteria.map((criterion) => ({
      title: criterion.title.trim(),
      description: criterion.description.trim() || null,
      levels: criterion.levels.map((item) => ({ title: item.title.trim(), description: item.description.trim() || null, points: Number(item.points) })),
    })),
  };
}

/* ---------- To and from the API ---------- */

const rubricsPath = (classId: string) => `/api/classes/${encodeURIComponent(classId)}/rubrics`;
const queryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;

export const classRubricKeys = {
  all: ["instructor", "rubrics"] as const,
  list: (viewerId: string, classId: string) => ["instructor", "rubrics", viewerId, classId, "list"] as const,
  detail: (viewerId: string, classId: string, id: number) => ["instructor", "rubrics", viewerId, classId, id] as const,
};

export const fetchRubrics = (viewer: Viewer, classId: string, signal?: AbortSignal) => getJson<Rubric[]>(rubricsPath(classId), { identity: true, viewer, signal });

/** The class's rubrics, with their criteria (`GET …/rubrics`). */
export function useRubrics(classId: string) {
  const viewer = useInstructorViewer();
  return useQuery({
    queryKey: classRubricKeys.list(viewer.id, classId),
    queryFn: ({ signal }) => fetchRubrics(viewer, classId, signal),
    ...queryOptions,
    enabled: Boolean(viewer.id) && Boolean(classId),
  });
}

/** One rubric for the editor. Like the builders (L-082) it is read once and kept while open. */
export function useRubric(classId: string, id: number) {
  const viewer = useInstructorViewer();
  return useQuery({
    queryKey: classRubricKeys.detail(viewer.id, classId, id),
    queryFn: ({ signal }) => getJson<Rubric>(`${rubricsPath(classId)}/${id}`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id) && Number.isInteger(id) && id > 0,
    staleTime: Infinity,
  });
}

export interface RubricResult extends ActionResult {
  rubric?: Rubric;
}

/**
 * A failed write in plain words. A refusal (409) is the server's own sentence, as it stands
 * ("An assignment uses this rubric. Take it off the assignment first."); field errors say to
 * check the fields; anything else is described as the other screens describe it.
 */
export function refusal(error: unknown): RubricResult {
  if (isApiError(error) && error.status === 409 && error.title) return { ok: false, message: error.title };
  const { title, detail } = describeApiError(error);
  if (isApiError(error) && error.status === 400) return { ok: false, message: "Check the highlighted fields.", fieldErrors: error.fieldErrors };
  return { ok: false, message: `${title}. ${detail}` };
}

/** Create, save, copy and delete, each refreshing the list (and Classwork, whose points a rubric sets). */
export function useRubricActions(classId: string) {
  const viewer = useInstructorViewer();
  const queryClient = useQueryClient();
  const refreshOverview = useRefreshOverview();

  return useMemo(() => {
    const send = <T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown) => sendJson<T>(method, path, body, { viewer });
    /** Keeps the saved copy for the editor, drops the list, and drops cached assignments (their points may have changed). */
    const settle = async (saved?: Rubric) => {
      if (saved) queryClient.setQueryData(classRubricKeys.detail(viewer.id, classId, saved.id), saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classRubricKeys.list(viewer.id, classId) }),
        queryClient.invalidateQueries({ queryKey: assignmentKeys.all, refetchType: "none" }),
        refreshOverview(),
      ]);
    };
    const run = async (change: () => Promise<Rubric | undefined>): Promise<RubricResult> => {
      try {
        const rubric = await change();
        await settle(rubric);
        return { ok: true, rubric };
      } catch (error) {
        return refusal(error);
      }
    };
    return {
      create: (form: RubricForm) => run(() => send<Rubric>("POST", rubricsPath(classId), rubricBody(form))),
      save: (id: number, form: RubricForm, locked: boolean) => run(() => send<Rubric>("PUT", `${rubricsPath(classId)}/${id}`, rubricBody(form, { locked }))),
      copy: (id: number) => run(() => send<Rubric>("POST", `${rubricsPath(classId)}/${id}/copy`)),
      remove: async (id: number): Promise<RubricResult> => {
        const result = await run(async () => {
          await send("DELETE", `${rubricsPath(classId)}/${id}`);
          return undefined;
        });
        if (result.ok) queryClient.removeQueries({ queryKey: classRubricKeys.detail(viewer.id, classId, id) });
        return result;
      },
    };
  }, [viewer, classId, queryClient, refreshOverview]);
}
