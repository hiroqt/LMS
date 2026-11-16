import type { ClassMeeting, IsmsInstructor, IsmsStudent } from "./types";

const timestampFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** "Nov 16, 2026, 9:05 AM", or the raw value when it is not a date. */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : timestampFormat.format(date);
}

const join = (...parts: (string | null | undefined)[]) => parts.map((part) => part?.trim()).filter(Boolean).join(" ");

/** "Dr. Maria L. Santos Jr." */
export function instructorName(instructor: IsmsInstructor): string {
  const initial = instructor.middleName?.trim() ? `${instructor.middleName.trim().charAt(0)}.` : "";
  return join(instructor.honorific, instructor.firstName, initial, instructor.lastName, instructor.suffix) || instructor.id;
}

/** "Santos, Maria Luna" (roster order). */
export function studentName(student: IsmsStudent): string {
  const given = join(student.firstName, student.middleName);
  return [student.lastName?.trim(), given].filter(Boolean).join(", ") || student.studentId;
}

export function sortStudents(students: IsmsStudent[]): IsmsStudent[] {
  return [...students].sort((a, b) => studentName(a).localeCompare(studentName(b)));
}

/** "Mon 08:00–09:30" */
export function meetingLabel(meeting: ClassMeeting): string {
  return `${meeting.day} ${meeting.timeFrom}–${meeting.timeTo}`;
}
