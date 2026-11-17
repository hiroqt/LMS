import type { AdminData, AdminUser, Classroom } from "../data/types";

/** Rows per directory page. */
export const PAGE_SIZE = 8;

export const fullName = (user: Pick<AdminUser, "firstName" | "lastName"> | undefined) => (user ? `${user.firstName} ${user.lastName}`.trim() : "Unknown");

export const subjectOf = (data: AdminData, room: Classroom | undefined) => data.subjects.find((subject) => subject.id === room?.subjectId);

/** "Introduction to Programming · BSIT · Year 1 · Section A" */
export function classroomName(data: AdminData, classroomId: string): string {
  const room = data.classrooms.find((item) => item.id === classroomId);
  return `${subjectOf(data, room)?.title ?? "Class"} · ${room?.section ?? "Unknown section"}`;
}

export const activeEnrollmentCount = (data: AdminData, classroomId: string) =>
  data.enrollments.filter((item) => item.classroomId === classroomId && item.status === "active").length;

export const currentTermName = (data: AdminData) =>
  data.systemAdministration.terms.find((term) => term.id === data.systemAdministration.settings.currentTermId)?.name ?? "Fall 2026";
