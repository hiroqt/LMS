import { RoomEvent, type Room } from "livekit-client";
import { useEffect, useState } from "react";

/** The room events after which the meeting page re-reads who is in it and what they publish. */
const EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.ParticipantPermissionsChanged,
  RoomEvent.ParticipantAttributesChanged,
  RoomEvent.ParticipantNameChanged,
  RoomEvent.RoomMetadataChanged,
  RoomEvent.AudioPlaybackStatusChanged,
  RoomEvent.ConnectionStateChanged,
] as const;

/**
 * A number that changes whenever the room does, so a component reading `room` re-renders.
 * LiveKit's objects are mutable; this is the one place the page listens to them.
 */
export function useRoomVersion(room: Room | null): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!room) return;
    const bump = () => setVersion((value) => value + 1);
    for (const event of EVENTS) room.on(event, bump);
    return () => {
      for (const event of EVENTS) room.off(event, bump);
    };
  }, [room]);
  return version;
}
