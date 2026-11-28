import { Track, type LocalVideoTrack, type Participant, type RemoteAudioTrack } from "livekit-client";
import { ArrowLeft, Hourglass, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Viewer } from "../../../shared/api/viewer";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { useNetworkStatus } from "../../../shared/hooks/useNetworkStatus";
import { usePersistentState } from "../../../shared/hooks/usePersistentState";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { IconButton } from "../../../shared/ui/IconButton";
import { cn } from "../../../shared/lib/cn";
import { describeMeetingError, hostAction, letSpeak as letSpeakApi, muteEveryone, setHand, updateMeeting } from "../api/meetings";
import { BLUR_KEY, canBlur, setBlur } from "./blur";
import { ChatPanel } from "./ChatPanel";
import { ControlBar, type Panel } from "./ControlBar";
import { parseRoomInfo } from "./metadata";
import { HostPanel } from "./HostPanel";
import { PeoplePanel, type HostTools } from "./PeoplePanel";
import { handRaisedAt } from "./rights";
import { Stage, type Layout } from "./Stage";
import { useAnnouncements } from "./useAnnouncements";
import { useAskUnmute } from "./useAskUnmute";
import { useRightsNotices } from "./useRightsNotices";
import { useChat } from "./useChat";
import { useDataSaver } from "./useDataSaver";
import { useReactions } from "./useReactions";
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
 * The meeting page (D-072): full screen, outside the sidebar shell, in the same tab as the LMS
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
      return meet.room ? <InMeeting meet={meet} viewer={viewer} classId={phase.meeting.classId} meetingId={phase.meeting.id} /> : null;
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

function InMeeting({ meet, viewer, classId, meetingId }: { meet: ReturnType<typeof useMeetingRoom>; viewer: Viewer; classId: string; meetingId: number }) {
  const room = meet.room!;
  const version = useRoomVersion(room);
  const network = useNetworkStatus();
  const [notice, setNotice] = useState<{ text: string; tone: "warning" | "danger"; at: number } | null>(null);
  const say = useCallback((text: string, tone: "warning" | "danger" = "warning") => setNotice({ text, tone, at: Date.now() }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice((current) => (current?.at === notice.at ? null : current)), 8_000);
    return () => clearTimeout(timer);
  }, [notice]);
  const wide = useMediaQuery("(min-width: 64rem)");
  const compact = !useMediaQuery("(min-width: 48rem)");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [layout, setLayout] = useState<Layout>("grid");
  const [pinned, setPinned] = useState<string | null>(null);
  const [dataSaver, setDataSaver] = useState(false);
  const [saverHint, setSaverHint] = useState(true);
  const info = parseRoomInfo(room.metadata);
  const chat = useChat({ room, viewer, classId, meetingId, saveChat: info.saveChat, open: panel === "chat" });
  const reactions = useReactions(room);
  const announcement = useAnnouncements(room, reactions.latest);
  useDataSaver(room, dataSaver, version);

  const local = room.localParticipant;
  const people: Participant[] = [local, ...room.remoteParticipants.values()];
  const pinnedHere = pinned && people.some((person) => person.identity === pinned) ? pinned : null;
  const handRaised = handRaisedAt(local) !== null;
  const sounds = [...room.remoteParticipants.values()].flatMap((person) =>
    [Track.Source.Microphone, Track.Source.ScreenShareAudio].flatMap((source) => {
      const track = person.getTrackPublication(source)?.track;
      return track ? [{ key: `${person.identity}:${track.sid}`, track: track as RemoteAudioTrack }] : [];
    }),
  );
  const failed = (error: unknown) => {
    const problem = describeMeetingError(error);
    say([problem.title, problem.detail].filter(Boolean).join(" "), "danger");
  };
  const isHostHere = viewer.role === "instructor";
  const ask = useAskUnmute(room);
  const [ending, setEnding] = useState(false);
  useRightsNotices(room, info, viewer.role, version, say);

  // Background blur follows the person's choice whenever their camera is on (it was set on the pre-join screen).
  const [blurAvailable] = useState(canBlur);
  const [blurChoice, setBlurChoice] = usePersistentState<boolean>(BLUR_KEY, false);
  const [blurBusy, setBlurBusy] = useState(false);
  const cameraTrack = local.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  useEffect(() => {
    if (!blurAvailable || !blurChoice || !cameraTrack || cameraTrack.getProcessor()) return;
    setBlur(cameraTrack, true).catch(() => say("Background blur couldn't start in this browser. Your camera still works without it."));
  }, [blurAvailable, blurChoice, cameraTrack, say]);
  const toggleBlur = async () => {
    if (!cameraTrack) return;
    setBlurBusy(true);
    try {
      await setBlur(cameraTrack, !blurChoice);
      setBlurChoice(!blurChoice);
    } catch {
      say("Background blur couldn't start in this browser. Your camera still works without it.");
    } finally {
      setBlurBusy(false);
    }
  };

  // The instructor's controls, each saying what went wrong in the line above the stage.
  const run = async (work: Promise<unknown>): Promise<void> => {
    try {
      await work;
    } catch (error) {
      failed(error);
    }
  };
  const host: HostTools | undefined = isHostHere
    ? {
        studentsMayUnmute: info.students.mayUnmute,
        act: (personId, action) => run(hostAction(viewer, classId, meetingId, personId, action)),
        letSpeak: (personId, allowed) => run(letSpeakApi(viewer, classId, meetingId, personId, allowed)),
        muteAll: () => run(muteEveryone(viewer, classId, meetingId).then(({ muted }) => say(muted === 1 ? "1 microphone muted." : `${muted} microphones muted.`))),
      }
    : undefined;
  const panelTitle = panel === "chat" ? "Chat" : panel === "host" ? "Host controls" : "People";
  const panelBody =
    panel === "chat" ? (
      <ChatPanel messages={chat.messages} onSend={chat.send} saving={info.saveChat} canWrite={isHostHere || info.students.mayChat} viewerId={viewer.id} />
    ) : panel === "host" && isHostHere ? (
      <HostPanel info={info} onChange={(change) => run(updateMeeting(viewer, classId, meetingId, change))} />
    ) : (
      <PeoplePanel people={people} localIdentity={local.identity} host={host} />
    );

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
          <p role="status" className={notice ? cn("m-0 rounded-control p-3 text-body", notice.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning") : "sr-only"}>
            {notice?.text}
          </p>
          {ask.from && !local.isMicrophoneEnabled && (
            <section aria-label="Asked to unmute" className="flex flex-wrap items-center gap-3 rounded-control bg-info-soft p-3 text-body text-info">
              <span className="min-w-0 flex-1">{ask.from} asks you to turn on your mic.</span>
              <Button
                variant="secondary"
                onClick={() => {
                  ask.dismiss();
                  local.setMicrophoneEnabled(true).catch(() => say("Your microphone couldn't be turned on. Check that the browser may use it.", "danger"));
                }}
              >
                Turn on mic
              </Button>
              <Button variant="ghost" onClick={ask.dismiss}>Not now</Button>
            </section>
          )}
          {!room.canPlaybackAudio && (
            <div role="status" className="flex flex-wrap items-center justify-center gap-3 rounded-control bg-warning-soft p-3 text-body text-warning">
              Your browser paused the meeting's sound.
              <Button variant="secondary" onClick={() => void room.startAudio()} icon={<Volume2 aria-hidden className="size-4" />}>Turn on sound</Button>
            </div>
          )}
          {network.slow && !dataSaver && saverHint && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-control bg-info-soft p-3 text-body text-info">
              <span className="min-w-0 flex-1">Your connection is slow. Data saver stops other people's video and keeps their sound and shared screens.</span>
              <Button variant="secondary" onClick={() => setDataSaver(true)}>Turn on Data saver</Button>
              <Button variant="ghost" onClick={() => setSaverHint(false)}>Not now</Button>
            </div>
          )}
          <Stage room={room} version={version} layout={layout} pinned={pinnedHere} onPin={setPinned} reactions={reactions.shown} dataSaver={dataSaver} onStopSharing={() => void local.setScreenShareEnabled(false)} />
          {sounds.map((sound) => <AudioView key={sound.key} track={sound.track} />)}
          <p role="status" className="sr-only">{announcement}</p>
        </main>
        {wide && panel && (
          <aside aria-labelledby="meeting-panel-title" className="flex w-88 shrink-0 flex-col gap-3 border-l border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="meeting-panel-title" className="m-0 text-section font-semibold">{panelTitle}</h2>
              <IconButton label={`Close ${panelTitle.toLowerCase()}`} onClick={() => setPanel(null)}><X /></IconButton>
            </div>
            {panelBody}
          </aside>
        )}
      </div>
      {/* On narrow screens the panel is a sheet; it exists only there (C-010). */}
      <Dialog open={!wide && panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent title={panelTitle} className="flex max-h-[85dvh] flex-col">{panelBody}</DialogContent>
      </Dialog>
      <ControlBar
        room={room}
        compact={compact}
        panel={panel}
        onPanel={setPanel}
        unread={chat.unread}
        handRaised={handRaised}
        onHand={() => setHand(viewer, classId, meetingId, !handRaised).catch(failed)}
        onReact={(reaction) => void reactions.send(reaction).catch(failed)}
        dataSaver={dataSaver}
        onDataSaver={setDataSaver}
        layout={layout}
        onLayout={setLayout}
        onLeave={meet.leave}
        onNotice={say}
        onEnd={isHostHere ? () => setEnding(true) : undefined}
        blur={blurAvailable ? { on: blurChoice, busy: blurBusy, toggle: () => void toggleBlur() } : undefined}
      />
      {isHostHere && (
        <Dialog open={ending} onOpenChange={setEnding}>
          <DialogContent
            title="End the meeting for everyone?"
            description="Everyone leaves now, and the meeting can't be joined again. You can start a new one from the class page."
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep it going</Button></DialogClose>
                <Button variant="danger" onClick={() => { setEnding(false); void meet.end().catch(failed); }}>End the meeting</Button>
              </>
            }
          />
        </Dialog>
      )}
    </>
  );
}
