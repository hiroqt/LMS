import { inMonth, monthGrid, type CalendarMark } from "../../../shared/lib/calendar";
import { moduleTree } from "../../../shared/lib/moduleTree";
import type { AcademicEvent, Assessment, CourseModule, Material, StudentCatalog, StudentProgress } from "./types";

export { inMonth, monthGrid };
export { upcomingSchoolEvents } from "../../../shared/lib/schoolNews";

/*
 * Pure rules shared by the rebuilt Student screens. Each mirrors the classic
 * UI's logic (removed at cutover) so counts, groups, and order stayed identical.
 */

export const DAY = 86_400_000;

/** Completed = locally completed quizzes/exams + submitted assignments. */
export function completedIds(progress: StudentProgress, catalog: Pick<StudentCatalog, "activitySubmissions">): string[] {
  return [...new Set([...progress.completed, ...Object.keys(catalog.activitySubmissions)])];
}

/** The week runs Sunday 00:00 to the next Sunday 00:00, in local time. */
export function weekBounds(now: number): { start: Date; end: Date } {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
}

/** Work without a due date sorts last and is never missing or due this week. */
const due = (item: Assessment) => (item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY);
const byDue = (a: Assessment, b: Assessment) => due(a) - due(b);

/**
 * Still to do: not handed in and not excused. Excused work (D-062) is never due, missing, or
 * late in the student's lists; work handed in before the excuse stays done.
 */
export const needsWork = (item: Pick<Assessment, "id" | "excused">, completed: string[]) => !completed.includes(item.id) && !item.excused;

/** Up to three unfinished items with a future due date, soonest first. */
export function dueSoon(assessments: Assessment[], completed: string[], now: number, limit = 3): Assessment[] {
  return assessments.filter((item) => needsWork(item, completed) && due(item) >= now).sort(byDue).slice(0, limit);
}

export function dueThisWeek(assessments: Assessment[], completed: string[], now: number): Assessment[] {
  const { end } = weekBounds(now);
  return assessments.filter((item) => needsWork(item, completed) && due(item) >= now && due(item) < end.getTime());
}

export const TASK_STATUSES = ["Due soon", "Due this week", "Missing", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskGroup {
  status: TaskStatus;
  description: string;
  items: Assessment[];
}

export function taskGroups(assessments: Assessment[], completed: string[], now: number): TaskGroup[] {
  const open = (item: Assessment) => needsWork(item, completed);
  return [
    { status: "Due soon", description: "Work with a future due date", items: assessments.filter((item) => open(item) && due(item) >= now) },
    { status: "Due this week", description: "Unfinished work due before the week ends", items: dueThisWeek(assessments, completed, now) },
    { status: "Missing", description: "Work past its due date that has not been submitted", items: assessments.filter((item) => open(item) && due(item) < now) },
    { status: "Done", description: "Work you have submitted: assessments, activities, and assignments", items: assessments.filter((item) => completed.includes(item.id)) },
  ].map((group) => ({ ...group, items: [...group.items].sort(byDue) })) as TaskGroup[];
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

const eventDate = (item: AcademicEvent) => new Date(`${item.date}T00:00:00`);

export function schoolEventsThisWeek(events: AcademicEvent[], now: number): AcademicEvent[] {
  const { start, end } = weekBounds(now);
  return events.filter((item) => eventDate(item) >= start && eventDate(item) < end).sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime());
}

export interface CalendarEntry extends CalendarMark {
  /** Present for assessment deadlines; absent for school events. */
  assessment?: Assessment;
  category?: string;
}

/** Assessment deadlines (at their due time) and school events (at noon, all day). */
export function calendarEntries(assessments: Assessment[], events: AcademicEvent[]): CalendarEntry[] {
  return [
    ...assessments.filter((item) => item.dueAt).map((item) => ({ id: item.id, title: item.title, date: new Date(item.dueAt), kind: "deadline" as const, assessment: item })),
    ...events.map((item) => ({ id: item.id, title: item.title, date: new Date(`${item.date}T12:00:00`), kind: "event" as const, category: item.category })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface SearchResult {
  kind: string;
  title: string;
  id: string;
  target: "class" | "assessment" | "material";
}

/** Classes, assessments, and materials matching the query; at most six, like the classic search. */
export function searchWorkspace(query: string, catalog: Pick<StudentCatalog, "courses" | "assessments" | "materials">): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return [
    ...catalog.courses.filter((item) => `${item.name} ${item.section}`.toLowerCase().includes(q)).map((item) => ({ kind: "Class", title: item.name, id: item.id, target: "class" as const })),
    ...catalog.assessments.filter((item) => `${item.title} ${item.type}`.toLowerCase().includes(q)).map((item) => ({ kind: item.type, title: item.title, id: item.id, target: "assessment" as const })),
    ...catalog.materials.filter((item) => item.title.toLowerCase().includes(q)).map((item) => ({ kind: "Material", title: item.title, id: item.id, target: "material" as const })),
  ].slice(0, 6);
}

/** Correct answers in a submitted attempt. */
export function scoreAttempt(questions: Array<{ correct: number }>, answers: Record<number, number>): number {
  return questions.reduce((total, question, index) => total + (answers[index] === question.correct ? 1 : 0), 0);
}

export { greeting } from "../../../shared/lib/greeting";

export interface ModuleEntry {
  kind: "material" | "assessment";
  id: string;
  title: string;
  /** "Reading", "Quiz", "Assignment"… */
  type: string;
}

export interface ModuleSection {
  module: CourseModule;
  entries: ModuleEntry[];
  submodules: Array<{ module: CourseModule; entries: ModuleEntry[] }>;
}

/** A module or submodule's materials, in the order the instructor added them. */
export interface MaterialGroup {
  id: string;
  title: string;
  materials: Material[];
  /** Submodules with materials; a submodule never has its own. */
  submodules: MaterialGroup[];
}

/**
 * A class's materials grouped by module, then submodule, in the instructor's order (D-067).
 * Modules and submodules with no materials are left out; a material whose module is unknown
 * goes in "Other materials" at the end.
 */
export function materialsByModule(catalog: Pick<StudentCatalog, "modules" | "materials">, courseId: string): MaterialGroup[] {
  const mine = catalog.materials.filter((item) => item.courseId === courseId);
  const of = (moduleId: string) => mine.filter((item) => item.moduleId === moduleId);
  const tree = moduleTree(catalog.modules.filter((item) => item.courseId === courseId));
  const groups = tree
    .map(({ module, submodules }) => ({
      id: module.id,
      title: module.title,
      materials: of(module.id),
      submodules: submodules.map((sub) => ({ id: sub.id, title: sub.title, materials: of(sub.id), submodules: [] })).filter((sub) => sub.materials.length > 0),
    }))
    .filter((group) => group.materials.length > 0 || group.submodules.length > 0);
  const placed = new Set(groups.flatMap((group) => [...group.materials, ...group.submodules.flatMap((sub) => sub.materials)]).map((item) => item.id));
  const other = mine.filter((item) => !placed.has(item.id));
  return other.length ? [...groups, { id: "other", title: "Other materials", materials: other, submodules: [] }] : groups;
}

/** The class's materials in reading order: module by module, each module's own before its submodules'. */
export function materialSequence(catalog: Pick<StudentCatalog, "modules" | "materials">, courseId: string): Material[] {
  return materialsByModule(catalog, courseId).flatMap((group) => [...group.materials, ...group.submodules.flatMap((sub) => sub.materials)]);
}

/** Newest first; equal dates keep their order. */
export const newestFirst = (materials: readonly Material[]) => [...materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * A class's modules in order, each with its submodules and the materials and
 * assessments placed directly in each (D-033). Materials come first.
 */
export function courseModules(catalog: Pick<StudentCatalog, "modules" | "materials" | "assessments">, courseId: string): ModuleSection[] {
  const entriesOf = (moduleId: string): ModuleEntry[] => [
    ...catalog.materials.filter((item) => item.courseId === courseId && item.moduleId === moduleId).map((item) => ({ kind: "material" as const, id: item.id, title: item.title, type: item.kind })),
    ...catalog.assessments.filter((item) => item.courseId === courseId && item.moduleId === moduleId).map((item) => ({ kind: "assessment" as const, id: item.id, title: item.title, type: item.type })),
  ];
  return moduleTree(catalog.modules.filter((item) => item.courseId === courseId)).map(({ module, submodules }) => ({
    module,
    entries: entriesOf(module.id),
    submodules: submodules.map((sub) => ({ module: sub, entries: entriesOf(sub.id) })),
  }));
}
