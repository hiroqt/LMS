import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meeting, MeetingJoin } from "../api/meetings";
import { useMeetingRoom } from "./useMeetingRoom";

/** Every Room the hook makes, so a test can see whether it connected. */
const rooms = vi.hoisted(() => [] as { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[]);

vi.mock("livekit-client", async () => {
  const { EventEmitter } = await import("node:events");
  class Room extends EventEmitter {
    connect = vi.fn(async () => undefined);
    disconnect = vi.fn(async () => undefined);
    localParticipant = { publishTrack: vi.fn(async () => undefined) };
    constructor() {
      super();
      rooms.push(this);
    }
  }
  return {
    Room,
    RoomEvent: { Reconnecting: "reconnecting", Reconnected: "reconnected", Disconnected: "disconnected" },
    DisconnectReason: { ROOM_DELETED: 1, PARTICIPANT_REMOVED: 2, DUPLICATE_IDENTITY: 3 },
  };
});

const meeting: Meeting = {
  id: 3, classId: "biology", title: "Lecture 7", status: "live", scheduledStart: null, startedAt: "2026-10-23T01:00:00Z", endedAt: null, endReason: null, locked: false,
  settings: { studentsJoinMuted: true, studentsMayUnmute: true, studentsMayVideo: true, studentsMayShareScreen: false, studentsMayChat: true, saveChat: false },
  savedChatMessages: 0,
};
const pass: MeetingJoin = { serverUrl: "ws://meet.test", token: "pass", expiresAt: "2026-10-23T01:10:00Z", identity: "s0", name: "Alex Rivera", role: "student", meeting };

/** The join pass request, answered when the test says so. */
const pending = vi.hoisted(() => ({ resolve: (_value: unknown) => {} }));

vi.mock("../api/meetings", () => ({
  fetchMeeting: vi.fn(async () => meeting),
  joinMeeting: vi.fn(() => new Promise((resolve) => { pending.resolve = resolve; })),
  startMeeting: vi.fn(),
  endMeeting: vi.fn(),
  describeMeetingError: () => ({ title: "Failed", detail: "" }),
  meetingErrorCode: () => undefined,
}));

const viewer = { id: "s0", role: "student" as const };

afterEach(() => {
  rooms.length = 0;
  vi.clearAllMocks();
});

describe("useMeetingRoom", () => {
  it("joins with the pass the API gives", async () => {
    const { result } = renderHook(() => useMeetingRoom({ viewer, classId: "biology", meetingId: 3 }));
    await waitFor(() => expect(result.current.phase.kind).toBe("prejoin"));
    act(() => void result.current.join([]));
    await act(async () => pending.resolve(pass));
    await waitFor(() => expect(result.current.phase.kind).toBe("connected"));
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.connect).toHaveBeenCalledWith("ws://meet.test", "pass");
  });

  it("doesn't join the meeting after the person left the page while the pass was on its way", async () => {
    const { result, unmount } = renderHook(() => useMeetingRoom({ viewer, classId: "biology", meetingId: 3 }));
    await waitFor(() => expect(result.current.phase.kind).toBe("prejoin"));
    act(() => void result.current.join([]));
    unmount();
    await act(async () => pending.resolve(pass));
    // No Room was made, so nobody is left in the meeting without a page.
    expect(rooms).toHaveLength(0);
  });

  it("doesn't join after Stop waiting, and stays on the pre-join screen", async () => {
    const { result } = renderHook(() => useMeetingRoom({ viewer, classId: "biology", meetingId: 3 }));
    await waitFor(() => expect(result.current.phase.kind).toBe("prejoin"));
    act(() => void result.current.join([]));
    act(() => result.current.cancelWaiting());
    await act(async () => pending.resolve(pass));
    expect(rooms).toHaveLength(0);
    expect(result.current.phase.kind).toBe("prejoin");
  });
});
