import { formatMonth } from "./format";

/*
 * Monthly attendance (D-035): totals per month, not a daily roll call.
 * Attendance % = days present ÷ school days × 100. Recorded only; it is not
 * part of the gradebook yet. The server applies the same limits.
 */

export interface MonthRef {
  year: number;
  month: number;
}

export const daysInMonth = ({ year, month }: MonthRef) => new Date(year, month, 0).getDate();

/** "2026-10": a Select value without spaces (C-013). */
export const monthKey = ({ year, month }: MonthRef) => `${year}-${String(month).padStart(2, "0")}`;

export function parseMonthKey(key: string): MonthRef | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  return match && month >= 1 && month <= 12 ? { year, month } : null;
}

/** "October 2026" */
export const monthLabel = ({ year, month }: MonthRef) => formatMonth(new Date(year, month - 1, 1));

/** The month of `now` and the `count - 1` months before it, newest first. */
export function recentMonths(now: number | Date, count = 12): MonthRef[] {
  const today = new Date(now);
  return Array.from({ length: count }, (_, back) => {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
}

/** Rounded to one decimal; null when there is nothing to divide by. */
export function attendancePercent(daysPresent: number, schoolDays: number): number | null {
  if (!Number.isFinite(daysPresent) || !Number.isFinite(schoolDays) || schoolDays <= 0) return null;
  return Math.round((daysPresent / schoolDays) * 1000) / 10;
}

/** "90%", "86.4%", or an em dash when there is no value. */
export const formatPercent = (value: number | null) => (value === null ? "—" : `${value}%`);

/** A whole number typed in a field, or null. */
export const wholeNumber = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** The school-days field: a whole number from 1 to the days in that month. */
export function schoolDaysError(text: string, ref: MonthRef): string | undefined {
  const value = wholeNumber(text);
  const max = daysInMonth(ref);
  return value === null || value < 1 || value > max ? `Enter school days from 1 to ${max}.` : undefined;
}

/** A days-present field: a whole number from 0 to the school days. Empty means "not recorded". */
export function daysPresentError(text: string, schoolDays: number | null): string | undefined {
  if (text.trim() === "") return undefined;
  const value = wholeNumber(text);
  if (schoolDays === null) return value === null ? "Enter a whole number." : undefined;
  return value === null || value > schoolDays ? `Enter days present from 0 to ${schoolDays}.` : undefined;
}
