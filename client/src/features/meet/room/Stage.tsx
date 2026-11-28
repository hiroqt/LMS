import { Track, type Participant, type Room, type VideoTrack } from "livekit-client";
import { MonitorUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { ParticipantTile } from "./ParticipantTile";
import type { ShownReaction } from "./useReactions";
import { VideoView } from "./VideoView";

export type Layout = "grid" | "speaker";

/**
 * What fills the meeting: a shared screen first (large, with everyone in a strip); else the
 * pinned person; else, in Speaker view, whoever spoke last; else everyone in a grid.
 */
export function Stage({ room, version, layout, pinned, onPin, reactions, dataSaver, onStopSharing }: {
  room: Room;
  version: number;
  layout: Layout;
  pinned: string | null;
  onPin: (identity: string | null) => void;
  reactions: Record<string, ShownReaction>;
  dataSaver: boolean;
  onStopSharing: () => void;
}) {
  const local = room.localParticipant;
  const people: Participant[] = [local, ...room.remoteParticipants.values()];
  const [lastSpeaker, setLastSpeaker] = useState<string | null>(null);
  useEffect(() => {
    const speaking = room.activeSpeakers.find((person) => person !== room.localParticipant);
    // oxlint-disable-next-line react/set-state-in-effect -- remembers who spoke last, from the room's events
    if (speaking) setLastSpeaker(speaking.identity);
  }, [room, version]);

  const presenter = people.find((person) => person.getTrackPublication(Track.Source.ScreenShare)?.track);
  const tile = (person: Participant, size: "grid" | "focus" | "strip") => (
    <ParticipantTile
      key={person.identity}
      participant={person}
      isLocal={person === local}
      reaction={reactions[person.identity]}
      dataSaver={dataSaver}
      pinned={pinned === person.identity}
      onPin={people.length > 1 ? () => onPin(pinned === person.identity ? null : person.identity) : undefined}
      size={size}
    />
  );

  if (presenter) {
    const name = presenter.name || presenter.identity;
    const screen = presenter.getTrackPublication(Track.Source.ScreenShare)!.track as VideoTrack;
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <section aria-label={presenter === local ? "Your shared screen" : `${name}'s shared screen`} className="relative min-h-48 flex-1 overflow-hidden rounded-card bg-primary-900">
          {presenter === local ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
              <MonitorUp aria-hidden className="size-8" />
              <p className="m-0 text-body">You're sharing your screen. Everyone in the meeting sees it.</p>
              <Button variant="secondary" onClick={onStopSharing}>Stop sharing</Button>
            </div>
          ) : (
            <VideoView track={screen} fit="contain" label={`${name}'s shared screen`} />
          )}
          <span className="absolute bottom-2 left-2 rounded-chip bg-ink px-2 py-1 text-body text-white">{presenter === local ? "You are presenting" : `${name} is presenting`}</span>
        </section>
        <h2 className="sr-only">People in the meeting</h2>
        <ul aria-label="People in the meeting" className="m-0 flex list-none gap-3 overflow-x-auto p-0 pb-1">{people.map((person) => tile(person, "strip"))}</ul>
      </div>
    );
  }

  const focus = pinned ? people.find((person) => person.identity === pinned) : layout === "speaker" && people.length > 1 ? people.find((person) => person.identity === lastSpeaker) ?? people.find((person) => person !== local) : undefined;
  if (focus) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1">{tile(focus, "focus")}</div>
        <h2 className="sr-only">People in the meeting</h2>
        <ul aria-label="People in the meeting" className="m-0 flex list-none gap-3 overflow-x-auto p-0 pb-1">{people.map((person) => tile(person, "strip"))}</ul>
      </div>
    );
  }

  return (
    <>
      <h2 className="sr-only">{people.length === 1 ? "Only you are here" : `${people.length} people in the meeting`}</h2>
      <ul aria-label="People in the meeting" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3 p-0">
        {people.map((person) => tile(person, "grid"))}
      </ul>
      {people.length === 1 && <p className="m-0 text-center text-body text-muted">Only you are here so far.</p>}
    </>
  );
}
