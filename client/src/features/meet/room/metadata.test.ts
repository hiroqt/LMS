import { describe, expect, it } from "vitest";
import { chatIdentity, linkParts, parseRoomInfo, readChatMessage, readReaction } from "./metadata";
import { orderPeople } from "./people";

const bytes = (value: unknown) => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));

describe("parseRoomInfo", () => {
  it("reads what the API keeps in the room's metadata", () => {
    const info = parseRoomInfo(JSON.stringify({ title: "Lecture 7", locked: true, saveChat: true, students: { mayChat: false, mayUnmute: false } }));
    expect(info).toMatchObject({ title: "Lecture 7", locked: true, saveChat: true, students: { mayChat: false, mayUnmute: false, mayVideo: true, joinMuted: true } });
  });

  it("keeps the defaults for missing or broken metadata", () => {
    expect(parseRoomInfo(undefined).saveChat).toBe(false);
    expect(parseRoomInfo("not json").students.mayChat).toBe(true);
    expect(parseRoomInfo(JSON.stringify({ saveChat: "yes" })).saveChat).toBe(false);
  });
});

describe("readChatMessage", () => {
  it("reads the server's chat message and refuses anything else", () => {
    const message = { key: "k1", id: 4, senderId: "s0", senderName: "Alex Rivera", senderRole: "student", text: "Hi", sentAt: "2026-10-23T01:00:00Z", saved: true };
    expect(readChatMessage(bytes(message))).toEqual(message);
    expect(readChatMessage(bytes({ text: "no key" }))).toBeNull();
    expect(readChatMessage(bytes("{broken"))).toBeNull();
  });

  it("counts the sent copy and the broadcast copy of a saved message once", () => {
    const sent = readChatMessage(bytes({ key: "a", id: 7, senderName: "x", text: "t", sentAt: "s" }))!;
    const loaded = readChatMessage(bytes({ key: "saved-7", id: 7, senderName: "x", text: "t", sentAt: "s" }))!;
    expect(chatIdentity(sent)).toBe(chatIdentity(loaded));
    const unsaved = readChatMessage(bytes({ key: "b", id: null, senderName: "x", text: "t", sentAt: "s" }))!;
    expect(chatIdentity(unsaved)).toBe("key:b");
  });
});

describe("readReaction", () => {
  it("shows only the six reactions on the list", () => {
    expect(readReaction(bytes({ emoji: "👏" }))?.name).toBe("Clapping");
    expect(readReaction(bytes({ emoji: "<img src=x>" }))).toBeNull();
    expect(readReaction(bytes("oops"))).toBeNull();
  });
});

describe("linkParts", () => {
  it("makes http and https links, leaving trailing punctuation and everything else as text", () => {
    expect(linkParts("Notes: https://example.org/a?b=1. Thanks")).toEqual([
      { text: "Notes: " },
      { text: "https://example.org/a?b=1", href: "https://example.org/a?b=1" },
      { text: ". Thanks" },
    ]);
    expect(linkParts("javascript:alert(1) and <b>bold</b>")).toEqual([{ text: "javascript:alert(1) and <b>bold</b>" }]);
    expect(linkParts("")).toEqual([]);
  });
});

describe("orderPeople", () => {
  const person = (identity: string, name: string, attributes: Record<string, string> = {}) => ({ identity, name, attributes });
  it("puts raised hands first in the order they went up, then the instructor, then names", () => {
    const ordered = orderPeople([
      person("s2", "Zed"),
      person("t", "Angela Reyes", { "lms.role": "instructor" }),
      person("s3", "Bea", { "lms.hand": "2026-10-23T01:05:00Z" }),
      person("s1", "Alex", { "lms.hand": "2026-10-23T01:01:00Z" }),
      person("s4", "Carl"),
    ]);
    expect(ordered.map((p) => p.name)).toEqual(["Alex", "Bea", "Angela Reyes", "Carl", "Zed"]);
  });
});
