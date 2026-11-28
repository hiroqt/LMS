import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/http";
import { describeMeetingError, liveMeeting, meetingErrorCode, pastMeetings, upcomingMeetings, type Meeting } from "./meetings";
import { formatDuration, nextFullHour, toLocalInput } from "./time";

const settings = { studentsJoinMuted: true, studentsMayUnmute: true, studentsMayVideo: true, studentsMayShareScreen: false, studentsMayChat: true, saveChat: false };
const meeting = (id: number, status: Meeting["status"]): Meeting => ({
  id, classId: "biology", title: `M${id}`, status, scheduledStart: null, startedAt: null, endedAt: null, endReason: null, locked: false, settings, savedChatMessages: 0,
});

describe("meeting lists", () => {
  const all = [meeting(1, "live"), meeting(2, "scheduled"), meeting(3, "scheduled"), meeting(4, "ended")];
  it("splits the API's list into live, upcoming and past, keeping its order", () => {
    expect(liveMeeting(all)?.id).toBe(1);
    expect(upcomingMeetings(all).map((m) => m.id)).toEqual([2, 3]);
    expect(pastMeetings(all).map((m) => m.id)).toEqual([4]);
    expect(liveMeeting(undefined)).toBeUndefined();
    expect(upcomingMeetings(undefined)).toEqual([]);
  });
});

describe("describeMeetingError", () => {
  it("uses the API's own words for a meeting problem, even on a 503 (not \"ISMS is unavailable\")", () => {
    const off = new ApiError({ kind: "isms-unavailable", status: 503, url: "/x", title: "Class meetings are turned off on this server.", problem: { code: "meetings_off" } });
    expect(describeMeetingError(off)).toEqual({ title: "Class meetings are turned off on this server.", detail: "", code: "meetings_off" });
    expect(meetingErrorCode(off)).toBe("meetings_off");
  });

  it("falls back to the shared description without a meeting code", () => {
    const down = new ApiError({ kind: "network", status: 0, url: "/x" });
    expect(describeMeetingError(down).title).toMatch(/LMS API|offline/);
    expect(meetingErrorCode(down)).toBeUndefined();
    expect(meetingErrorCode(new Error("x"))).toBeUndefined();
  });
});

describe("meeting times", () => {
  it("defaults a new meeting to the next full hour, as a datetime-local value", () => {
    expect(toLocalInput(nextFullHour(new Date(2026, 9, 23, 9, 0)))).toBe("2026-10-23T10:00");
    expect(toLocalInput(nextFullHour(new Date(2026, 9, 23, 23, 30)))).toBe("2026-10-24T00:00");
  });

  it("says how long a meeting lasted", () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 9, 23, 1, minutes)).toISOString();
    expect(formatDuration(at(0), at(0))).toBe("less than a minute");
    expect(formatDuration(at(0), at(12))).toBe("12 min");
    expect(formatDuration(at(0), at(60))).toBe("1 h");
    expect(formatDuration(at(0), at(95))).toBe("1 h 35 min");
  });
});
