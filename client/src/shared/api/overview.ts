import type { MaterialFile } from "./materials";
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
  /** Text only for materials made before uploads; `file` is the real file (D-067). */
  fileName: string | null;
  fileType: string | null;
  fileSize: string | null;
  status: "active" | "archived";
  createdAt: string;
  file?: MaterialFile | null;
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
  /** Assignments: the last moment late work is accepted (D-054). */
  closeAt: string | null;
  /** Assignments: when students see a grade (D-054). */
  gradeRelease: "immediate" | "returned";
  /** Students, assignments only: the server's turn-in verdict; null for instructors and exams. */
  turnIn: TurnIn | null;
  /** Assignments: what a student may hand in (contract §5). Exams carry the defaults. */
  submissionKinds: SubmissionKind[];
  /** Assignments: the file types accepted; every type when the instructor chose none in particular. */
  allowedFileTypes: FileTypeKey[];
  /** Assignments: files per turn-in, 1 to 5. */
  maxFiles: number;
  /** Assignments: the student confirms "This is my own work" to turn in. */
  honorStatement: boolean;
  /** Assignments: percent off the earned score per calendar day late; 0 is no penalty (D-062, contract §10). */
  latePenaltyPercentPerDay: number;
  /** Assignments: the most a late penalty takes off, 1 to 100. */
  latePenaltyMaxPercent: number;
  /** Assignments: the rubric it is graded with, when it has one (contract §12). */
  rubricId: number | null;
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

export type SubmissionKind = "text" | "file" | "link";
export type FileTypeKey = "pdf" | "word" | "powerpoint" | "excel" | "image" | "text";

/** Whether a student can turn an assignment in now, and why not (D-054, contract §2). */
export interface TurnIn {
  /** `excused`: the instructor excused the student; nothing to hand in, and it doesn't count (D-062). */
  state: "assigned" | "missing" | "draft" | "turned_in" | "graded" | "returned" | "not_handed_in" | "excused";
  canTurnIn: boolean;
  /** Null when `canTurnIn`; otherwise the first rule that refuses. */
  reason: "closed" | "excused" | "not_handed_in" | "already_turned_in" | "past_close" | "past_due" | null;
  /** Turning in now would be late. */
  late: boolean;
  /** The latest turned-in work can be taken back now (D-058, contract §7). */
  canUnsubmit: boolean;
  /** This student's due date: their own when the instructor gave them one, otherwise the assignment's (contract §11). */
  dueAt: string | null;
  /** This student's last day for late work. */
  closeAt: string | null;
  /** The dates are the student's own, later than the class's. */
  extended: boolean;
}

/** Graded, whether or not it has been returned to the student yet (D-054). */
export const isGraded = (status: Submission["status"]) => status === "graded" || status === "returned";

/**
 * Handed in: neither a draft nor a version the student took back (D-058). Only a student ever
 * receives `withdrawn` rows; instructors never do.
 */
export const isHandedIn = (status: Submission["status"]) => status !== "in_progress" && status !== "withdrawn";

export interface RubricScore {
  criterionId: number;
  levelId: number;
  points: number;
}

/** An uploaded file on a draft or a version (contract §6). */
export interface SubmittedFile {
  id: number;
  name: string;
  /** Decided by the server from the file's bytes. */
  contentType: string;
  size: number;
  /** The first 8 characters of the file's SHA-256, as printed on the receipt: "9F2C-41AB". */
  code: string;
  /** Instructors only: another student handed in the same file for this assignment. */
  sameAsAnotherStudent: boolean | null;
}

export interface Submission {
  id: number;
  studentId: string;
  studentName: string | null;
  attemptNumber: number;
  /** `withdrawn`: turned-in work the student took back; it is kept, and only the student receives it. */
  status: "in_progress" | "submitted" | "graded" | "returned" | "withdrawn";
  startedAt: string | null;
  submittedAt: string | null;
  late: boolean;
  text: string | null;
  /** A file name typed before files were uploaded (D-055); null for newer work. */
  fileName: string | null;
  /** Assignments: a link the student handed in. */
  link: string | null;
  /** Assignments: the uploaded files of this draft or version; empty for exams. */
  files: SubmittedFile[];
  /** Calendar days late (Asia/Manila), counted from the student's own due date; 0 when on time (contract §10). */
  daysLate: number;
  /** The percent the late penalty takes off; 0 when none or waived. `score` is the score after it. */
  penaltyPercent: number;
  /** The instructor waived this student's late penalty. */
  penaltyWaived: boolean;
  /** The points the instructor gave, before the penalty; null with no grade or while the grade is held. */
  rawScore: number | null;
  /** The level chosen for each criterion, when graded with a rubric (contract §12); empty otherwise. */
  rubricScores: RubricScore[];
  /** The student is excused from this assignment (contract §11): the work needs no grade and doesn't count. */
  excused: boolean;
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
  /** Instructors: each student's own dates or excuse for an assignment (contract §11); empty for students. */
  exceptions: Array<{ courseworkId: number; classId: string; studentId: string; dueAt: string | null; closeAt: string | null; excused: boolean }>;
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
