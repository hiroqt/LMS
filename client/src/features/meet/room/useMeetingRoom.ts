import { DisconnectReason, Room, RoomEvent, type LocalTrack } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Viewer } from "../../../shared/api/viewer";
import { describeMeetingError, fetchMeeting, joinMeeting, meetingErrorCode, startMeeting, type Meeting, type MeetingJoin } from "../api/meetings";

/** Why the page is no longer in the meeting; each has its own screen. */
export type ClosedReason = "left" | "ended" | "removed" | "locked" | "elsewhere" | "lost" | "off" | "missing" | "error";

export type MeetingPhase =
  | { kind: "loading" }
  | { kind: "prejoin"; meeting: Meeting }
  | { kind: "joining"; meeting: Meeting }
  /** The instructor hasn't started it: the page joins by itself once they do. */
  | { kind: "waiting"; meeting: Meeting }
  | { kind: "connected"; meeting: Meeting; join: MeetingJoin }
  | { kind: "closed"; reason: ClosedReason; title: string; detail?: string; meeting?: Meeting };

/** How often a waiting student asks again whether the meeting has started. */
export const WAIT_RETRY_MS = 5_000;

const closedFor = (code: string | undefined): ClosedReason | null =>
  code === "ended" ? "ended" : code === "locked" ? "locked" : code === "removed" ? "removed" : code === "meetings_off" ? "off" : null;

/**
 * The meeting page's connection (D-070): read the meeting, ask the LMS API for a join pass, wait
 * if the instructor hasn't started, connect to the media server, publish what the pre-join screen
 * chose, and turn every way of leaving into a screen. One Room per stay; leaving the page
 * disconnects it.
 */
export function useMeetingRoom({ viewer, classId, meetingId }: { viewer: Viewer; classId: string; meetingId: number }) {
  const [phase, setPhase] = useState<MeetingPhase>({ kind: "loading" });
  const [room, setRoom] = useState<Room | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leavingRef = useRef(false);
  const meetingRef = useRef<Meeting | null>(null);

  const stopTracks = useCallback(() => {
    for (const track of tracksRef.current) track.stop();
    tracksRef.current = [];
  }, []);

  const close = useCallback((reason: ClosedReason, title: string, detail?: string) => {
    if (retryRef.current) clearTimeout(retryRef.current);
    setPhase({ kind: "closed", reason, title, detail, meeting: meetingRef.current ?? undefined });
  }, []);

  // Read the meeting once, for its title and whether it is on.
  useEffect(() => {
    const controller = new AbortController();
    fetchMeeting(viewer, classId, meetingId, controller.signal).then(
      (meeting) => {
        meetingRef.current = meeting;
        if (meeting.status === "ended") close("ended", "This meeting has ended");
        else setPhase({ kind: "prejoin", meeting });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const problem = describeMeetingError(error);
        close(problem.title === "Meeting not found" ? "missing" : "error", problem.title, problem.detail || undefined);
      },
    );
    return () => controller.abort();
  }, [viewer, classId, meetingId, close]);

  // Leaving the page leaves the meeting.
  useEffect(
    () => () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      leavingRef.current = true;
      void roomRef.current?.disconnect();
      stopTracks();
    },
    [stopTracks],
  );

  const connect = useCallback(async (join: MeetingJoin) => {
    const next = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
    next.on(RoomEvent.Reconnecting, () => setReconnecting(true));
    next.on(RoomEvent.Reconnected, () => setReconnecting(false));
    next.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      setReconnecting(false);
      stopTracks();
      if (leavingRef.current) return;
      if (reason === DisconnectReason.ROOM_DELETED) close("ended", "The instructor ended the meeting");
      else if (reason === DisconnectReason.PARTICIPANT_REMOVED) close("removed", "The instructor removed you from this meeting");
      else if (reason === DisconnectReason.DUPLICATE_IDENTITY) close("elsewhere", "You joined this meeting from another tab or device", "This tab left the meeting.");
      else close("lost", "The connection to the meeting was lost", "Check your connection, then join again.");
    });
    roomRef.current = next;
    await next.connect(join.serverUrl, join.token);
    for (const track of tracksRef.current) {
      try {
        await next.localParticipant.publishTrack(track);
      } catch {
        // Not allowed (the settings changed since the pre-join screen): leave it off.
        track.stop();
      }
    }
    setRoom(next);
    setPhase({ kind: "connected", meeting: join.meeting, join });
  }, [close, stopTracks]);

  /** Joins with the tracks the pre-join screen made (camera and mic left off are not in the list). */
  const join = useCallback(async (tracks: LocalTrack[], options: { start?: boolean } = {}) => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    tracksRef.current = tracks;
    leavingRef.current = false;
    setPhase({ kind: "joining", meeting });
    const attempt = async (): Promise<void> => {
      try {
        if (options.start && meeting.status === "scheduled") meetingRef.current = await startMeeting(viewer, classId, meeting.id);
        const pass = await joinMeeting(viewer, classId, meeting.id);
        meetingRef.current = pass.meeting;
        await connect(pass);
      } catch (error) {
        const code = meetingErrorCode(error);
        if (code === "not_started") {
          setPhase({ kind: "waiting", meeting: meetingRef.current ?? meeting });
          retryRef.current = setTimeout(() => void attempt(), WAIT_RETRY_MS);
          return;
        }
        stopTracks();
        const problem = describeMeetingError(error);
        const reason = closedFor(code);
        if (reason) close(reason, problem.title, problem.detail || undefined);
        else close("error", problem.title || "Couldn't join the meeting", problem.detail || (error instanceof Error ? error.message : undefined));
      }
    };
    await attempt();
  }, [viewer, classId, connect, close, stopTracks]);

  /** Stops waiting for the instructor and goes back to the pre-join screen. */
  const cancelWaiting = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    stopTracks();
    if (meetingRef.current) setPhase({ kind: "prejoin", meeting: meetingRef.current });
  }, [stopTracks]);

  const leave = useCallback(() => {
    leavingRef.current = true;
    void roomRef.current?.disconnect();
    roomRef.current = null;
    setRoom(null);
    stopTracks();
    close("left", "You left the meeting");
  }, [close, stopTracks]);

  /** From a closed screen: back to the pre-join screen with a fresh read of the meeting. */
  const rejoin = useCallback(async () => {
    roomRef.current = null;
    setRoom(null);
    setPhase({ kind: "loading" });
    try {
      const meeting = await fetchMeeting(viewer, classId, meetingId);
      meetingRef.current = meeting;
      if (meeting.status === "ended") close("ended", "This meeting has ended");
      else setPhase({ kind: "prejoin", meeting });
    } catch (error) {
      const problem = describeMeetingError(error);
      close("error", problem.title, problem.detail || undefined);
    }
  }, [viewer, classId, meetingId, close]);

  return { phase, room, reconnecting, join, leave, rejoin, cancelWaiting };
}
