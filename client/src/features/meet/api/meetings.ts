import { describeApiError, getJson, isApiError, sendJson } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";

/*
 * Class meetings (D-070): the LMS API's /api/classes/{classId}/meetings routes ("Class meetings"
 * in server/README.md). Video and sound go to the media server (LiveKit) with the pass `join`
 * returns; everything else goes through these calls.
 */

export type MeetingStatus = "scheduled" | "live" | "ended";

export interface MeetingSettings {
  studentsJoinMuted: boolean;
  studentsMayUnmute: boolean;
  studentsMayVideo: boolean;
  studentsMayShareScreen: boolean;
  studentsMayChat: boolean;
  saveChat: boolean;
}

export interface Meeting {
  id: number;
  classId: string;
  title: string;
  status: MeetingStatus;
  scheduledStart: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endReason: "instructor" | "empty" | null;
  locked: boolean;
  settings: MeetingSettings;
  savedChatMessages: number;
}

export interface MeetingJoin {
  serverUrl: string;
  token: string;
  expiresAt: string;
  identity: string;
  name: string;
  role: "instructor" | "student";
  meeting: Meeting;
}

/** A chat message, as the server sends it into the meeting (topic `lms.chat`) and as saved. */
export interface ChatMessage {
  key: string;
  id: number | null;
  senderId: string;
  senderName: string;
  senderRole: "instructor" | "student";
  text: string;
  sentAt: string;
  saved: boolean;
}

export interface MeetingCreate {
  title?: string;
  scheduledStart?: string;
  startNow?: boolean;
  settings?: Partial<MeetingSettings>;
}

const base = (classId: string) => `/api/classes/${encodeURIComponent(classId)}/meetings`;

export const meetingKeys = {
  mine: (viewerId: string) => ["meet", "mine", viewerId] as const,
  list: (viewerId: string, classId: string) => ["meet", "list", viewerId, classId] as const,
  one: (viewerId: string, classId: string, id: number) => ["meet", "one", viewerId, classId, id] as const,
};

export const fetchMeetings = (viewer: Viewer, classId: string, signal?: AbortSignal) =>
  getJson<Meeting[]>(base(classId), { identity: true, viewer, signal });

export const fetchMeeting = (viewer: Viewer, classId: string, id: number, signal?: AbortSignal) =>
  getJson<Meeting>(`${base(classId)}/${id}`, { identity: true, viewer, signal });

export const createMeeting = (viewer: Viewer, classId: string, input: MeetingCreate) =>
  sendJson<Meeting>("POST", base(classId), input, { viewer });

export const startMeeting = (viewer: Viewer, classId: string, id: number) =>
  sendJson<Meeting>("POST", `${base(classId)}/${id}/start`, undefined, { viewer });

export const endMeeting = (viewer: Viewer, classId: string, id: number) =>
  sendJson<Meeting>("POST", `${base(classId)}/${id}/end`, undefined, { viewer });

export const deleteMeeting = (viewer: Viewer, classId: string, id: number) =>
  sendJson<void>("DELETE", `${base(classId)}/${id}`, undefined, { viewer });

export const joinMeeting = (viewer: Viewer, classId: string, id: number) =>
  sendJson<MeetingJoin>("POST", `${base(classId)}/${id}/join`, undefined, { viewer });

/** Chat goes through the LMS API, which checks the rights, saves it when saving is on, and sends it into the meeting. */
export const sendChat = (viewer: Viewer, classId: string, id: number, text: string) =>
  sendJson<ChatMessage>("POST", `${base(classId)}/${id}/chat`, { text }, { viewer });

export const fetchSavedChat = (viewer: Viewer, classId: string, id: number, signal?: AbortSignal) =>
  getJson<ChatMessage[]>(`${base(classId)}/${id}/chat`, { identity: true, viewer, signal });

/** Raises or lowers the viewer's own hand (a participant attribute the server sets). */
export const setHand = (viewer: Viewer, classId: string, id: number, raised: boolean) =>
  sendJson<void>("POST", `${base(classId)}/${id}/hand`, { raised }, { viewer });

/** Title, time, the lock, and settings; a live meeting changes for everyone at once. */
export const updateMeeting = (viewer: Viewer, classId: string, id: number, input: { title?: string; scheduledStart?: string; locked?: boolean; settings?: Partial<MeetingSettings> }) =>
  sendJson<Meeting>("PATCH", `${base(classId)}/${id}`, input, { viewer });

/** The instructor's controls for one person in the meeting. */
export type HostAction = "mute" | "ask-unmute" | "stop-share" | "remove" | "lower-hand";
export const hostAction = (viewer: Viewer, classId: string, id: number, personId: string, action: HostAction) =>
  sendJson<void>("POST", `${base(classId)}/${id}/people/${encodeURIComponent(personId)}/${action}`, undefined, { viewer });

/** Lets a student speak (or stops), when students may not turn on their own mic. */
export const letSpeak = (viewer: Viewer, classId: string, id: number, personId: string, allowed: boolean) =>
  sendJson<void>("POST", `${base(classId)}/${id}/people/${encodeURIComponent(personId)}/let-speak`, { allowed }, { viewer });

export const muteEveryone = (viewer: Viewer, classId: string, id: number) =>
  sendJson<{ muted: number }>("POST", `${base(classId)}/${id}/mute-all`, undefined, { viewer });

/** One of the viewer's live or coming meetings, for a dashboard. */
export interface MyMeeting {
  meeting: Meeting;
  className: string;
}

export const fetchMyMeetings = (viewer: Viewer, signal?: AbortSignal) => getJson<MyMeeting[]>("/api/me/meetings", { identity: true, viewer, signal });

/** One person's attendance in a meeting (the instructor's report; D-035's monthly attendance is separate). */
export interface AttendancePerson {
  personId: string;
  name: string;
  role: "instructor" | "student";
  /** False for someone who joined but is no longer on the active class list. */
  onClassList: boolean;
  joined: boolean;
  firstJoinedAt: string | null;
  lastLeftAt: string | null;
  /** How many times they joined. */
  stays: number;
  minutesIn: number;
}

export interface MeetingAttendance {
  meetingId: number;
  studentsJoined: number;
  studentsOnClassList: number;
  people: AttendancePerson[];
}

export const fetchAttendance = (viewer: Viewer, classId: string, id: number, signal?: AbortSignal) =>
  getJson<MeetingAttendance>(`${base(classId)}/${id}/attendance`, { identity: true, viewer, signal });

export const deleteSavedChat = (viewer: Viewer, classId: string, id: number) =>
  sendJson<void>("DELETE", `${base(classId)}/${id}/chat`, undefined, { viewer });

/** The meeting that is on now, if any. */
export const liveMeeting = (meetings: readonly Meeting[] | undefined) => meetings?.find((m) => m.status === "live");

/** Meetings still to come, soonest first (the API's order). */
export const upcomingMeetings = (meetings: readonly Meeting[] | undefined) => (meetings ?? []).filter((m) => m.status === "scheduled");

/** Meetings that are over, newest first (the API's order). */
export const pastMeetings = (meetings: readonly Meeting[] | undefined) => (meetings ?? []).filter((m) => m.status === "ended");

/**
 * Why a meeting call failed, in the API's own words. The API writes its meeting problems for
 * people ("The instructor hasn't started this meeting yet."); the shared describer would read a
 * 503 as "ISMS is unavailable".
 */
export function describeMeetingError(error: unknown): { title: string; detail: string; code?: string } {
  if (isApiError(error) && typeof error.problem.code === "string") {
    return { title: error.title ?? "The meeting couldn't be reached", detail: error.detail ?? "", code: error.problem.code };
  }
  return describeApiError(error);
}

/** The API's code for a refusal (`not_started`, `ended`, `locked`, `removed`, `meetings_off`, …), if it sent one. */
export const meetingErrorCode = (error: unknown): string | undefined =>
  isApiError(error) && typeof error.problem.code === "string" ? error.problem.code : undefined;
