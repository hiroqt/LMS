import { act, renderHook, waitFor } from "@testing-library/react";
import { EventEmitter } from "node:events";
import type { Room } from "livekit-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChat } from "./useChat";

vi.mock("../api/meetings", () => ({
  sendChat: vi.fn(async (_viewer: unknown, _classId: string, _id: number, text: string) => ({ key: "mine", id: null, senderId: "s0", senderName: "Alex Rivera", senderRole: "student", text, sentAt: "2026-10-23T01:02:00Z", saved: false })),
  fetchSavedChat: vi.fn(async () => [{ key: "saved-1", id: 1, senderId: "t", senderName: "Angela Reyes", senderRole: "instructor", text: "Earlier", sentAt: "2026-10-23T01:00:00Z", saved: true }]),
}));

/** Just enough of a LiveKit Room: its events. */
const fakeRoom = () => new EventEmitter() as unknown as Room & EventEmitter;
const viewer = { id: "s0", role: "student" as const };
const message = (key: string, senderId = "t", text = "Hello") =>
  new TextEncoder().encode(JSON.stringify({ key, id: null, senderId, senderName: senderId === "t" ? "Angela Reyes" : "Alex Rivera", senderRole: "instructor", text, sentAt: "2026-10-23T01:01:00Z", saved: false }));

afterEach(() => vi.clearAllMocks());

describe("useChat", () => {
  it("takes chat only from the server, once each, and counts other people's as unread while closed", async () => {
    const room = fakeRoom();
    const { result, rerender } = renderHook(({ open }) => useChat({ room, viewer, classId: "biology", meetingId: 3, saveChat: false, open }), { initialProps: { open: false } });

    act(() => {
      room.emit("dataReceived", message("a"), undefined, undefined, "lms.chat");
      room.emit("dataReceived", message("a"), undefined, undefined, "lms.chat");
      // A person's own data message on the chat topic is not chat: anyone could send one.
      room.emit("dataReceived", message("forged"), { identity: "s9" }, undefined, "lms.chat");
      room.emit("dataReceived", message("other-topic"), undefined, undefined, "lms.reaction");
    });
    expect(result.current.messages.map((m) => m.key)).toEqual(["a"]);
    expect(result.current.unread).toBe(1);

    await act(async () => {
      await result.current.send("Mine");
    });
    expect(result.current.messages.map((m) => m.text)).toEqual(["Hello", "Mine"]);
    // Your own message isn't unread.
    expect(result.current.unread).toBe(1);

    rerender({ open: true });
    expect(result.current.unread).toBe(0);
    rerender({ open: false });
    expect(result.current.unread).toBe(0);
  });

  it("loads what was saved before joining as history, not as unread", async () => {
    const room = fakeRoom();
    const { result } = renderHook(() => useChat({ room, viewer, classId: "biology", meetingId: 3, saveChat: true, open: false }));
    await waitFor(() => expect(result.current.messages.map((m) => m.text)).toEqual(["Earlier"]));
    expect(result.current.unread).toBe(0);
  });
});
