import { getJson } from "./http";
import type { RubricScore } from "./overview";
import type { Viewer } from "./viewer";

/**
 * Grading rubrics (D-062; `docs/ASSIGNMENTS_API_CONTRACT.md` §12). A rubric belongs to a class:
 * criteria, each with levels worth points. An assignment that uses one is worth its total and
 * is graded by choosing a level for every criterion. The instructor's routes are in
 * `features/instructor/api/rubrics.ts`; this module is what both roles read.
 */
export interface RubricLevel {
  id: number;
  title: string;
  description: string | null;
  points: number;
}

export interface RubricCriterion {
  id: number;
  title: string;
  description: string | null;
  levels: RubricLevel[];
}

export interface Rubric {
  id: number;
  title: string;
  /** The sum of each criterion's highest level: what an assignment using it is worth. */
  totalPoints: number;
  /** A grade has used it, so its criteria can't change; copy it instead. Always false for students. */
  locked: boolean;
  /** How many assignments use it. Always 0 for students. */
  usedBy: number;
  criteria: RubricCriterion[];
}

export const rubricKeys = {
  ofCoursework: (viewerId: string, classId: string, courseworkId: string | number) => ["rubric", "coursework", viewerId, classId, String(courseworkId)] as const,
};

/** The rubric of one assignment, for its instructor and for students who can see the assignment. 404 when it has none. */
export const fetchCourseworkRubric = (viewer: Viewer, classId: string, courseworkId: string | number, signal?: AbortSignal) =>
  getJson<Rubric>(`/api/classes/${encodeURIComponent(classId)}/coursework/${courseworkId}/rubric`, { identity: true, viewer, signal });

/** The most a criterion can earn. */
export const criterionMax = (criterion: Pick<RubricCriterion, "levels">) => Math.max(0, ...criterion.levels.map((level) => level.points));

/** The level chosen for each criterion, by criterion id, from a grade's `rubricScores`. */
export const chosenLevels = (scores: RubricScore[] | undefined): Record<number, number> =>
  Object.fromEntries((scores ?? []).map((score) => [score.criterionId, score.levelId]));

/** The points the chosen levels add up to, and whether every criterion has one. */
export function rubricTotal(rubric: Pick<Rubric, "criteria">, chosen: Record<number, number>): { points: number; complete: boolean } {
  let points = 0;
  let complete = true;
  for (const criterion of rubric.criteria) {
    const level = criterion.levels.find((item) => item.id === chosen[criterion.id]);
    if (level) points += level.points;
    else complete = false;
  }
  // Level points can have two decimals; adding them as floats would show 2.3000000000000003.
  return { points: Math.round(points * 100) / 100, complete };
}
