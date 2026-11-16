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
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  questionnaireId: number | null;
  questionCount: number;
  status: "draft" | "published" | "archived";
}

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
