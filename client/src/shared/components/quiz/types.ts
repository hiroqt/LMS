/**
 * Shapes shared by the student quiz and the instructor's "Preview as student"
 * (docs/ASSESSMENTS_API_CONTRACT.md §1, §4, §6). JSON is camelCase.
 */

export type QuestionType = "multiple_choice" | "true_false" | "identification" | "enumeration" | "essay" | "modified_true_false" | "matching";

/** What a student sees after submitting (contract §3). */
export type AnswerReview = "score_only" | "results" | "answers_after_due" | "answers_after_submit";

/** How typed answers are spelled (contract §3, §5). */
export type SpellingMode = "strict" | "typos" | "review";

export type MatchNote = "exact" | "typo" | "review";

export interface QuizOption {
  id: number;
  text: string;
}

/** The correct answers, sent only once the exam's answer review allows it. */
export interface AnswerKey {
  optionIds?: number[];
  answers?: string[];
  pairs?: Array<{ leftId: number; right: string }>;
  correctAnswer?: boolean;
}

export interface QuizSection {
  id: number;
  title: string | null;
  directions: string | null;
}

/** A question as a student sees it: no correct answers until the key is allowed. */
export interface QuizQuestion {
  id: number;
  type: QuestionType | (string & {});
  prompt: string;
  points: number;
  timeLimitSeconds: number | null;
  sectionId?: number | null;
  /** Modified true or false: the phrase drawn underlined in the prompt. */
  underlined?: string | null;
  options: QuizOption[];
  /** Enumeration: how many items are expected. */
  itemCount?: number | null;
  /** Matching: the left-hand items, and the right-hand choices in alphabetical order. */
  lefts?: QuizOption[];
  rights?: string[];
  key?: AnswerKey | null;
}

/** A saved answer, with its points once the attempt is submitted and the review allows them. */
export interface QuizAnswer {
  questionId: number;
  optionId: number | null;
  text: string | null;
  items?: string[];
  /** Left option id (as a JSON key) → the chosen right-hand text. */
  matches?: Record<string, string>;
  pointsAwarded: number | null;
  matchNote?: MatchNote | null;
}

/** An answer while it is being given. Only the fields the question's type uses are set. */
export interface AnswerValue {
  optionId?: number;
  text?: string;
  items?: string[];
  matches?: Record<string, string>;
}

/** What the API takes for one answer (`AnswerInput`, contract §1). */
export interface AnswerInput {
  questionId: number;
  optionId?: number | null;
  text?: string | null;
  items?: string[];
  matches?: Record<string, string>;
}

/** How an answer changed: a choice saves at once, typing saves after a pause. */
export type AnswerChange = "choice" | "typed";

/** The API's answer limits (contract §1). */
export const ANSWER_LIMITS = { text: 200, essay: 10_000, items: 20 } as const;
