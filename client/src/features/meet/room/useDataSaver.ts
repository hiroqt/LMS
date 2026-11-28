import { Track, type Room } from "livekit-client";
import { useEffect } from "react";

/**
 * Data saver (D-070): stops receiving everyone else's camera. Sound and shared screens keep
 * coming. Applied again whenever someone joins or publishes (`version`).
 */
export function useDataSaver(room: Room, on: boolean, version: number) {
  useEffect(() => {
    for (const person of room.remoteParticipants.values()) {
      const camera = person.getTrackPublication(Track.Source.Camera);
      if (camera && camera.isDesired === on) camera.setSubscribed(!on);
    }
  }, [room, on, version]);
}
