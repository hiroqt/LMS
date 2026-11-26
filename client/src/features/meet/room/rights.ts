import type { Participant } from "livekit-client";
import type { MeetingSettings } from "../api/meetings";

/** The sources a person can publish, as LiveKit names them. */
export type PublishSource = "camera" | "microphone" | "screen_share";

/** LiveKit's TrackSource numbers in a participant's permission (CAMERA = 1 …). */
const SOURCE_CODE: Record<PublishSource, number> = { camera: 1, microphone: 2, screen_share: 3 };

export interface PublishPermission {
  canPublish: boolean;
  /** Empty means every source (LiveKit's rule), so the API never sends it empty with canPublish (D-070). */
  canPublishSources: readonly number[];
}

/** May this person publish this source now? Before the media server says, assume yes; it refuses what isn't allowed. */
export function mayPublish(permission: PublishPermission | undefined, source: PublishSource): boolean {
  if (!permission) return true;
  if (!permission.canPublish) return false;
  return permission.canPublishSources.length === 0 || permission.canPublishSources.includes(SOURCE_CODE[source]);
}

/** Before joining: what the meeting's settings will let this person publish (the pre-join screen's toggles). */
export function rightsBeforeJoin(role: "instructor" | "student", settings: MeetingSettings): Record<PublishSource, boolean> {
  if (role === "instructor") return { camera: true, microphone: true, screen_share: true };
  return { camera: settings.studentsMayVideo, microphone: settings.studentsMayUnmute, screen_share: settings.studentsMayShareScreen };
}

/** Why a control is off, in words for the person who can't use it. */
export const notAllowedText: Record<PublishSource, string> = {
  camera: "The instructor has turned off cameras for students.",
  microphone: "The instructor decides when students can speak.",
  screen_share: "The instructor hasn't let students share their screen.",
};

/** The role the LMS API put in the join pass (D-070). */
export const isHost = (participant: Pick<Participant, "attributes">) => participant.attributes["lms.role"] === "instructor";

/** When the person raised their hand (the API sets it, D-070), or null. */
export const handRaisedAt = (participant: Pick<Participant, "attributes">): string | null => participant.attributes["lms.hand"] || null;

/** The instructor let this student speak while students may not turn on their own mic. */
export const isLetSpeak = (participant: Pick<Participant, "attributes">) => participant.attributes["lms.letSpeak"] === "true";
