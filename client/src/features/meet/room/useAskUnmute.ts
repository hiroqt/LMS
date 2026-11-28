import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { useEffect, useState } from "react";
import { TOPIC } from "./metadata";

/** The instructor asked this person to turn on their mic: who asked, or null. Only the server sends it (D-072). */
export function useAskUnmute(room: Room) {
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (participant || topic !== TOPIC.askUnmute) return;
      try {
        const raw = JSON.parse(new TextDecoder().decode(payload)) as { from?: unknown };
        setFrom(typeof raw.from === "string" && raw.from ? raw.from : "The instructor");
      } catch {
        setFrom("The instructor");
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);
  return { from, dismiss: () => setFrom(null) };
}
