import { Track, type Participant, type RemoteAudioTrack } from "livekit-client";
import { ArrowLeft, Hourglass, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Viewer } from "../../../shared/api/viewer";
import { Button } from "../../../shared/ui/Button";
import { ControlBar } from "./ControlBar";
import { ParticipantTile } from "./ParticipantTile";
import { PreJoin } from "./PreJoin";
import { useMeetingRoom, type MeetingPhase } from "./useMeetingRoom";
import { useRoomVersion } from "./useRoomVersion";
import { AudioView } from "./VideoView";

export interface MeetingRoomPageProps {
  viewer: Viewer;
  /** Shown on the pre-join screen; the media server gets the name from the LMS API. */
  viewerName: string;
  classId: string;
  meetingId: number;
  /** The class's name, under the meeting's title. */
  className: string;
  /** Back to the class page. */
  onExit: () => void;
}

/**
 * The meeting page (D-070): full screen, outside the sidebar shell, in the same tab as the LMS
 * (the demo identity is per tab). Pre-join, then the grid and the controls; every way out of the
 * meeting has its own screen with a way back. The role app's Toaster is above it.
 */
export default function MeetingRoomPage({ viewer, viewerName, classId, meetingId, className, onExit }: MeetingRoomPageProps) {
  const meet = useMeetingRoom({ viewer, classId, meetingId });
  const { phase } = meet;
  const heading = useRef<HTMLHeadingElement>(null);
  const title = phase.kind === "loading" ? "Meeting" : phase.kind === "closed" ? phase.meeting?.title ?? "Meeting" : phase.meeting.title;

  // Outside the shell, the page moves focus to its h1 itself (C-004).
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    document.title = `${title} · ${className}`;
  }, [title, className]);

  return (
    <div className="@container flex min-h-dvh flex-col bg-canvas font-sans text-ink">
      <header className="flex min-h-touch items-center gap-3 border-b border-line bg-surface px-3 py-2 sm:px-4">
        {/* One control per action (C-015): in the meeting, Leave is in the controls; after it, the screen has its own way back. */}
        {phase.kind !== "connected" && phase.kind !== "closed" && (
          <Button variant="ghost" onClick={phase.kind === "waiting" ? () => { meet.cancelWaiting(); onExit(); } : onExit} icon={<ArrowLeft aria-hidden className="size-4" />}>
            Back to class
          </Button>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 ref={heading} tabIndex={-1} className="m-0 truncate text-card-title font-semibold outline-none">{title}</h1>
          <p className="m-0 truncate text-body text-muted">{className}</p>
        </div>
      </header>
      {meet.reconnecting && (
        <p role="status" className="m-0 bg-warning-soft px-4 py-2 text-center text-body font-medium text-warning">Reconnecting… Your connection dropped; the meeting carries on when it's back.</p>
      )}
      <Body phase={phase} meet={meet} viewer={viewer} viewerName={viewerName} onExit={onExit} />
    </div>
  );
}

function Body({ phase, meet, viewer, viewerName, onExit }: { phase: MeetingPhase; meet: ReturnType<typeof useMeetingRoom>; viewer: Viewer; viewerName: string; onExit: () => void }) {
  switch (phase.kind) {
    case "loading":
      return <p role="status" className="m-0 flex-1 p-6 text-body text-muted">Loading the meeting…</p>;
    case "prejoin":
    case "joining":
      return (
        <main className="flex flex-1 items-center">
          <PreJoin meeting={phase.meeting} role={viewer.role} name={viewerName} busy={phase.kind === "joining"} onJoin={(tracks, options) => void meet.join(tracks, options)} />
        </main>
      );
    case "waiting":
      return (
        <main className="flex flex-1 items-center justify-center p-6">
          <section aria-labelledby="waiting-title" className="flex max-w-prose flex-col items-center gap-3 text-center">
            <Hourglass aria-hidden className="size-8 text-muted" />
            <h2 id="waiting-title" className="m-0 text-section font-semibold">Waiting for the instructor</h2>
            <p role="status" className="m-0 text-body text-muted">You'll join as soon as the instructor starts the meeting. Keep this page open.</p>
            <Button variant="secondary" onClick={meet.cancelWaiting}>Stop waiting</Button>
          </section>
        </main>
      );
    case "connected":
      return meet.room ? <InMeeting meet={meet} /> : null;
    case "closed":
      return (
        <main className="flex flex-1 items-center justify-center p-6">
          <section aria-labelledby="closed-title" className="flex max-w-prose flex-col items-center gap-3 text-center">
            <h2 id="closed-title" className="m-0 text-section font-semibold">{phase.title}</h2>
            {phase.detail && <p className="m-0 text-body text-muted">{phase.detail}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {(phase.reason === "left" || phase.reason === "lost" || phase.reason === "elsewhere") && <Button onClick={() => void meet.rejoin()}>Join again</Button>}
              <Button variant={phase.reason === "left" || phase.reason === "lost" ? "secondary" : "primary"} onClick={onExit}>Back to class</Button>
            </div>
          </section>
        </main>
      );
  }
}

function InMeeting({ meet }: { meet: ReturnType<typeof useMeetingRoom> }) {
  const room = meet.room!;
  useRoomVersion(room);
  const people: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
  const sounds = [...room.remoteParticipants.values()].flatMap((person) => {
    const track = person.getTrackPublication(Track.Source.Microphone)?.track;
    return track ? [{ key: `${person.identity}:${track.sid}`, track: track as RemoteAudioTrack }] : [];
  });
  return (
    <>
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        {!room.canPlaybackAudio && (
          <div role="status" className="flex flex-wrap items-center justify-center gap-3 rounded-control bg-warning-soft p-3 text-body text-warning">
            Your browser paused the meeting's sound.
            <Button variant="secondary" onClick={() => void room.startAudio()} icon={<Volume2 aria-hidden className="size-4" />}>Turn on sound</Button>
          </div>
        )}
        <h2 className="sr-only">{people.length === 1 ? "Only you are here" : `${people.length} people in the meeting`}</h2>
        <ul aria-label="People in the meeting" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3 p-0">
          {people.map((person) => <ParticipantTile key={person.identity} participant={person} isLocal={person === room.localParticipant} />)}
        </ul>
        {people.length === 1 && <p className="m-0 text-center text-body text-muted">Only you are here so far.</p>}
        {sounds.map((sound) => <AudioView key={sound.key} track={sound.track} />)}
      </main>
      <ControlBar room={room} onLeave={meet.leave} />
    </>
  );
}
