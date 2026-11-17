import { describe, expect, it } from "vitest";
import { describeGiven, describeKey, fromAnswer, isAnswered, outcomeOf, pointsOf, splitUnderlined, takesShortcuts, toAnswerInput, usesSpelling } from "./answers";
import type { QuizQuestion } from "./types";

const base = { points: 2, timeLimitSeconds: null, options: [] as QuizQuestion["options"] };
const mc: QuizQuestion = { ...base, id: 1, type: "multiple_choice", prompt: "Pick", options: [{ id: 10, text: "var" }, { id: 11, text: "const" }] };
const ident: QuizQuestion = { ...base, id: 2, type: "identification", prompt: "Father of computers" };
const enumeration: QuizQuestion = { ...base, id: 3, type: "enumeration", prompt: "Colors", itemCount: 3 };
const essay: QuizQuestion = { ...base, id: 4, type: "essay", prompt: "Explain" };
const mtf: QuizQuestion = { ...base, id: 5, type: "modified_true_false", prompt: "The CPU stores data permanently.", underlined: "cpu", options: [{ id: 20, text: "True" }, { id: 21, text: "False" }] };
const matching: QuizQuestion = { ...base, id: 6, type: "matching", prompt: "Match", lefts: [{ id: 30, text: "Keyboard" }, { id: 31, text: "Monitor" }], rights: ["input", "output"] };

describe("toAnswerInput", () => {
  it("sends only the fields each type uses (contract §1)", () => {
    expect(toAnswerInput(mc, { optionId: 11 })).toEqual({ questionId: 1, optionId: 11 });
    expect(toAnswerInput(mc, {})).toEqual({ questionId: 1, optionId: null });
    expect(toAnswerInput(ident, { text: "Babbage" })).toEqual({ questionId: 2, text: "Babbage" });
    expect(toAnswerInput(enumeration, { items: ["red", "", "blue"] })).toEqual({ questionId: 3, items: ["red", "", "blue"] });
    expect(toAnswerInput(essay, {})).toEqual({ questionId: 4, text: "" });
    expect(toAnswerInput(matching, { matches: { "30": "input" } })).toEqual({ questionId: 6, matches: { "30": "input" } });
  });

  it("sends a modified true-or-false correction only with False", () => {
    expect(toAnswerInput(mtf, { optionId: 21, text: "storage" })).toEqual({ questionId: 5, optionId: 21, text: "storage" });
    expect(toAnswerInput(mtf, { optionId: 20, text: "storage" })).toEqual({ questionId: 5, optionId: 20, text: null });
  });

  it("round-trips a saved answer", () => {
    const saved = { questionId: 5, optionId: 21, text: "storage", items: [], matches: {}, pointsAwarded: null };
    expect(fromAnswer(saved)).toEqual({ optionId: 21, text: "storage" });
    expect(toAnswerInput(mtf, fromAnswer(saved))).toEqual({ questionId: 5, optionId: 21, text: "storage" });
    expect(fromAnswer({ questionId: 6, optionId: null, text: null, matches: { "31": "output" }, pointsAwarded: null })).toEqual({ matches: { "31": "output" } });
  });
});

describe("isAnswered", () => {
  it("needs real content for typed answers", () => {
    expect(isAnswered(ident, { text: "  " })).toBe(false);
    expect(isAnswered(ident, { text: "Babbage" })).toBe(true);
    expect(isAnswered(enumeration, { items: ["", "red"] })).toBe(true);
    expect(isAnswered(essay, undefined)).toBe(false);
  });

  it("needs a correction when False is chosen, and every left item matched", () => {
    expect(isAnswered(mtf, { optionId: 20 })).toBe(true);
    expect(isAnswered(mtf, { optionId: 21 })).toBe(false);
    expect(isAnswered(mtf, { optionId: 21, text: "storage" })).toBe(true);
    expect(isAnswered(matching, { matches: { "30": "input" } })).toBe(false);
    expect(isAnswered(matching, { matches: { "30": "input", "31": "output" } })).toBe(true);
  });
});

describe("prompts and rules", () => {
  it("finds the underlined phrase ignoring case, and keeps the prompt's own capitals", () => {
    expect(splitUnderlined("The CPU stores data.", "cpu")).toEqual(["The ", "CPU", " stores data."]);
    expect(splitUnderlined("The CPU stores data.", "RAM")).toBeNull();
    expect(splitUnderlined("The CPU", "")).toBeNull();
  });

  it("knows which questions are spelled and which take number keys", () => {
    expect(usesSpelling([mc, essay])).toBe(false);
    expect(usesSpelling([mc, ident])).toBe(true);
    expect(takesShortcuts(mc)).toBe(true);
    expect(takesShortcuts(mtf)).toBe(true);
    expect(takesShortcuts(ident)).toBe(false);
  });
});

describe("results", () => {
  it("reads correct, partly correct, incorrect, and waiting from the points", () => {
    expect(outcomeOf({ points: 3 }, 3)).toBe("correct");
    expect(outcomeOf({ points: 3 }, 1.5)).toBe("partial");
    expect(outcomeOf({ points: 3 }, 0)).toBe("incorrect");
    expect(outcomeOf({ points: 3 }, null)).toBe("waiting");
    expect(pointsOf(1.5, 3)).toBe("1.5 of 3 points");
    expect(pointsOf(1, 1)).toBe("1 of 1 point");
  });

  it("describes the key per type, and nothing when the key is withheld", () => {
    expect(describeKey(mc)).toBeNull();
    expect(describeKey({ ...mc, key: { optionIds: [11] } })).toBe("const");
    expect(describeKey({ ...ident, key: { answers: ["Charles Babbage", "Babbage"] } })).toBe("Charles Babbage or Babbage");
    expect(describeKey({ ...mtf, key: { correctAnswer: false, answers: ["storage", "hard disk"] } })).toBe("False, correction: storage or hard disk");
    expect(describeKey({ ...mtf, key: { correctAnswer: true } })).toBe("True");
    expect(describeKey({ ...matching, key: { pairs: [{ leftId: 30, right: "input" }] } })).toBe("Keyboard: input");
    expect(describeKey({ ...essay, key: {} })).toBeNull();
  });

  it("describes what the student gave", () => {
    expect(describeGiven(mtf, { optionId: 21, text: "storage" })).toBe("False, correction: storage");
    expect(describeGiven(enumeration, { items: ["red", " ", "blue"] })).toBe("red, blue");
    expect(describeGiven(matching, { matches: { "31": "output" } })).toBe("Monitor: output");
    expect(describeGiven(ident, {})).toBeNull();
  });
});
