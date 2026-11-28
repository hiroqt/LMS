import { RoomEvent, type Participant, type Room } from "livekit-client";
import { useEffect, useState } from "react";
import type { ShownReaction } from "./useReactions";

/**
 * One polite line for screen readers about what others do that is only seen: a hand going up,
 * a reaction. Chat has its own count on the Chat button.
 */
export function useAnnouncements(room: Room, reaction: ShownReaction | null): string {
  const [text, setText] = useState("");
  useEffect(() => {
    const onAttributes = (changed: Record<string, string>, participant: Participant) => {
      if (participant === room.localParticipant || !("lms.hand" in changed)) return;
      const name = participant.name || participant.identity;
      setText(changed["lms.hand"] ? `${name} raised their hand` : `${name} lowered their hand`);
    };
    room.on(RoomEvent.ParticipantAttributesChanged, onAttributes);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributes);
    };
  }, [room]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the newest reaction becomes the announcement
    if (reaction && reaction.identity !== room.localParticipant.identity) setText(`${reaction.sender} reacted: ${reaction.label}`);
  }, [reaction, room]);
  return text;
}
