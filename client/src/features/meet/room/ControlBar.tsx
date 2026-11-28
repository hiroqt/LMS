import type { Room } from "livekit-client";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "../../../shared/ui/Button";
import { useToast } from "../../../shared/ui/toast/useToast";
import { MediaToggle } from "./MediaToggle";
import { mayPublish, notAllowedText, type PublishSource } from "./rights";

const failedText: Record<PublishSource, string> = {
  camera: "Your camera couldn't be turned on. Check that no other app is using it and that the browser may use it.",
  microphone: "Your microphone couldn't be turned on. Check that the browser may use it.",
  screen_share: "Your screen couldn't be shared.",
};

/** The meeting's controls along the bottom: mic, camera, and Leave. More come in Phase 2b and 2c. */
export function ControlBar({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const toast = useToast();
  const local = room.localParticipant;
  const permission = local.permissions;
  const micOn = local.isMicrophoneEnabled;
  const cameraOn = local.isCameraEnabled;

  const toggle = async (source: PublishSource, on: boolean) => {
    if (!on && !mayPublish(permission, source)) {
      toast.show({ title: notAllowedText[source], group: "meeting-rights" });
      return;
    }
    try {
      if (source === "microphone") await local.setMicrophoneEnabled(!on);
      else if (source === "camera") await local.setCameraEnabled(!on, { resolution: { width: 960, height: 540 } });
    } catch {
      toast.show({ title: failedText[source], tone: "danger", group: "meeting-device" });
    }
  };

  return (
    <nav aria-label="Meeting controls" className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface px-3 py-3">
      <MediaToggle label="Microphone" on={micOn} allowed={micOn || mayPublish(permission, "microphone")} onIcon={<Mic />} offIcon={<MicOff />} onPress={() => void toggle("microphone", micOn)} />
      <MediaToggle label="Camera" on={cameraOn} allowed={cameraOn || mayPublish(permission, "camera")} onIcon={<Video />} offIcon={<VideoOff />} onPress={() => void toggle("camera", cameraOn)} />
      <Button variant="danger" onClick={onLeave} icon={<PhoneOff aria-hidden className="size-4" />} className="ml-2">Leave</Button>
    </nav>
  );
}

