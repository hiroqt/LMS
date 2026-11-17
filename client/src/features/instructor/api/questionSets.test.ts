import { describe, expect, it } from "vitest";
import { importFileProblem, setFacts, setsForSubject, type QuestionSetSummary } from "./questionSets";

// Draft ↔ input mapping is tested in questionDrafts.test.ts.

describe("setsForSubject", () => {
  const set = (id: number, subjectId: number | null): QuestionSetSummary => ({ id, title: `Set ${id}`, subjectId, questionCount: 1, totalPoints: 1, locked: false, usedBy: [] });

  it("offers the subject's sets and sets with no subject, never another subject's", () => {
    expect(setsForSubject([set(1, 7), set(2, 8), set(3, null)], 7).map((item) => item.id)).toEqual([1, 3]);
  });
});

describe("setFacts", () => {
  it("counts in words", () => {
    expect(setFacts({ questionCount: 1, totalPoints: 1 })).toBe("1 question · 1 point");
    expect(setFacts({ questionCount: 5, totalPoints: 12.5 })).toBe("5 questions · 12.5 points");
  });
});

describe("importFileProblem", () => {
  it("allows the four formats up to 5 MB and explains anything else", () => {
    expect(importFileProblem({ name: "Midterm.DOCX", size: 5 * 1024 * 1024 })).toBeNull();
    expect(importFileProblem({ name: "quiz.csv", size: 10 })).toBeNull();
    expect(importFileProblem({ name: "quiz.docm", size: 10 })).toBe("Upload a .docx, .xlsx, .csv, or .txt file of at most 5 MB.");
    expect(importFileProblem({ name: "big.xlsx", size: 5 * 1024 * 1024 + 1 })).toBe("Upload a .docx, .xlsx, .csv, or .txt file of at most 5 MB.");
    expect(importFileProblem({ name: "empty.txt", size: 0 })).toBe("This file is empty.");
  });
});
