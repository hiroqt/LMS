import type { AcademicEvent, Assessment, StudentCatalog, StudentProgress } from "./types";

/*
 * Pure rules shared by the rebuilt Student screens. Each mirrors the classic
 * UI's logic in App.jsx so counts, groups, and order are identical.
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

const due = (item: Assessment) => new Date(item.dueAt).getTime();
const byDue = (a: Assessment, b: Assessment) => due(a) - due(b);

/** Up to three unfinished items with a future due date, soonest first. */
export function dueSoon(assessments: Assessment[], completed: string[], now: number, limit = 3): Assessment[] {
  return assessments.filter((item) => !completed.includes(item.id) && due(item) >= now).sort(byDue).slice(0, limit);
}

export function dueThisWeek(assessments: Assessment[], completed: string[], now: number): Assessment[] {
  const { end } = weekBounds(now);
  return assessments.filter((item) => !completed.includes(item.id) && due(item) >= now && due(item) < end.getTime());
}

export const TASK_STATUSES = ["Due soon", "Due this week", "Missing", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskGroup {
  status: TaskStatus;
  description: string;
  items: Assessment[];
}

export function taskGroups(assessments: Assessment[], completed: string[], now: number): TaskGroup[] {
  const open = (item: Assessment) => !completed.includes(item.id);
  return [
    { status: "Due soon", description: "Work with a future due date", items: assessments.filter((item) => open(item) && due(item) >= now) },
    { status: "Due this week", description: "Unfinished work due before the week ends", items: dueThisWeek(assessments, completed, now) },
    { status: "Missing", description: "Work past its due date that has not been submitted", items: assessments.filter((item) => open(item) && due(item) < now) },
    { status: "Done", description: "Assessments you have submitted", items: assessments.filter((item) => completed.includes(item.id)) },
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

/** School events from today on, soonest first. */
export function upcomingSchoolEvents(events: AcademicEvent[], now: number): AcademicEvent[] {
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return events.filter((item) => eventDate(item) >= startOfToday).sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime());
}

export interface CalendarEntry {
  id: string;
  title: string;
  date: Date;
  /** Present for assessment deadlines; absent for school events. */
  assessment?: Assessment;
  category?: string;
}

/** Assessment deadlines (at their due time) and school events (at noon, all day). */
export function calendarEntries(assessments: Assessment[], events: AcademicEvent[]): CalendarEntry[] {
  return [
    ...assessments.map((item) => ({ id: item.id, title: item.title, date: new Date(item.dueAt), assessment: item })),
    ...events.map((item) => ({ id: item.id, title: item.title, date: new Date(`${item.date}T12:00:00`), category: item.category })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function inMonth(entries: CalendarEntry[], month: Date): CalendarEntry[] {
  return entries.filter((item) => item.date.getFullYear() === month.getFullYear() && item.date.getMonth() === month.getMonth());
}

/** Day numbers for a month grid starting on Sunday; null pads the edges. */
export function monthGrid(month: Date, minCells = 0): Array<number | null> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.max(Math.ceil((first + days) / 7) * 7, minCells);
  return Array.from({ length: cells }, (_, index) => {
    const day = index - first + 1;
    return day > 0 && day <= days ? day : null;
  });
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

export function greeting(now: number): string {
  const hour = new Date(now).getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
