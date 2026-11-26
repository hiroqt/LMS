import { describe, expect, it } from "vitest";
import { isHost, mayPublish, rightsBeforeJoin } from "./rights";

describe("mayPublish", () => {
  it("reads LiveKit's source numbers (camera 1, microphone 2, screen share 3)", () => {
    const cameraOnly = { canPublish: true, canPublishSources: [1] };
    expect(mayPublish(cameraOnly, "camera")).toBe(true);
    expect(mayPublish(cameraOnly, "microphone")).toBe(false);
    expect(mayPublish(cameraOnly, "screen_share")).toBe(false);
  });

  it("follows LiveKit: an empty list is everything, and can't-publish is nothing", () => {
    expect(mayPublish({ canPublish: true, canPublishSources: [] }, "microphone")).toBe(true);
    expect(mayPublish({ canPublish: false, canPublishSources: [] }, "microphone")).toBe(false);
    expect(mayPublish({ canPublish: false, canPublishSources: [2] }, "microphone")).toBe(false);
  });

  it("assumes yes before the media server has said; it refuses what isn't allowed", () => {
    expect(mayPublish(undefined, "camera")).toBe(true);
  });
});

describe("rightsBeforeJoin", () => {
  const settings = { studentsJoinMuted: true, studentsMayUnmute: false, studentsMayVideo: true, studentsMayShareScreen: false, studentsMayChat: true, saveChat: false };
  it("gives students what the meeting's settings allow, and the instructor everything", () => {
    expect(rightsBeforeJoin("student", settings)).toEqual({ camera: true, microphone: false, screen_share: false });
    expect(rightsBeforeJoin("instructor", settings)).toEqual({ camera: true, microphone: true, screen_share: true });
  });
});

describe("isHost", () => {
  it("is the role the LMS API put in the join pass", () => {
    expect(isHost({ attributes: { "lms.role": "instructor" } })).toBe(true);
    expect(isHost({ attributes: { "lms.role": "student" } })).toBe(false);
    expect(isHost({ attributes: {} })).toBe(false);
  });
});
