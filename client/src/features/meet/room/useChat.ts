import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Viewer } from "../../../shared/api/viewer";
import { fetchSavedChat, sendChat, type ChatMessage } from "../api/meetings";
import { chatIdentity, readChatMessage, TOPIC } from "./metadata";

/**
 * The meeting's chat (D-072): messages arrive as data messages from the server only (a person
 * can't fake one), sending goes through the LMS API. When saving is on, what was already saved
 * is loaded on joining. `unread` counts other people's messages that arrived while the panel
 * was closed.
 */
export function useChat({ room, viewer, classId, meetingId, saveChat, open }: {
  room: Room;
  viewer: Viewer;
  classId: string;
  meetingId: number;
  saveChat: boolean;
  open: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [arrived, setArrived] = useState(0);
  const [read, setRead] = useState(0);
  const seen = useRef(new Set<string>());

  const add = useCallback((incoming: ChatMessage[], live: boolean) => {
    const fresh = incoming.filter((message) => !seen.current.has(chatIdentity(message)));
    if (fresh.length === 0) return;
    for (const message of fresh) seen.current.add(chatIdentity(message));
    setMessages((current) => [...current, ...fresh].sort((a, b) => a.sentAt.localeCompare(b.sentAt)));
    if (live) setArrived((value) => value + fresh.filter((message) => message.senderId !== viewer.id).length);
  }, [viewer.id]);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (participant || topic !== TOPIC.chat) return;
      const message = readChatMessage(payload);
      if (message) add([message], true);
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, add]);

  // What was saved before this person joined; history, not unread.
  useEffect(() => {
    if (!saveChat) return;
    const controller = new AbortController();
    fetchSavedChat(viewer, classId, meetingId, controller.signal).then((saved) => add(saved, false), () => undefined);
    return () => controller.abort();
  }, [saveChat, viewer, classId, meetingId, add]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- an open panel has been read
    if (open) setRead(arrived);
  }, [open, arrived]);

  const send = useCallback(async (text: string) => {
    add([await sendChat(viewer, classId, meetingId, text)], false);
  }, [viewer, classId, meetingId, add]);

  return { messages, unread: open ? 0 : Math.max(0, arrived - read), send };
}
