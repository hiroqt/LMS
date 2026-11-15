/**
 * The academic term as students and instructors think about it: which week
 * of the term it is, and which milestones (exams, breaks) are ahead.
 * Derived from the school calendar (data.js academicEvents): the term runs
 * from the "term-start" event to the "term-end" event.
 */
import type { SchoolEvent } from "./schoolNews";

const DAY = 86_400_000;
const at = (date: string) => new Date(`${date}T00:00:00`).getTime();

export interface TermMilestone {
  id: string;
  title: string;
  date: string;
  /** 1-based week of term the milestone falls in. */
  week: number;
  kind: "exam" | "break" | "deadline" | "event";
}

export interface TermStatus {
  /** e.g. "Fall 2026" */
  name: string;
  /** 1-based current week, clamped to the term. */
  week: number;
  totalWeeks: number;
  /** "before" the first day, "in" term, or "after" the last day. */
  phase: "before" | "in" | "after";
  milestones: TermMilestone[];
  /** The next milestone from today, if any. */
  next?: TermMilestone & { inDays: number };
}

function kindOf(category: string): TermMilestone["kind"] {
  if (/exam/i.test(category)) return "exam";
  if (/no classes/i.test(category)) return "break";
  if (/deadline/i.test(category)) return "deadline";
  return "event";
}

export function termStatus(events: SchoolEvent[], now: number): TermStatus | null {
  const start = events.find((item) => item.id === "term-start");
  const end = events.find((item) => item.id === "term-end");
  if (!start || !end) return null;
  const startAt = at(start.date);
  const endAt = at(end.date) + DAY;
  const weekOf = (time: number) => Math.floor((time - startAt) / (7 * DAY)) + 1;
  const totalWeeks = Math.ceil((endAt - startAt) / (7 * DAY));
  const season = start.title.match(/^(\w+)/)?.[1] ?? "Term";
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Show the first day of a multi-day milestone (e.g. "Midterm exam week begins").
  const milestones = events
    .filter((item) => item.id !== "term-start" && item.id !== "term-end" && !/ends$/i.test(item.title))
    .filter((item) => kindOf(item.category) !== "event" || /exam|break|holiday|showcase/i.test(item.title))
    .map((item) => ({ id: item.id, title: item.title, date: item.date, week: weekOf(at(item.date)), kind: kindOf(item.category) }))
    .filter((item) => item.week >= 1 && item.week <= totalWeeks)
    .sort((a, b) => at(a.date) - at(b.date));

  const upcoming = milestones.find((item) => at(item.date) >= startOfToday);
  return {
    name: `${season} ${new Date(startAt).getFullYear()}`,
    week: Math.min(Math.max(weekOf(startOfToday), 1), totalWeeks),
    totalWeeks,
    phase: startOfToday < startAt ? "before" : startOfToday >= endAt ? "after" : "in",
    milestones,
    next: upcoming && { ...upcoming, inDays: Math.round((at(upcoming.date) - startOfToday) / DAY) },
  };
}
