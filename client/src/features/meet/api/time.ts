const pad = (value: number) => String(value).padStart(2, "0");

/** A `datetime-local` value ("2026-10-23T10:00") for a moment, in the browser's time zone. */
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The next full hour after `now`, the default time for a new meeting. */
export function nextFullHour(now: Date): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** "Fri, Oct 23 · 9:00 AM" */
export const formatMeetingTime = (iso: string) => `${day.format(new Date(iso))} · ${time.format(new Date(iso))}`;

/** "9:05 AM" */
export const formatClock = (iso: string) => time.format(new Date(iso));

/** "1 h 35 min", "12 min", "less than a minute" */
export function formatDuration(fromIso: string, toIso: string): string {
  const minutes = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000);
  if (minutes < 1) return "less than a minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
