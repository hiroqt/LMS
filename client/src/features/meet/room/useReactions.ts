import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { readReaction, TOPIC, type Reaction } from "./metadata";

/** How long a reaction shows on the sender's tile. */
export const REACTION_MS = 4_000;

export interface ShownReaction {
  emoji: Reaction["emoji"];
  /** The reaction's name, e.g. "Clapping". */
  label: Reaction["name"];
  identity: string;
  /** Who sent it. */
  sender: string;
  at: number;
}

/**
 * Reactions (D-072): a person's own data messages, not saved and not checked by the server; only
 * the six on the list are shown. Each shows on the sender's tile for a few seconds and is
 * announced once (`latest`).
 */
export function useReactions(room: Room) {
  const [shown, setShown] = useState<Record<string, ShownReaction>>({});
  const [latest, setLatest] = useState<ShownReaction | null>(null);

  const show = useCallback((reaction: ShownReaction) => {
    setShown((current) => ({ ...current, [reaction.identity]: reaction }));
    setLatest(reaction);
    setTimeout(() => {
      setShown((current) => (current[reaction.identity]?.at === reaction.at ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== reaction.identity)) : current));
    }, REACTION_MS);
  }, []);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (!participant || topic !== TOPIC.reaction) return;
      const reaction = readReaction(payload);
      if (reaction) show({ emoji: reaction.emoji, label: reaction.name, identity: participant.identity, sender: participant.name || participant.identity, at: Date.now() });
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, show]);

  const send = useCallback(async (reaction: Reaction) => {
    const local = room.localParticipant;
    await local.publishData(new TextEncoder().encode(JSON.stringify({ emoji: reaction.emoji })), { reliable: true, topic: TOPIC.reaction });
    show({ emoji: reaction.emoji, label: reaction.name, identity: local.identity, sender: local.name || local.identity, at: Date.now() });
  }, [room, show]);

  return { shown, latest, send };
}
