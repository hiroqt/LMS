import type { Room } from "livekit-client";
import { useEffect, useRef } from "react";
import type { RoomInfo } from "./metadata";
import { mayPublish } from "./rights";

/**
 * Tells people, in the line above the stage, when the instructor changes something that affects
 * them: a student's mic, camera, or screen allowed or taken away; the meeting locked; the chat
 * saved. Nothing is said for the state the person joined with.
 */
export function useRightsNotices(room: Room, info: RoomInfo, role: "instructor" | "student", version: number, say: (text: string) => void) {
  const before = useRef<{ mic: boolean; camera: boolean; screen: boolean; locked: boolean; saveChat: boolean } | null>(null);
  useEffect(() => {
    const permission = room.localParticipant.permissions;
    const now = {
      mic: mayPublish(permission, "microphone"),
      camera: mayPublish(permission, "camera"),
      screen: mayPublish(permission, "screen_share"),
      locked: info.locked,
      saveChat: info.saveChat,
    };
    const was = before.current;
    before.current = now;
    if (!was) return;
    const lines: string[] = [];
    if (role === "student") {
      if (now.mic !== was.mic) lines.push(now.mic ? "You can turn on your mic now." : "The instructor turned off your mic.");
      if (now.camera !== was.camera) lines.push(now.camera ? "Students may turn on their camera now." : "The instructor turned off students' cameras.");
      if (now.screen !== was.screen) lines.push(now.screen ? "Students may share their screen now." : "Students can no longer share their screen.");
    }
    if (now.locked !== was.locked) lines.push(now.locked ? "The meeting is locked. No one else can join." : "The meeting is open again.");
    if (now.saveChat !== was.saveChat) lines.push(now.saveChat ? "The chat is being saved from now on." : "The chat is no longer being saved.");
    if (lines.length) say(lines.join(" "));
  }, [room, info.locked, info.saveChat, role, version, say]);
}
