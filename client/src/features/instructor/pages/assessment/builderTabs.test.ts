import { describe, expect, it } from "vitest";
import { defaultTab, errorCount, errorFields, settingsGlance, tabOfField } from "./builderTabs";

describe("assessment builder tabs (D-056)", () => {
  it("routes each field to the tab that shows it", () => {
    expect(tabOfField("title")).toBe("details");
    expect(tabOfField("instructions")).toBe("details");
    expect(tabOfField("questions")).toBe("questions");
    expect(tabOfField("dueAt")).toBe("settings");
    expect(tabOfField("spellingMode")).toBe("settings");
  });

  it("lists errors in page order, so the first one is the first a person meets", () => {
    // Insertion order differs from the page: settings first, then details.
    expect(errorFields({ attempts: "Allow 1 to 20 attempts.", title: "Enter a title.", publish: "Server problem" })).toEqual(["title", "attempts"]);
  });

  it("counts errors per tab and ignores the publish message", () => {
    const errors = { title: "x", moduleId: "y", timeLimit: "z", publish: "w" };
    expect([errorCount(errors, "details"), errorCount(errors, "questions"), errorCount(errors, "settings")]).toEqual([2, 0, 1]);
  });

  it("opens a new assessment on Details and a draft on Questions", () => {
    expect(defaultTab(false)).toBe("details");
    expect(defaultTab(true)).toBe("questions");
  });

  it("sums up the settings in one line", () => {
    expect(settingsGlance({ dueAt: "", attempts: "1", timeLimit: "0" })).toBe("No due date · 1 attempt · No time limit");
    expect(settingsGlance({ dueAt: "", attempts: "3", timeLimit: "30" })).toBe("No due date · 3 attempts · 30 min");
    expect(settingsGlance({ dueAt: "2026-11-20T16:00", attempts: "1", timeLimit: "" })).toMatch(/^Due Nov 20, 4:00\sPM · 1 attempt · No time limit$/);
  });
});
