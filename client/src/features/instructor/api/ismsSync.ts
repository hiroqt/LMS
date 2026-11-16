import type { IsmsClass, IsmsStudent } from "../../isms-link";
import { DEFAULT_GRADEBOOK } from "./selectors";
import type { Classroom, Enrollment, RoleStore, Subject, User } from "./types";

/*
 * ISMS owns subjects, instructors, class schedules, and class lists (D-031).
 * Until the LMS has its own database, the Instructor UI still reads the
 * browser-local role store, so ISMS records are copied into it here. Every
 * copied record has an "isms-" id and `source: "isms"`; seed and locally
 * created records are never touched. The merge is idempotent: merging the
 * same ISMS data twice returns the same store object.
 */

export const ISMS_PREFIX = "isms-";

export const ismsUserId = (ismsId: string) => `${ISMS_PREFIX}${ismsId}`;
export const ismsSubjectId = (ismsId: number) => `${ISMS_PREFIX}subject-${ismsId}`;
export const ismsClassroomId = (classId: string) => `${ISMS_PREFIX}${classId}`;
export const isIsmsRecord = (record: { source?: string } | undefined): boolean => record?.source === "isms";

export interface IsmsSnapshot {
  /** Every class ISMS currently offers in the synced term. */
  classes: IsmsClass[];
  /** Class lists that have been loaded so far, by ISMS class id. */
  studentsByClass: Record<string, IsmsStudent[]>;
  /** Shown on each class, e.g. "2026-2027 · 1st Semester". */
  termName: string;
  /** ISO time used for records created by this merge. */
  now: string;
}

/** ISMS has no year-level field on a class; section names like "BSIT 2-A" carry it. */
export function yearLevelFromSection(section: string | null): number {
  const digit = Number(section?.match(/[1-9]/)?.[0]);
  return digit >= 1 && digit <= 6 ? digit : 1;
}

/** "MW 08:00–09:30", one entry per meeting. */
export function scheduleLabel(item: IsmsClass): string {
  return item.meetings.map((meeting) => `${meeting.day} ${meeting.timeFrom}–${meeting.timeTo}`).join(", ");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" } : { firstName: parts[0] || "Instructor", lastName: "" };
}

/** Replaces or appends by id, keeping the original order and any extra local fields. */
function upsert<T extends { id: string }>(records: T[], incoming: T[]): T[] {
  const byId = new Map(incoming.map((item) => [item.id, item]));
  const merged = records.map((record) => {
    const next = byId.get(record.id);
    byId.delete(record.id);
    return next ? { ...record, ...next } : record;
  });
  return [...merged, ...byId.values()];
}

export function mergeIsmsClasses(store: RoleStore, snapshot: IsmsSnapshot): RoleStore {
  const { classes, studentsByClass, termName, now } = snapshot;

  const instructors: User[] = [...new Map(classes.map((item) => [item.instructorId, item])).values()].map((item) => ({
    id: ismsUserId(item.instructorId),
    ...splitName(item.instructorName),
    role: "instructor",
    status: "active",
    source: "isms",
  }));

  const subjects: Subject[] = [...new Map(classes.map((item) => [item.subjectId, item])).values()].map((item) => ({
    id: ismsSubjectId(item.subjectId),
    code: item.subjectCode ?? "",
    title: item.subjectName,
    source: "isms",
  }));

  const existingRooms = new Map(store.classrooms.map((room) => [room.id, room]));
  const offered = new Set(classes.map((item) => ismsClassroomId(item.id)));
  const rooms: Classroom[] = classes.map((item) => {
    const id = ismsClassroomId(item.id);
    return {
      id,
      subjectId: ismsSubjectId(item.subjectId),
      instructorId: ismsUserId(item.instructorId),
      section: item.sectionName ?? `Section ${item.sectionId}`,
      yearLevel: yearLevelFromSection(item.sectionName),
      term: termName,
      schedule: scheduleLabel(item),
      status: "active",
      source: "isms",
      createdAt: existingRooms.get(id)?.createdAt ?? now,
    };
  });
  // A class ISMS no longer offers is hidden, not deleted: its coursework and grades stay.
  const withdrawn = store.classrooms
    .filter((room) => isIsmsRecord(room) && !offered.has(room.id) && room.status !== "inactive")
    .map((room) => ({ ...room, status: "inactive" }));

  // A class seen for the first time gets the same starter module and weights a new class always had.
  const fresh = rooms.filter((room) => !existingRooms.has(room.id));
  const modules = [...store.modules, ...fresh.map((room) => ({ id: `module-${room.id}`, classroomId: room.id, title: "Unit 1 · Foundations", order: 1 }))];
  const gradebookSettings = fresh.length
    ? { ...store.gradebookSettings, ...Object.fromEntries(fresh.map((room) => [room.id, { ...DEFAULT_GRADEBOOK }])) }
    : store.gradebookSettings;

  const students: User[] = [];
  const enrollments: Enrollment[] = [];
  const loadedRooms = new Set<string>();
  for (const [classId, list] of Object.entries(studentsByClass)) {
    const classroomId = ismsClassroomId(classId);
    if (!offered.has(classroomId)) continue;
    loadedRooms.add(classroomId);
    for (const student of list) {
      const studentId = ismsUserId(student.studentId);
      students.push({ id: studentId, firstName: student.firstName, lastName: student.lastName, role: "student", status: "active", source: "isms" });
      enrollments.push({ id: `${classroomId}-${studentId}`, classroomId, studentId, status: "active", source: "isms" });
    }
  }
  // In a class whose list was loaded, a student ISMS no longer lists is unenrolled.
  const listed = new Set(enrollments.map((item) => item.id));
  const dropped = store.enrollments
    .filter((item) => isIsmsRecord(item) && loadedRooms.has(item.classroomId) && item.id && !listed.has(item.id) && item.status !== "inactive")
    .map((item) => ({ ...item, status: "inactive" }));

  const next: RoleStore = {
    ...store,
    users: upsert(store.users, [...instructors, ...new Map(students.map((item) => [item.id, item])).values()]),
    subjects: upsert(store.subjects, subjects),
    classrooms: upsert(store.classrooms, [...rooms, ...withdrawn]),
    enrollments: upsert(store.enrollments as Array<Enrollment & { id: string }>, [...enrollments, ...dropped] as Array<Enrollment & { id: string }>),
    modules,
    gradebookSettings,
  };
  return JSON.stringify(next) === JSON.stringify(store) ? store : next;
}
