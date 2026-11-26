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

export interface MeetingCreate {
  title?: string;
  scheduledStart?: string;
  startNow?: boolean;
  settings?: Partial<MeetingSettings>;
}

const base = (classId: string) => `/api/classes/${encodeURIComponent(classId)}/meetings`;

export const meetingKeys = {
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
