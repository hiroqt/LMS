import { describe, expect, it } from "vitest";
import { handInRules } from "../../../shared/lib/assignmentRules";
import { handInSettingsOf } from "./handIn";

describe("handInSettingsOf", () => {
  it("reads an assignment's saved settings", () => {
    const settings = handInSettingsOf({
      id: "7", moduleId: "1", title: "ER diagram", maxScore: 20, dueAt: "2026-11-20T07:59:00Z", allowLate: true, closeAt: "2026-11-22T07:59:00Z",
      allowResubmission: true, gradeRelease: "returned", submissionKinds: ["file"], allowedFileTypes: ["pdf"], maxFiles: 2, honorStatement: true,
    });
    expect(settings).toEqual({
      submissionKinds: ["file"], allowedFileTypes: ["pdf"], maxFiles: 2, honorStatement: true, dueAt: "2026-11-20T07:59:00Z", allowLate: true,
      closeAt: "2026-11-22T07:59:00Z", allowResubmission: true, gradeRelease: "returned",
    });
    expect(handInRules(settings)[0]).toBe("You can hand in up to 2 files.");
  });

  it("falls back to what the server does when a setting is not there", () => {
    expect(handInSettingsOf({ id: "7", moduleId: "1", title: "Old", maxScore: 10 })).toEqual({
      submissionKinds: ["text", "file"], allowedFileTypes: ["pdf", "word", "powerpoint", "excel", "image", "text"], maxFiles: 5, honorStatement: false,
      dueAt: null, allowLate: false, closeAt: null, allowResubmission: false, gradeRelease: "immediate",
    });
  });
});
