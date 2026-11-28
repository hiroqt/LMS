import type { ChatMessage } from "../api/meetings";

/** What the LMS API keeps in the room's metadata (server: MeetingRooms.Metadata). */
export interface RoomInfo {
  title: string;
  locked: boolean;
  saveChat: boolean;
  students: { joinMuted: boolean; mayUnmute: boolean; mayVideo: boolean; mayShareScreen: boolean; mayChat: boolean };
}

const fallback: RoomInfo = {
  title: "",
  locked: false,
  saveChat: false,
  students: { joinMuted: true, mayUnmute: true, mayVideo: true, mayShareScreen: false, mayChat: true },
};

const bool = (value: unknown, otherwise: boolean) => (typeof value === "boolean" ? value : otherwise);

/** Reads the room's metadata; anything missing or malformed keeps its default. */
export function parseRoomInfo(metadata: string | undefined): RoomInfo {
  if (!metadata) return fallback;
  try {
    const raw = JSON.parse(metadata) as Record<string, unknown>;
    const students = (raw.students && typeof raw.students === "object" ? raw.students : {}) as Record<string, unknown>;
    return {
      title: typeof raw.title === "string" ? raw.title : "",
      locked: bool(raw.locked, false),
      saveChat: bool(raw.saveChat, false),
      students: {
        joinMuted: bool(students.joinMuted, true),
        mayUnmute: bool(students.mayUnmute, true),
        mayVideo: bool(students.mayVideo, true),
        mayShareScreen: bool(students.mayShareScreen, false),
        mayChat: bool(students.mayChat, true),
      },
    };
  } catch {
    return fallback;
  }
}

/** Data-message topics. The server's are trusted only from the server (no sender, D-070). */
export const TOPIC = { chat: "lms.chat", askUnmute: "lms.ask-unmute", reaction: "lms.reaction" } as const;

/** A chat message from a data message, or null when it isn't one. */
export function readChatMessage(payload: Uint8Array): ChatMessage | null {
  try {
    const raw = JSON.parse(new TextDecoder().decode(payload)) as Partial<ChatMessage>;
    if (typeof raw.key !== "string" || typeof raw.text !== "string" || typeof raw.senderName !== "string" || typeof raw.sentAt !== "string") return null;
    return {
      key: raw.key,
      id: typeof raw.id === "number" ? raw.id : null,
      senderId: typeof raw.senderId === "string" ? raw.senderId : "",
      senderName: raw.senderName,
      senderRole: raw.senderRole === "instructor" ? "instructor" : "student",
      text: raw.text,
      sentAt: raw.sentAt,
      saved: raw.saved === true,
    };
  } catch {
    return null;
  }
}

/** The same message seen twice (sent, then broadcast; or saved and loaded) counts once. */
export const chatIdentity = (message: ChatMessage) => (message.id !== null ? `id:${message.id}` : `key:${message.key}`);

/** The reactions anyone can send, with names for people who can't see them. */
export const REACTIONS = [
  { emoji: "👍", name: "Thumbs up" },
  { emoji: "👏", name: "Clapping" },
  { emoji: "😂", name: "Laughing" },
  { emoji: "❤️", name: "Heart" },
  { emoji: "🎉", name: "Celebrate" },
  { emoji: "❓", name: "Question" },
] as const;

export type Reaction = (typeof REACTIONS)[number];

/** A reaction from another person's data message, or null for anything not on the list. */
export function readReaction(payload: Uint8Array): Reaction | null {
  try {
    const raw = JSON.parse(new TextDecoder().decode(payload)) as { emoji?: unknown };
    return REACTIONS.find((reaction) => reaction.emoji === raw.emoji) ?? null;
  } catch {
    return null;
  }
}

/** Splits text into plain parts and http(s) links, so links can be clickable without HTML from the message. */
export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], href: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
