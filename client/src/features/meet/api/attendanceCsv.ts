import type { AttendancePerson, Meeting } from "./meetings";

const stamp = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** "2026-10-23 09:05" in the browser's time zone, or empty. */
const when = (iso: string | null) => (iso ? stamp.format(new Date(iso)).replace(",", "") : "");

/**
 * One CSV cell: quoted when needed, and a leading = + - @ (or tab) defused with an apostrophe,
 * so a name can't run as a formula when the file is opened in a spreadsheet.
 */
export function csvCell(value: string | number | boolean): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The meeting's attendance as CSV, with a byte-order mark so spreadsheet apps read it as UTF-8. */
export function attendanceCsv(people: readonly AttendancePerson[]): string {
  const header = ["Name", "Role", "On the class list", "Joined", "First joined", "Last left", "Times joined", "Minutes"];
  const rows = people.map((p) => [p.name, p.role === "instructor" ? "Instructor" : "Student", p.onClassList ? "Yes" : "No", p.joined ? "Yes" : "No", when(p.firstJoinedAt), when(p.lastLeftAt), p.stays, p.minutesIn]);
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** "intro-to-programming-meeting-attendance-2026-10-23.csv" */
export function attendanceFileName(meeting: Pick<Meeting, "title" | "startedAt" | "scheduledStart">): string {
  const slug = meeting.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "meeting";
  const at = meeting.startedAt ?? meeting.scheduledStart;
  return `${slug}-attendance${at ? `-${when(at).slice(0, 10)}` : ""}.csv`;
}
