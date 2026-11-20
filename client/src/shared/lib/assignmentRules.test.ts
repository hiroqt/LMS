import { describe, expect, it } from "vitest";
import { handInRules, latePenaltyRule, type HandInSettings } from "./assignmentRules";

const base: HandInSettings = {
  submissionKinds: ["text", "file"], allowedFileTypes: ["pdf", "word", "powerpoint", "excel", "image", "text"], maxFiles: 5, honorStatement: false,
  dueAt: null, allowLate: false, closeAt: null, allowResubmission: false, gradeRelease: "immediate", latePenaltyPercentPerDay: 0, latePenaltyMaxPercent: 100,
};

describe("latePenaltyRule", () => {
  const late = { dueAt: "2026-11-20T07:59:00Z", allowLate: true, latePenaltyPercentPerDay: 10, latePenaltyMaxPercent: 50 };

  it("words the penalty per day and its cap", () => {
    expect(latePenaltyRule(late)).toBe("Late work loses 10% of its score for each day late, up to 50%.");
    expect(latePenaltyRule({ ...late, latePenaltyMaxPercent: 100 })).toBe("Late work loses 10% of its score for each day late.");
    // A cap no higher than one day's penalty is all that is ever taken, so "for each day" is not said.
    expect(latePenaltyRule({ ...late, latePenaltyMaxPercent: 10 })).toBe("Late work loses 10% of its score.");
    expect(latePenaltyRule({ ...late, latePenaltyPercentPerDay: 20, latePenaltyMaxPercent: 10 })).toBe("Late work loses 10% of its score.");
    expect(latePenaltyRule({ ...late, latePenaltyPercentPerDay: 100, latePenaltyMaxPercent: 100 })).toBe("Late work loses 100% of its score.");
  });

  it("says nothing without a penalty, a due date, or late work", () => {
    expect(latePenaltyRule({ ...late, latePenaltyPercentPerDay: 0 })).toBeNull();
    expect(latePenaltyRule({ ...late, dueAt: null })).toBeNull();
    expect(latePenaltyRule({ ...late, allowLate: false })).toBeNull();
  });

  it("is one of the rules students read, after the late-work rule", () => {
    const rules = handInRules({ ...base, ...late });
    expect(rules[rules.indexOf("Late work is accepted and is marked late.") + 1]).toBe("Late work loses 10% of its score for each day late, up to 50%.");
  });
});

describe("handInRules", () => {
  it("words the defaults", () => {
    expect(handInRules(base)).toEqual([
      "You can hand in a written answer and up to 5 files.",
      "Files: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), Photos (JPEG, PNG), Text (.txt), up to 25 MB each.",
      "There is no due date.",
      "You can turn in once, so check your work first.",
      "You see your grade as soon as your instructor saves it.",
    ]);
  });

  it("lists what to hand in for one, two, and three kinds", () => {
    const first = (settings: Partial<HandInSettings>) => handInRules({ ...base, ...settings })[0];
    expect(first({ submissionKinds: ["link"] })).toBe("You can hand in a link.");
    expect(first({ submissionKinds: ["file"], maxFiles: 1 })).toBe("You can hand in 1 file.");
    expect(first({ submissionKinds: ["text", "file", "link"], maxFiles: 3 })).toBe("You can hand in a written answer, a link, and up to 3 files.");
    // No file rule when files are not taken.
    expect(handInRules({ ...base, submissionKinds: ["text"] }).some((rule) => rule.startsWith("Files:"))).toBe(false);
  });

  it("words the dates, late work, resubmission, grade release, and the honor statement", () => {
    const rules = handInRules({
      ...base, allowedFileTypes: ["pdf", "image"], dueAt: "2026-11-20T07:59:00Z", allowLate: true, closeAt: "2026-11-22T07:59:00Z",
      allowResubmission: true, gradeRelease: "returned", honorStatement: true,
    });
    expect(rules).toContain("Files: PDF, Photos (JPEG, PNG), up to 25 MB each.");
    expect(rules.find((rule) => rule.startsWith("Due "))).toMatch(/^Due Nov 20, 2026, /);
    expect(rules.find((rule) => rule.startsWith("Late work"))).toMatch(/^Late work is accepted until Nov 22, 2026, .* and is marked late\.$/);
    expect(rules).toContain("You can take your work back before the due date, and turn in a new version.");
    expect(rules).toContain("You see your grade when your instructor returns your work.");
    expect(rules.at(-1)).toBe("You confirm that the work is your own when you turn it in.");

    const strict = handInRules({ ...base, dueAt: "2026-11-20T07:59:00Z" });
    expect(strict).toContain("Late work is not accepted.");
    expect(handInRules({ ...base, dueAt: "2026-11-20T07:59:00Z", allowLate: true })).toContain("Late work is accepted and is marked late.");
    expect(handInRules({ ...base, allowResubmission: true })).toContain("You can take your work back and turn in a new version.");
  });
});
