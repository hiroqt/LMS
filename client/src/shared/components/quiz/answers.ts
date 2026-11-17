import type { AnswerInput, AnswerReview, AnswerValue, QuizAnswer, QuizQuestion, SpellingMode } from "./types";

/*
 * Pure rules for answers: how a value on screen maps to what the API takes,
 * whether a question counts as answered, and how a result reads. Kept out of
 * the component files so they stay fast-refresh friendly (C-002).
 */

export const CHOICE_TYPES = new Set(["multiple_choice", "true_false"]);

/** The question types whose answers are spelled by the student, so the spelling rule applies. */
const SPELLED_TYPES = new Set(["identification", "enumeration", "modified_true_false"]);

export const usesSpelling = (questions: Array<Pick<QuizQuestion, "type">>) => questions.some((question) => SPELLED_TYPES.has(question.type));

/** Multiple choice, true or false, and modified true or false take the number-key shortcuts. */
export const takesShortcuts = (question: Pick<QuizQuestion, "type" | "options">) =>
  question.options.length > 0 && (CHOICE_TYPES.has(question.type) || question.type === "modified_true_false");

/** The "False" option of a true-or-false style question. */
export function falseOptionId(question: Pick<QuizQuestion, "options">): number | undefined {
  return (question.options.find((option) => option.text.trim().toLowerCase() === "false") ?? question.options[1])?.id;
}

export function itemCountOf(question: Pick<QuizQuestion, "itemCount">): number {
  return Math.min(Math.max(question.itemCount ?? 1, 1), 20);
}

/** The value on screen from a saved answer. */
export function fromAnswer(answer: QuizAnswer | undefined): AnswerValue {
  if (!answer) return {};
  const value: AnswerValue = {};
  if (answer.optionId !== null && answer.optionId !== undefined) value.optionId = answer.optionId;
  if (answer.text) value.text = answer.text;
  if (answer.items?.length) value.items = [...answer.items];
  if (answer.matches && Object.keys(answer.matches).length) value.matches = { ...answer.matches };
  return value;
}

/** What the API takes for this answer: only the fields the question's type uses (contract §1). */
export function toAnswerInput(question: QuizQuestion, value: AnswerValue): AnswerInput {
  const questionId = question.id;
  switch (question.type) {
    case "identification":
    case "essay":
      return { questionId, text: value.text ?? "" };
    case "enumeration":
      return { questionId, items: value.items ?? [] };
    case "matching":
      return { questionId, matches: value.matches ?? {} };
    case "modified_true_false": {
      const optionId = value.optionId ?? null;
      // A correction is sent only with False; True clears it on the server.
      return { questionId, optionId, text: optionId !== null && optionId === falseOptionId(question) ? value.text ?? "" : null };
    }
    default:
      return { questionId, optionId: value.optionId ?? null };
  }
}

const filled = (text: string | undefined) => Boolean(text?.trim());

/** Whether a question has a complete answer (the submit dialog lists the ones that do not). */
export function isAnswered(question: QuizQuestion, value: AnswerValue | undefined): boolean {
  if (!value) return false;
  switch (question.type) {
    case "identification":
    case "essay":
      return filled(value.text);
    case "enumeration":
      return (value.items ?? []).some(filled);
    case "matching":
      return (question.lefts ?? []).length > 0 && (question.lefts ?? []).every((left) => filled(value.matches?.[String(left.id)]));
    case "modified_true_false":
      if (value.optionId === undefined) return false;
      return value.optionId !== falseOptionId(question) || filled(value.text);
    default:
      return value.optionId !== undefined;
  }
}

/** Splits a prompt around its underlined phrase (matched ignoring case), or null when it is not there. */
export function splitUnderlined(prompt: string, underlined: string | null | undefined): [string, string, string] | null {
  const phrase = underlined?.trim();
  if (!phrase) return null;
  const at = prompt.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return null;
  return [prompt.slice(0, at), prompt.slice(at, at + phrase.length), prompt.slice(at + phrase.length)];
}

export const SPELLING_RULES: Record<SpellingMode, string> = {
  strict: "Spelling counts: answers must be spelled exactly",
  typos: "Small spelling mistakes are accepted",
  review: "Near misses are checked by your instructor",
};

export const ANSWER_REVIEW_NOTES: Record<AnswerReview, string> = {
  score_only: "After you submit, you see your score only.",
  results: "After you submit, you see your score and which questions you got right.",
  answers_after_due: "After you submit, you see your score and which questions you got right. The correct answers appear after the due date.",
  answers_after_submit: "After you submit, you see your score, which questions you got right, and the correct answers.",
};

export type Outcome = "correct" | "partial" | "incorrect" | "waiting";

/** Correct, partly correct, incorrect, or waiting for grading, from the points awarded. */
export function outcomeOf(question: Pick<QuizQuestion, "points">, pointsAwarded: number | null | undefined): Outcome {
  if (pointsAwarded === null || pointsAwarded === undefined) return "waiting";
  if (pointsAwarded >= question.points) return "correct";
  return pointsAwarded > 0 ? "partial" : "incorrect";
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  correct: "Correct",
  partial: "Partly correct",
  incorrect: "Incorrect",
  waiting: "Waiting for grading",
};

const number = (value: number) => String(Math.round(value * 100) / 100);

/** "1.5 of 3 points", "1 of 1 point" */
export const pointsOf = (awarded: number, points: number) => `${number(awarded)} of ${number(points)} ${points === 1 ? "point" : "points"}`;

export const MATCH_NOTES: Partial<Record<string, string>> = {
  typo: "Accepted with a spelling difference",
  review: "Waiting for your instructor to check the spelling",
};

const optionText = (question: QuizQuestion, id: number | null | undefined) => question.options.find((option) => option.id === id)?.text;
const leftText = (question: QuizQuestion, id: number | string) => question.lefts?.find((left) => String(left.id) === String(id))?.text ?? "Item";
const orList = (items: string[]) => items.join(" or ");

/** The student's answer in words, or null when nothing was given. */
export function describeGiven(question: QuizQuestion, value: AnswerValue): string | null {
  switch (question.type) {
    case "identification":
    case "essay":
      return value.text?.trim() || null;
    case "enumeration": {
      const items = (value.items ?? []).map((item) => item.trim()).filter(Boolean);
      return items.length ? items.join(", ") : null;
    }
    case "matching": {
      const pairs = Object.entries(value.matches ?? {}).filter(([, right]) => right.trim());
      return pairs.length ? pairs.map(([left, right]) => `${leftText(question, left)}: ${right}`).join("; ") : null;
    }
    case "modified_true_false": {
      const choice = optionText(question, value.optionId);
      if (!choice) return null;
      return value.optionId === falseOptionId(question) && value.text?.trim() ? `${choice}, correction: ${value.text.trim()}` : choice;
    }
    default:
      return optionText(question, value.optionId) ?? null;
  }
}

/** The correct answer in words, or null when the key is not shown (or the type has none, like essays). */
export function describeKey(question: QuizQuestion): string | null {
  const key = question.key;
  if (!key) return null;
  switch (question.type) {
    case "identification":
      return key.answers?.length ? orList(key.answers) : null;
    case "enumeration":
      return key.answers?.length ? key.answers.join(", ") : null;
    case "matching":
      return key.pairs?.length ? key.pairs.map((pair) => `${leftText(question, pair.leftId)}: ${pair.right}`).join("; ") : null;
    case "modified_true_false":
      if (key.correctAnswer === undefined) return null;
      if (key.correctAnswer) return "True";
      return key.answers?.length ? `False, correction: ${orList(key.answers)}` : "False";
    case "essay":
      return null;
    default: {
      const texts = (key.optionIds ?? []).map((id) => optionText(question, id)).filter((text): text is string => Boolean(text));
      if (texts.length) return orList(texts);
      return key.correctAnswer === undefined ? null : key.correctAnswer ? "True" : "False";
    }
  }
}
