import { describe, expect, it } from "vitest";
import { newQuestion, questionErrors, setFacts, setsForSubject, toDraft, toInput, type Question, type QuestionSetSummary } from "./questionSets";

// Fictional questions, shaped like GET /api/questionnaires/{id}.
const questions: Question[] = [
  { id: 1, type: "multiple_choice", prompt: "Which key identifies a row?", points: 2, sortOrder: 1, timeLimitSeconds: 60, options: [{ id: 10, text: "Primary key", isCorrect: true }, { id: 11, text: "Foreign key", isCorrect: false }], expectedAnswers: [], pairs: [] },
  { id: 2, type: "true_false", prompt: "SQL keywords are case-sensitive.", points: 1, sortOrder: 2, timeLimitSeconds: null, options: [{ id: 12, text: "True", isCorrect: false }, { id: 13, text: "False", isCorrect: true }], expectedAnswers: [], pairs: [] },
  { id: 3, type: "essay", prompt: "Explain normalisation.", points: 5, sortOrder: 3, timeLimitSeconds: null, options: [], expectedAnswers: [], pairs: [] },
  { id: 4, type: "enumeration", prompt: "Name two join types.", points: 2, sortOrder: 4, timeLimitSeconds: null, options: [], expectedAnswers: ["inner", "left"], pairs: [] },
  { id: 5, type: "matching", prompt: "Match the command.", points: 2, sortOrder: 5, timeLimitSeconds: null, options: [], expectedAnswers: [], pairs: [{ left: "SELECT", right: "read" }, { left: "DELETE", right: "remove" }] },
];

describe("toDraft and toInput", () => {
  it("send back every question type exactly as the server stored it", () => {
    expect(questions.map((question) => toInput(toDraft(question)))).toEqual([
      { type: "multiple_choice", prompt: "Which key identifies a row?", points: 2, timeLimitSeconds: 60, options: [{ text: "Primary key", isCorrect: true }, { text: "Foreign key", isCorrect: false }] },
      { type: "true_false", prompt: "SQL keywords are case-sensitive.", points: 1, correctAnswer: false },
      { type: "essay", prompt: "Explain normalisation.", points: 5 },
      { type: "enumeration", prompt: "Name two join types.", points: 2, expectedAnswers: ["inner", "left"] },
      { type: "matching", prompt: "Match the command.", points: 2, pairs: [{ left: "SELECT", right: "read" }, { left: "DELETE", right: "remove" }] },
    ]);
  });

  it("reads a true statement as true", () => {
    const statement = { ...questions[1]!, options: [{ id: 1, text: "True", isCorrect: true }, { id: 2, text: "False", isCorrect: false }] };
    expect(toInput(toDraft(statement))).toMatchObject({ correctAnswer: true });
  });

  it("trims text and drops blank accepted-answer lines", () => {
    const draft = { ...toDraft(questions[3]!), prompt: "  Name joins ", expectedAnswers: " inner \n\n outer \n" };
    expect(toInput(draft)).toEqual({ type: "enumeration", prompt: "Name joins", points: 2, expectedAnswers: ["inner", "outer"] });
  });

  it("starts a new question as multiple choice with four choices, the first correct, and a unique key", () => {
    const a = newQuestion();
    const b = newQuestion();
    expect(a.key).not.toBe(b.key);
    expect(toInput(a)).toEqual({ type: "multiple_choice", prompt: "", points: 1, options: [true, false, false, false].map((isCorrect) => ({ text: "", isCorrect })) });
  });
});

describe("setsForSubject", () => {
  const set = (id: number, subjectId: number | null): QuestionSetSummary => ({ id, title: `Set ${id}`, subjectId, questionCount: 1, totalPoints: 1, locked: false, usedBy: [] });

  it("offers the subject's sets and sets with no subject, never another subject's", () => {
    expect(setsForSubject([set(1, 7), set(2, 8), set(3, null)], 7).map((item) => item.id)).toEqual([1, 3]);
  });
});

describe("setFacts and questionErrors", () => {
  it("counts in words", () => {
    expect(setFacts({ questionCount: 1, totalPoints: 1 })).toBe("1 question · 1 point");
    expect(setFacts({ questionCount: 5, totalPoints: 12.5 })).toBe("5 questions · 12.5 points");
  });

  it("picks one question's server messages by position", () => {
    const errors = { "questions[1].options": ["Mark exactly one choice as correct."], "questions[10].prompt": ["Enter the question."], title: ["Enter a title."] };
    expect(questionErrors(errors, 1)).toEqual(["Mark exactly one choice as correct."]);
    expect(questionErrors(errors, 0)).toEqual([]);
  });
});
