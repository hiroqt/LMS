import { describe, expect, it } from "vitest";
import { materialFileRefusal, PREVIEW_AUTO_BYTES, previewPlan, previewWaits } from "./materials";

describe("previewPlan", () => {
  it("shows PDFs, images and text as they are", () => {
    expect(previewPlan({ type: "pdf", preview: null })).toEqual({ kind: "pdf", source: "file" });
    expect(previewPlan({ type: "image", preview: null })).toEqual({ kind: "image", source: "file" });
    expect(previewPlan({ type: "text", preview: null })).toEqual({ kind: "text", source: "file" });
  });

  it("shows an Office file's PDF copy only when it is ready, and says why otherwise", () => {
    expect(previewPlan({ type: "powerpoint", preview: "ready" })).toEqual({ kind: "pdf", source: "preview" });
    expect(previewPlan({ type: "word", preview: "failed" })).toEqual({ kind: "none", reason: "failed" });
    expect(previewPlan({ type: "excel", preview: "off" })).toEqual({ kind: "none", reason: "off" });
    expect(previewPlan({ type: "excel", preview: null })).toEqual({ kind: "none", reason: "failed" });
    expect(previewPlan({ type: null, preview: null })).toEqual({ kind: "none", reason: "unknown" });
  });
});

describe("previewWaits", () => {
  const pdf = previewPlan({ type: "pdf", preview: null });
  it("waits for a tap above 5 MB or with data saver on", () => {
    expect(previewWaits({ size: PREVIEW_AUTO_BYTES }, pdf, false)).toBe(false);
    expect(previewWaits({ size: PREVIEW_AUTO_BYTES + 1 }, pdf, false)).toBe(true);
    expect(previewWaits({ size: 1000 }, pdf, true)).toBe(true);
  });

  it("never waits for text, which loads only its start, or for a file with no preview", () => {
    expect(previewWaits({ size: 20 * 1024 * 1024 }, previewPlan({ type: "text", preview: null }), true)).toBe(false);
    expect(previewWaits({ size: 20 * 1024 * 1024 }, previewPlan({ type: "word", preview: "off" }), true)).toBe(false);
  });
});

describe("materialFileRefusal", () => {
  it("refuses empty, too large, and unaccepted files before they are sent", () => {
    expect(materialFileRefusal({ name: "notes.pdf", size: 0 })).toBe("This file is empty.");
    expect(materialFileRefusal({ name: "notes.pdf", size: 25 * 1024 * 1024 + 1 })).toBe("This file is larger than 25 MB.");
    expect(materialFileRefusal({ name: "code.zip", size: 10 })).toMatch(/Use a PDF, Word/);
    expect(materialFileRefusal({ name: "slides.ppt", size: 10 })).toMatch(/Use a PDF, Word/);
    for (const name of ["a.pdf", "a.DOCX", "a.pptx", "a.xlsx", "a.jpg", "a.jpeg", "a.png", "a.txt"]) expect(materialFileRefusal({ name, size: 10 })).toBeNull();
  });
});
