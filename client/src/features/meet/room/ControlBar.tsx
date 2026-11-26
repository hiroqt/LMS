import type { Room } from "livekit-client";
import { Ellipsis, Hand, LayoutGrid, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, UserRound, UsersRound, Video, VideoOff, WifiLow } from "lucide-react";
import { Button } from "../../../shared/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../shared/ui/Popover";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import { cn } from "../../../shared/lib/cn";
import { MediaToggle } from "./MediaToggle";
import type { Reaction } from "./metadata";
import { ReactionsButton } from "./ReactionsButton";
import { mayPublish, notAllowedText, type PublishSource } from "./rights";
import type { Layout } from "./Stage";

const failedText: Record<PublishSource, string> = {
  camera: "Your camera couldn't be turned on. Check that no other app is using it and that the browser may use it.",
  microphone: "Your microphone couldn't be turned on. Check that the browser may use it.",
  screen_share: "Your screen wasn't shared.",
};

/** Phones and most tablets can't share a screen from the browser; the control isn't shown there. */
const canShareScreen = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function" && !/Android|iPhone|iPad/i.test(navigator.userAgent);

export type Panel = "chat" | "people";

/** The meeting's controls along the bottom. */
export function ControlBar({ room, compact, panel, onPanel, unread, handRaised, onHand, onReact, dataSaver, onDataSaver, layout, onLayout, onLeave, onNotice }: {
  room: Room;
  /** Says something above the meeting; a toast would cover these controls on a phone. */
  onNotice: (text: string, tone?: "warning" | "danger") => void;
  /** Narrow screens: icons, with the names read and shown as tooltips. */
  compact: boolean;
  panel: Panel | null;
  onPanel: (panel: Panel | null) => void;
  unread: number;
  handRaised: boolean;
  onHand: () => void;
  onReact: (reaction: Reaction) => void;
  dataSaver: boolean;
  onDataSaver: (on: boolean) => void;
  layout: Layout;
  onLayout: (layout: Layout) => void;
  onLeave: () => void;
}) {
  const local = room.localParticipant;
  const permission = local.permissions;
  const micOn = local.isMicrophoneEnabled;
  const cameraOn = local.isCameraEnabled;
  const sharing = local.isScreenShareEnabled;

  const toggle = async (source: PublishSource, on: boolean) => {
    if (!on && !mayPublish(permission, source)) {
      onNotice(notAllowedText[source]);
      return;
    }
    try {
      if (source === "microphone") await local.setMicrophoneEnabled(!on);
      else if (source === "camera") await local.setCameraEnabled(!on, { resolution: { width: 960, height: 540 } });
      else await local.setScreenShareEnabled(!on, { audio: true });
    } catch (error) {
      // Closing the browser's "choose what to share" box is a choice, not a failure.
      if (source === "screen_share" && error instanceof Error && error.name === "NotAllowedError") return;
      onNotice(failedText[source], "danger");
    }
  };

  return (
    <nav aria-label="Meeting controls" className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface px-2 py-3">
      <MediaToggle label="Microphone" labelHidden={compact} on={micOn} allowed={micOn || mayPublish(permission, "microphone")} onIcon={<Mic />} offIcon={<MicOff />} onPress={() => void toggle("microphone", micOn)} />
      <MediaToggle label="Camera" labelHidden={compact} on={cameraOn} allowed={cameraOn || mayPublish(permission, "camera")} onIcon={<Video />} offIcon={<VideoOff />} onPress={() => void toggle("camera", cameraOn)} />
      {canShareScreen() && (
        <MediaToggle label="Share screen" tone="plain" labelHidden={compact} on={sharing} allowed={sharing || mayPublish(permission, "screen_share")} onIcon={<MonitorUp />} onPress={() => void toggle("screen_share", sharing)} />
      )}
      <MediaToggle label="Raise hand" tone="plain" labelHidden={compact} on={handRaised} onIcon={<Hand />} onPress={onHand} />
      <ReactionsButton onSend={onReact} labelHidden={compact} />
      <MediaToggle label="Chat" tone="plain" labelHidden={compact} on={panel === "chat"} onIcon={<MessageSquare />} onPress={() => onPanel(panel === "chat" ? null : "chat")} badge={unread > 0 ? String(unread) : undefined} badgeSuffix="unread" />
      <MediaToggle label="People" tone="plain" labelHidden={compact} on={panel === "people"} onIcon={<UsersRound />} onPress={() => onPanel(panel === "people" ? null : "people")} />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={compact ? "More" : undefined}
            className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 font-sans text-body font-semibold text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Ellipsis aria-hidden className="size-5" />
            <span className={cn(compact && "sr-only")}>More</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" aria-label="More meeting options" className="flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-4">
          <div className="flex flex-col gap-2">
            <MediaToggle label="Data saver" tone="plain" on={dataSaver} onIcon={<WifiLow />} onPress={() => onDataSaver(!dataSaver)} />
            <p className="m-0 text-body text-muted">Stops other people's video. You still hear everyone and see shared screens.</p>
          </div>
          <SegmentedControl
            label="Layout"
            value={layout}
            onChange={onLayout}
            options={[
              { value: "grid", label: "Grid", icon: <LayoutGrid aria-hidden className="size-4" /> },
              { value: "speaker", label: "Speaker", icon: <UserRound aria-hidden className="size-4" /> },
            ]}
          />
        </PopoverContent>
      </Popover>
      <Button variant="danger" onClick={onLeave} icon={<PhoneOff aria-hidden className="size-4" />} className="ml-1">Leave</Button>
    </nav>
  );
}
