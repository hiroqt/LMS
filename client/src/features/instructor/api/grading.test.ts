import { describe, expect, it } from "vitest";
import {
  applyDecision,
  barWidth,
  describeAnswer,
  describeKey,
  formatAverage,
  formatRate,
  keyChanges,
  keyProblem,
  matchNoteText,
  regradeSummary,
  replaceRow,
  rollbackDecision,
  splitUnderlined,
  toKeyDraft,
  waitingCount,
  type GradedAnswer,
  type KeyedQuestion,
  type SpellingReviewRow,
} from "./grading";

const tf = (correct: "True" | "False") => [
  { id: 1, text: "True", isCorrect: correct === "True" },
  { id: 2, text: "False", isCorrect: correct === "False" },
];

const question = (over: Partial<KeyedQuestion>): KeyedQuestion => ({ id: 90, type: "identification", prompt: "The father of computers.", points: 1, options: [], expectedAnswers: [], pairs: [], ...over });
const answer = (over: Partial<GradedAnswer>): GradedAnswer => ({ questionId: 90, optionId: null, text: null, items: [], matches: {}, pointsAwarded: null, ...over });

describe("describeKey and describeAnswer, per type", () => {
  it("multiple choice: the correct choice and the chosen one", () => {
    const q = question({ type: "multiple_choice", options: [{ id: 5, text: "var", isCorrect: false }, { id: 6, text: "const", isCorrect: true }] });
    expect(describeKey(q)).toEqual([{ label: "Correct choice", value: "const" }]);
    expect(describeAnswer(q, answer({ optionId: 5 }))).toEqual([{ label: "Chose", value: "var" }]);
    expect(describeAnswer(q, undefined)).toEqual([{ label: "Chose", value: "No answer" }]);
  });

  it("true or false", () => {
    const q = question({ type: "true_false", options: tf("False") });
    expect(describeKey(q)).toEqual([{ label: "Correct answer", value: "False" }]);
    expect(describeAnswer(q, answer({ optionId: 1 }))).toEqual([{ label: "Answered", value: "True" }]);
  });

  it("identification: any accepted answer, and what was written", () => {
    const q = question({ expectedAnswers: ["Charles Babbage", "Babbage"] });
    expect(describeKey(q)).toEqual([{ label: "Accepted answers", value: "Charles Babbage, Babbage" }]);
    expect(describeKey(question({ expectedAnswers: ["Manila"] }))).toEqual([{ label: "Accepted answer", value: "Manila" }]);
    expect(describeAnswer(q, answer({ text: "  Babage " }))).toEqual([{ label: "Wrote", value: "Babage" }]);
  });

  it("enumeration lists items", () => {
    const q = question({ type: "enumeration", expectedAnswers: ["red", "green", "blue"] });
    expect(describeKey(q)).toEqual([{ label: "Accepted items", value: "red, green, blue" }]);
    expect(describeAnswer(q, answer({ items: ["red", "blu"] }))).toEqual([{ label: "Listed", value: "red, blu" }]);
  });

  it("modified true or false: True/False chosen, then the correction", () => {
    const q = question({ type: "modified_true_false", prompt: "The CPU stores data permanently.", underlined: "CPU", options: tf("False"), expectedAnswers: ["storage", "hard disk"] });
    expect(describeKey(q)).toEqual([{ label: "Correct answer", value: "False" }, { label: "Accepted corrections", value: "storage, hard disk" }]);
    expect(describeAnswer(q, answer({ optionId: 2, text: "storage" }))).toEqual([{ label: "Answered", value: "False" }, { label: "Correction", value: "storage" }]);
    expect(describeAnswer(q, answer({ optionId: 1, text: "ignored" }))).toEqual([{ label: "Answered", value: "True" }]);
    expect(describeKey({ ...q, options: tf("True") })).toEqual([{ label: "Correct answer", value: "True" }]);
  });

  it("matching pairs lefts with the student's rights, by leftId or in id order", () => {
    const q = question({ type: "matching", pairs: [{ left: "CPU", right: "Processor" }, { left: "RAM", right: "Memory" }] });
    expect(describeKey(q)).toEqual([{ label: "CPU", value: "Processor" }, { label: "RAM", value: "Memory" }]);
    expect(describeAnswer(q, answer({ matches: { "12": "Processor", "11": "Memory" } }))).toEqual([{ label: "CPU", value: "Memory" }, { label: "RAM", value: "Processor" }]);
    const withIds = { ...q, pairs: [{ left: "CPU", right: "Processor", leftId: 12 }, { left: "RAM", right: "Memory", leftId: 11 }] };
    expect(describeAnswer(withIds, answer({ matches: { "12": "Processor", "11": "Memory" } }))).toEqual([{ label: "CPU", value: "Processor" }, { label: "RAM", value: "Memory" }]);
  });

  it("essays have no key", () => {
    expect(describeKey(question({ type: "essay" }))).toEqual([]);
  });
});

describe("splitUnderlined", () => {
  it("finds the phrase ignoring case and keeps the prompt's spelling", () => {
    expect(splitUnderlined("The CPU stores data.", "cpu")).toEqual({ before: "The ", phrase: "CPU", after: " stores data." });
    expect(splitUnderlined("The CPU stores data.", "GPU")).toBeNull();
    expect(splitUnderlined("x", null)).toBeNull();
  });
});

describe("match notes", () => {
  it("says what happened in words", () => {
    expect(matchNoteText("typo")).toBe("Accepted with a spelling difference");
    expect(matchNoteText("review")).toBe("Waiting for your review");
    expect(matchNoteText("review", "accepted")).toBe("You accepted this spelling");
    expect(matchNoteText("exact")).toBeNull();
    expect(matchNoteText(null)).toBeNull();
  });
});

const row = (over: Partial<SpellingReviewRow>): SpellingReviewRow => ({
  submissionId: 1, studentId: "s0", studentName: "Alex Rivera", questionId: 90, number: 2, prompt: "Father of computers", given: "Babage",
  accepted: ["Babbage"], matchNote: "review", decision: null, pointsAwarded: null, points: 1, ...over,
});

describe("spelling decisions", () => {
  it("applies a decision to one row and keeps the previous row", () => {
    const rows = [row({}), row({ submissionId: 2, studentName: "Jamie Lee" })];
    const { rows: next, previous } = applyDecision(rows, rows[0]!, "accepted");
    expect(next.map((item) => item.decision)).toEqual(["accepted", null]);
    expect(previous).toEqual(rows[0]);
    expect(rows[0]!.decision).toBeNull(); // the original list is untouched
  });

  it("rolls back only the failed row, keeping a decision that landed meanwhile", () => {
    const rows = [row({}), row({ submissionId: 2 })];
    const first = applyDecision(rows, rows[0]!, "accepted");
    const second = applyDecision(first.rows, rows[1]!, "rejected");
    const rolledBack = rollbackDecision(second.rows, first.previous);
    expect(rolledBack.map((item) => item.decision)).toEqual([null, "rejected"]);
    expect(rollbackDecision(rows, undefined)).toBe(rows);
  });

  it("replaces a row with the server's and counts what still waits", () => {
    const rows = [row({}), row({ submissionId: 2, matchNote: "typo" }), row({ submissionId: 3 })];
    expect(waitingCount(rows)).toBe(2);
    const next = replaceRow(rows, row({ decision: "accepted", pointsAwarded: 1 }));
    expect(next[0]).toMatchObject({ decision: "accepted", pointsAwarded: 1 });
    expect(waitingCount(next)).toBe(1);
    expect(waitingCount(undefined)).toBe(0);
  });
});

describe("analysis formatting", () => {
  it("formats rates, averages, and bar widths", () => {
    expect(formatRate(2 / 3)).toBe("67%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(1.2)).toBe("100%");
    expect(formatAverage(1.456, 2)).toBe("1.46 of 2 points");
    expect(formatAverage(1, 1)).toBe("1 of 1 point");
    expect(barWidth(0.333)).toBe(33.3);
    expect(barWidth(-1)).toBe(0);
    expect(regradeSummary({ regraded: 12, changed: 3 })).toBe("12 attempts re-scored, 3 changed");
    expect(regradeSummary({ regraded: 1, changed: 0 })).toBe("1 attempt re-scored, 0 changed");
  });
});

describe("fixing the key", () => {
  const mc = question({ id: 1, type: "multiple_choice", options: [{ id: 5, text: "var", isCorrect: false }, { id: 6, text: "const", isCorrect: true }] });
  const ident = question({ id: 2, expectedAnswers: ["Babbage"] });
  const mtf = question({ id: 3, type: "modified_true_false", options: tf("False"), expectedAnswers: ["storage"] });
  const match = question({ id: 4, type: "matching", pairs: [{ left: "CPU", right: "Processor" }, { left: "RAM", right: "Memory" }] });
  const essay = question({ id: 5, type: "essay" });
  const all = [mc, ident, mtf, match, essay];
  const drafts = () => Object.fromEntries(all.map((q) => [q.id, toKeyDraft(q)]));

  it("sends nothing when nothing changed", () => {
    expect(keyChanges(all, drafts())).toEqual([]);
  });

  it("sends only the changed keys, per type", () => {
    const next = drafts();
    next[1] = { ...next[1]!, correctOptionId: 5 };
    next[2] = { ...next[2]!, expectedAnswers: "Babbage\n Charles Babbage \n\n" };
    next[3] = { ...next[3]!, correctAnswer: true };
    next[4] = { ...next[4]!, rights: ["Processor", " RAM chip "] };
    expect(keyChanges(all, next)).toEqual([
      { questionId: 1, correctOptionId: 5 },
      { questionId: 2, expectedAnswers: ["Babbage", "Charles Babbage"] },
      { questionId: 3, correctAnswer: true },
      { questionId: 4, pairs: [{ left: "CPU", right: "Processor" }, { left: "RAM", right: "RAM chip" }] },
    ]);
  });

  it("modified true or false sends corrections only for a false statement", () => {
    const next = drafts();
    next[3] = { ...next[3]!, expectedAnswers: "storage\nhard disk" };
    expect(keyChanges([mtf], next)).toEqual([{ questionId: 3, expectedAnswers: ["storage", "hard disk"] }]);
    next[3] = { ...next[3]!, correctAnswer: true };
    expect(keyChanges([mtf], next)).toEqual([{ questionId: 3, correctAnswer: true }]);
  });

  it("explains a key that cannot be saved", () => {
    expect(keyProblem({ ...toKeyDraft(ident), expectedAnswers: " \n" })).toBe("Give 1 to 10 accepted answers, one per line.");
    expect(keyProblem({ ...toKeyDraft(mtf), expectedAnswers: "" })).toBe("Give 1 to 10 accepted corrections, one per line.");
    expect(keyProblem({ ...toKeyDraft(mtf), correctAnswer: true, expectedAnswers: "" })).toBeNull();
    expect(keyProblem({ ...toKeyDraft(match), rights: ["Processor", ""] })).toBe("Give every item its match.");
    expect(keyProblem(toKeyDraft(mc))).toBeNull();
  });
});
