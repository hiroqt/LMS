import { getJson } from "./http";
import type { Viewer } from "./viewer";

/** GET /api/me/overview and GET /api/people (LMS API, server/README.md). */

export interface ClassMeeting {
  day: string;
  timeFrom: string;
  timeTo: string;
  roomId: number;
  modality: number;
}

export interface OverviewClass {
  id: string;
  /** The ISMS subject; question sets belong to one (D-034). */
  subjectId: number;
  subjectCode: string | null;
  subjectName: string;
  sectionName: string | null;
  instructorId: string;
  instructorName: string;
  termName: string | null;
  studentCount: number;
  meetings: ClassMeeting[];
}

export interface OverviewModule {
  id: number;
  classId: string;
  parentModuleId: number | null;
  title: string;
  sortOrder: number;
}

export interface OverviewMaterial {
  id: number;
  classId: string;
  moduleId: number;
  title: string;
  kind: string;
  description: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: string | null;
  status: "active" | "archived";
  createdAt: string;
}

export interface OverviewAnnouncement {
  id: number;
  classId: string;
  title: string;
  message: string;
  status: "active" | "archived";
  publishedAt: string;
  postedBy: string | null;
  postedByName: string | null;
}

export interface Coursework {
  id: number;
  moduleId: number;
  type: "assignment" | "exam";
  title: string;
  description: string | null;
  category: string | null;
  instructions: string | null;
  maxPoints: number;
  dueAt: string | null;
  availableFrom: string | null;
  allowLate: boolean;
  allowResubmission: boolean;
  /** Assignments: the last moment late work is accepted (D-044). */
  closeAt: string | null;
  /** Assignments: when students see a grade (D-044). */
  gradeRelease: "immediate" | "returned";
  /** Students, assignments only: the server's turn-in verdict; null for instructors and exams. */
  turnIn: TurnIn | null;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  questionnaireId: number | null;
  questionCount: number;
  /** Closed work refuses hand-ins and attempts; only the close and reopen actions change it (D-036). */
  status: "draft" | "published" | "closed" | "archived";
  /** Instructors only: students on the class list with a grade, and how many are on it. */
  gradedCount?: number | null;
  rosterCount?: number | null;
}

/** Whether a student can turn an assignment in now, and why not (D-044, contract §2). */
export interface TurnIn {
  state: "assigned" | "missing" | "draft" | "turned_in" | "graded" | "returned" | "not_handed_in";
  canTurnIn: boolean;
  /** Null when `canTurnIn`; otherwise the first rule that refuses. */
  reason: "closed" | "not_handed_in" | "already_turned_in" | "past_close" | "past_due" | null;
  /** Turning in now would be late. */
  late: boolean;
}

/** Graded, whether or not it has been returned to the student yet (D-044). */
export const isGraded = (status: Submission["status"]) => status === "graded" || status === "returned";

export interface Submission {
  id: number;
  studentId: string;
  studentName: string | null;
  attemptNumber: number;
  status: "in_progress" | "submitted" | "graded" | "returned";
  startedAt: string | null;
  submittedAt: string | null;
  late: boolean;
  text: string | null;
  fileName: string | null;
  score: number | null;
  maxPoints: number;
  feedback: string | null;
  gradedAt: string | null;
  /** A grade the instructor gave a student who handed in nothing (D-036). */
  notHandedIn?: boolean;
}

/** One month of a class's attendance. A student receives only their own entry. */
export interface AttendanceMonth {
  year: number;
  month: number;
  schoolDays: number;
  entries: Array<{ studentId: string; daysPresent: number }>;
}

export interface Overview {
  me: { id: string; firstName: string; lastName: string; role: string };
  classes: OverviewClass[];
  modules: OverviewModule[];
  materials: OverviewMaterial[];
  announcements: OverviewAnnouncement[];
  coursework: Array<{ classId: string; coursework: Coursework }>;
  submissions: Array<{ courseworkId: number; classId: string; submission: Submission }>;
  students: Array<{ classId: string; studentId: string; firstName: string; lastName: string }>;
  gradebooks: Array<{ classId: string; activityWeight: number; examWeight: number; passingScore: number }>;
  /** Newest month first. Recorded only; not part of the gradebook (D-035). */
  attendance: Array<{ classId: string; month: AttendanceMonth }>;
}

export interface People {
  instructors: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string }>;
}

export const fetchOverview = (viewer: Viewer, signal?: AbortSignal) =>
  getJson<Overview>("/api/me/overview", { identity: true, viewer, signal });

/** Sends the sandbox header so tests see their own sandbox's people. */
export const fetchPeople = (signal?: AbortSignal) => getJson<People>("/api/people", { identity: true, viewer: null, signal });

/** "MW 08:00–09:30", one entry per meeting. */
export function meetingLabel(meetings: ClassMeeting[]): string {
  return meetings.map((meeting) => `${meeting.day} ${meeting.timeFrom}–${meeting.timeTo}`).join(", ");
}

/** ISMS has no year-level field on a class; sections like "BSIT 2-A" or "BSIT · Year 2" carry it. */
export function yearLevelFromSection(section: string | null): number {
  const digit = Number(section?.match(/[1-9]/)?.[0]);
  return digit >= 1 && digit <= 6 ? digit : 1;
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" } : { firstName: parts[0] || "", lastName: "" };
}
