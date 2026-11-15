/** Calendar helpers shared by the Student and Instructor dashboards. */

export interface CalendarMark {
  id: string;
  title: string;
  date: Date;
  /** "deadline" for coursework due dates, "event" for school calendar entries. */
  kind: "deadline" | "event";
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

export function inMonth<T extends { date: Date }>(entries: T[], month: Date): T[] {
  return entries.filter((item) => item.date.getFullYear() === month.getFullYear() && item.date.getMonth() === month.getMonth());
}
