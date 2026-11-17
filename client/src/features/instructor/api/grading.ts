import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { describeApiError, getJson, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Coursework, Submission } from "../../../shared/api/overview";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { attempt, type ActionResult } from "./actions";
import { questionSetKeys } from "./questionSets";
import { instructorKeys } from "./store";

/*
 * Grading and accuracy for one exam (ASSESSMENTS_API_CONTRACT §5, §6; D-042): the answers
 * beside the key, the spelling review list, item analysis, and fixing a set's answer key.
 * Types here are the minimal local view of the contract; questionSets.ts owns the editor's.
 */

// ------------------------------------------------------------------------- types

export type GradingQuestionType = "multiple_choice" | "true_false" | "identification" | "enumeration" | "essay" | "modified_true_false" | "matching";
export type MatchNote = "exact" | "typo" | "review";
export type SpellingDecision = "accepted" | "rejected";

/** A question with its key, as the instructor's submission detail and question set carry it (§2). */
export interface KeyedQuestion {
  id: number;
  type: string;
  prompt: string;
  points: number;
  /** modified_true_false: the phrase drawn underlined in the prompt. */
  underlined?: string | null;
  options: Array<{ id: number; text: string; isCorrect: boolean }>;
  expectedAnswers: string[];
  /** Matching: `leftId` when the server sends it; otherwise lefts follow the answer ids in order. */
  pairs: Array<{ left: string; right: string; leftId?: number }>;
}

export interface GradedAnswer {
  questionId: number;
  optionId: number | null;
  text: string | null;
  items: string[];
  /** Matching: left option id → the right the student chose. */
  matches: Record<string, string>;
  pointsAwarded: number | null;
  matchNote?: MatchNote | null;
  decision?: SpellingDecision | null;
}

export interface SubmissionDetail {
  submission?: Submission;
  questions: KeyedQuestion[];
  answers: GradedAnswer[];
}

export interface SpellingReviewRow {
  submissionId: number;
  studentId: string;
  studentName: string;
  questionId: number;
  number: number;
  prompt: string;
  given: string;
  accepted: string[];
  matchNote: MatchNote;
  decision: SpellingDecision | null;
  pointsAwarded: number | null;
  points: number;
}

export interface ItemAnalysisRow {
  questionId: number;
  number: number;
  type: string;
  prompt: string;
  points: number;
  answered: number;
  /** 0–1 over submitted attempts. */
  correctRate: number;
  averagePoints: number;
  topAnswers: Array<{ answer: string; count: number; isKey: boolean }>;
  flag: "check_key" | null;
}

/** One entry of `PUT /api/questionnaires/{id}/answer-key`: only the fields its type uses. */
export interface AnswerKeyChange {
  questionId: number;
  correctOptionId?: number;
  correctAnswer?: boolean;
  expectedAnswers?: string[];
  pairs?: Array<{ left: string; right: string }>;
}

export interface AnswerKeyResult {
  regraded: number;
  changed: number;
}

/** The parts of a question set (QuestionnaireDto) the key dialog needs. */
export interface KeySet {
  id: number;
  title: string;
  locked: boolean;
  questions: KeyedQuestion[];
}

// ---------------------------------------------------------------- pure helpers

export const TYPE_LABELS: Record<GradingQuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  identification: "Identification",
  enumeration: "Enumeration",
  essay: "Essay",
  modified_true_false: "Modified true or false",
  matching: "Matching",
};

export const typeLabel = (type: string) => TYPE_LABELS[type as GradingQuestionType] ?? "Question";

/** Typed answers the server scores and the instructor may override (identification, enumeration, modified true or false). */
export const isTypedAnswer = (type: string) => type === "identification" || type === "enumeration" || type === "modified_true_false";

/** A label and a value, e.g. "Accepted answers" · "Charles Babbage, Babbage". */
export interface KeyPart {
  label: string;
  value: string;
}

const list = (values: string[]) => values.map((value) => value.trim()).filter(Boolean).join(", ");
const trueFalseOf = (question: KeyedQuestion) => question.options.find((option) => option.isCorrect)?.text === "True";

/** The left id of each pair: the server's `leftId`, or the answer's left ids in ascending order. */
export function pairLeftIds(question: KeyedQuestion, answer?: GradedAnswer): Array<number | undefined> {
  const fromAnswer = Object.keys(answer?.matches ?? {}).map(Number).sort((a, b) => a - b);
  return question.pairs.map((pair, index) => pair.leftId ?? (fromAnswer.length === question.pairs.length ? fromAnswer[index] : undefined));
}

/** The answer key of a question in words, per type (§1). Essays have none. */
export function describeKey(question: KeyedQuestion): KeyPart[] {
  switch (question.type) {
    case "multiple_choice":
      return [{ label: "Correct choice", value: question.options.find((option) => option.isCorrect)?.text ?? "Not set" }];
    case "true_false":
      return [{ label: "Correct answer", value: trueFalseOf(question) ? "True" : "False" }];
    case "identification":
      return [{ label: question.expectedAnswers.length === 1 ? "Accepted answer" : "Accepted answers", value: list(question.expectedAnswers) || "Not set" }];
    case "enumeration":
      return [{ label: "Accepted items", value: list(question.expectedAnswers) || "Not set" }];
    case "modified_true_false":
      return trueFalseOf(question)
        ? [{ label: "Correct answer", value: "True" }]
        : [{ label: "Correct answer", value: "False" }, { label: question.expectedAnswers.length === 1 ? "Accepted correction" : "Accepted corrections", value: list(question.expectedAnswers) || "Not set" }];
    case "matching":
      return question.pairs.map((pair) => ({ label: pair.left, value: pair.right }));
    default:
      return [];
  }
}

/** What the student answered, in words, per type. */
export function describeAnswer(question: KeyedQuestion, answer: GradedAnswer | undefined): KeyPart[] {
  const none = "No answer";
  const optionText = (id: number | null | undefined) => question.options.find((option) => option.id === id)?.text;
  switch (question.type) {
    case "multiple_choice":
      return [{ label: "Chose", value: optionText(answer?.optionId) ?? none }];
    case "true_false":
      return [{ label: "Answered", value: optionText(answer?.optionId) ?? none }];
    case "identification":
    case "essay":
      return [{ label: "Wrote", value: answer?.text?.trim() || none }];
    case "enumeration":
      return [{ label: "Listed", value: list(answer?.items ?? []) || none }];
    case "modified_true_false": {
      const chose = optionText(answer?.optionId);
      if (!chose) return [{ label: "Answered", value: none }];
      return chose === "False" ? [{ label: "Answered", value: "False" }, { label: "Correction", value: answer?.text?.trim() || "No correction" }] : [{ label: "Answered", value: chose }];
    }
    case "matching": {
      const ids = pairLeftIds(question, answer);
      return question.pairs.map((pair, index) => {
        const id = ids[index];
        return { label: pair.left, value: (id === undefined ? undefined : answer?.matches[String(id)]) || none };
      });
    }
    default:
      return [];
  }
}

/** The prompt split around its underlined phrase (first match, ignoring case), for drawing the underline. */
export function splitUnderlined(prompt: string, phrase: string | null | undefined): { before: string; phrase: string; after: string } | null {
  if (!phrase?.trim()) return null;
  const at = prompt.toLowerCase().indexOf(phrase.trim().toLowerCase());
  if (at < 0) return null;
  const end = at + phrase.trim().length;
  return { before: prompt.slice(0, at), phrase: prompt.slice(at, end), after: prompt.slice(end) };
}

/** The sentence shown for a match note; exact matches need none. */
export function matchNoteText(note: MatchNote | null | undefined, decision?: SpellingDecision | null): string | null {
  if (decision === "accepted") return "You accepted this spelling";
  if (decision === "rejected") return "You marked this spelling wrong";
  if (note === "typo") return "Accepted with a spelling difference";
  if (note === "review") return "Waiting for your review";
  return null;
}

/** Rows still waiting for the instructor: near misses held for review with no decision. */
export function waitingCount(rows: SpellingReviewRow[] | undefined): number {
  return (rows ?? []).filter((row) => row.matchNote === "review" && !row.decision).length;
}

export const rowKey = (row: Pick<SpellingReviewRow, "submissionId" | "questionId">) => `${row.submissionId}-${row.questionId}`;

/** The list with one row's decision applied at once (optimistic), and the row as it was. */
export function applyDecision(rows: SpellingReviewRow[], target: Pick<SpellingReviewRow, "submissionId" | "questionId">, decision: SpellingDecision): { rows: SpellingReviewRow[]; previous: SpellingReviewRow | undefined } {
  const previous = rows.find((row) => rowKey(row) === rowKey(target));
  return { rows: rows.map((row) => (rowKey(row) === rowKey(target) ? { ...row, decision } : row)), previous };
}

/** Puts one row back as it was, keeping every other row (another decision may have landed meanwhile). */
export function rollbackDecision(rows: SpellingReviewRow[], previous: SpellingReviewRow | undefined): SpellingReviewRow[] {
  if (!previous) return rows;
  return rows.map((row) => (rowKey(row) === rowKey(previous) ? previous : row));
}

/** Replaces one row with the server's version. */
export function replaceRow(rows: SpellingReviewRow[], updated: SpellingReviewRow): SpellingReviewRow[] {
  return rows.map((row) => (rowKey(row) === rowKey(updated) ? updated : row));
}

/** 0.6667 → "67%"; clamped to 0–100. */
export function formatRate(rate: number): string {
  return `${Math.round(Math.min(1, Math.max(0, rate)) * 100)}%`;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** "1.5 of 2 points". */
export function formatAverage(average: number, points: number): string {
  return `${round2(average)} of ${round2(points)} ${points === 1 ? "point" : "points"}`;
}

/** "4 of 6 students" style count for one top answer. */
export function formatShare(count: number, answered: number): string {
  return `${count} of ${answered}`;
}

/** Bar width in percent, at least 0 and at most 100. */
export function barWidth(rate: number): number {
  return Math.round(Math.min(1, Math.max(0, rate)) * 1000) / 10;
}

/** One question's key while it is edited in the fix-the-key dialog. */
export interface KeyDraft {
  questionId: number;
  type: string;
  correctOptionId: number | null;
  correctAnswer: boolean;
  /** One accepted answer per line. */
  expectedAnswers: string;
  rights: string[];
}

export const splitLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

export function toKeyDraft(question: KeyedQuestion): KeyDraft {
  return {
    questionId: question.id,
    type: question.type,
    correctOptionId: question.options.find((option) => option.isCorrect)?.id ?? null,
    correctAnswer: trueFalseOf(question),
    expectedAnswers: question.expectedAnswers.join("\n"),
    rights: question.pairs.map((pair) => pair.right),
  };
}

/** Questions whose key can be fixed: every type but essays. */
export const hasKey = (question: Pick<KeyedQuestion, "type">) => question.type !== "essay";

/** A plain sentence when a draft key cannot be saved, using the contract's limits. */
export function keyProblem(draft: KeyDraft): string | null {
  const lines = splitLines(draft.expectedAnswers);
  switch (draft.type) {
    case "multiple_choice":
      return draft.correctOptionId === null ? "Choose the correct choice." : null;
    case "identification":
      return lines.length < 1 || lines.length > 10 ? "Give 1 to 10 accepted answers, one per line." : null;
    case "enumeration":
      return lines.length < 1 || lines.length > 20 ? "Give 1 to 20 accepted items, one per line." : null;
    case "modified_true_false":
      return !draft.correctAnswer && (lines.length < 1 || lines.length > 10) ? "Give 1 to 10 accepted corrections, one per line." : null;
    case "matching":
      return draft.rights.some((right) => !right.trim()) ? "Give every item its match." : null;
    default:
      return null;
  }
}

/** The changes to send: only questions whose key differs from the saved one. */
export function keyChanges(questions: KeyedQuestion[], drafts: Record<number, KeyDraft>): AnswerKeyChange[] {
  return questions.flatMap((question): AnswerKeyChange[] => {
    const draft = drafts[question.id];
    if (!draft || !hasKey(question)) return [];
    const saved = toKeyDraft(question);
    const lines = splitLines(draft.expectedAnswers);
    const sameLines = lines.join("\n") === splitLines(saved.expectedAnswers).join("\n");
    switch (question.type) {
      case "multiple_choice":
        return draft.correctOptionId !== null && draft.correctOptionId !== saved.correctOptionId ? [{ questionId: question.id, correctOptionId: draft.correctOptionId }] : [];
      case "true_false":
        return draft.correctAnswer !== saved.correctAnswer ? [{ questionId: question.id, correctAnswer: draft.correctAnswer }] : [];
      case "identification":
      case "enumeration":
        return sameLines ? [] : [{ questionId: question.id, expectedAnswers: lines }];
      case "modified_true_false": {
        const flipped = draft.correctAnswer !== saved.correctAnswer;
        // Corrections only count for a false statement; a true one keeps whatever was saved.
        const corrections = !draft.correctAnswer && !sameLines;
        if (!flipped && !corrections) return [];
        return [{ questionId: question.id, ...(flipped ? { correctAnswer: draft.correctAnswer } : {}), ...(corrections ? { expectedAnswers: lines } : {}) }];
      }
      case "matching": {
        const rights = draft.rights.map((right) => right.trim());
        return rights.every((right, index) => right === saved.rights[index])
          ? []
          : [{ questionId: question.id, pairs: question.pairs.map((pair, index) => ({ left: pair.left, right: rights[index] ?? pair.right })) }];
      }
      default:
        return [];
    }
  });
}

/** "12 attempts re-scored, 3 changed". */
export function regradeSummary({ regraded, changed }: AnswerKeyResult): string {
  return `${regraded} ${regraded === 1 ? "attempt" : "attempts"} re-scored, ${changed} changed`;
}

// ------------------------------------------------------------------ queries

const queryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;
const examPath = (classId: string, examId: string) => `/api/classes/${encodeURIComponent(classId)}/coursework/${encodeURIComponent(examId)}`;

export const gradingKeys = {
  all: ["instructor", "grading"] as const,
  instructor: (instructorId: string) => [...gradingKeys.all, instructorId] as const,
  exam: (instructorId: string, classId: string, examId: string) => [...gradingKeys.instructor(instructorId), classId, examId] as const,
  coursework: (instructorId: string, classId: string, examId: string) => [...gradingKeys.exam(instructorId, classId, examId), "coursework"] as const,
  submissions: (instructorId: string, classId: string, examId: string) => [...gradingKeys.exam(instructorId, classId, examId), "submissions"] as const,
  submission: (instructorId: string, classId: string, examId: string, submissionId: string) => [...gradingKeys.exam(instructorId, classId, examId), "submission", submissionId] as const,
  spelling: (instructorId: string, classId: string, examId: string) => [...gradingKeys.exam(instructorId, classId, examId), "spelling-review"] as const,
  analysis: (instructorId: string, classId: string, examId: string) => [...gradingKeys.exam(instructorId, classId, examId), "item-analysis"] as const,
};

function useViewer(): Viewer {
  const { instructorId } = useInstructorSession();
  return useMemo(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
}

/** One exam (its question set id, title, and spelling mode). */
export function useExamCoursework(classId: string, examId: string) {
  const viewer = useViewer();
  return useQuery({
    queryKey: gradingKeys.coursework(viewer.id, classId, examId),
    queryFn: ({ signal }) => getJson<Coursework & { spellingMode?: string }>(examPath(classId, examId), { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id && classId && examId),
  });
}

/** Every handed-in attempt of an exam, graded or not, and the students with none. */
export function useExamSubmissions(classId: string, examId: string) {
  const viewer = useViewer();
  return useQuery({
    queryKey: gradingKeys.submissions(viewer.id, classId, examId),
    queryFn: ({ signal }) => getJson<{ items: Submission[] }>(`${examPath(classId, examId)}/submissions`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id && classId && examId),
  });
}

/** An attempt as the server scored it, with each question's key. */
export function useSubmissionDetail(classId: string, examId: string, submissionId: string, enabled = true) {
  const viewer = useViewer();
  return useQuery({
    queryKey: gradingKeys.submission(viewer.id, classId, examId, submissionId),
    queryFn: ({ signal }) => getJson<SubmissionDetail>(`${examPath(classId, examId)}/submissions/${encodeURIComponent(submissionId)}`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: enabled && Boolean(viewer.id),
  });
}

export function useSpellingReview(classId: string, examId: string, enabled = true) {
  const viewer = useViewer();
  return useQuery({
    queryKey: gradingKeys.spelling(viewer.id, classId, examId),
    queryFn: ({ signal }) => getJson<SpellingReviewRow[]>(`${examPath(classId, examId)}/spelling-review`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: enabled && Boolean(viewer.id && classId && examId),
    staleTime: 30_000,
  });
}

export function useItemAnalysis(classId: string, examId: string) {
  const viewer = useViewer();
  return useQuery({
    queryKey: gradingKeys.analysis(viewer.id, classId, examId),
    queryFn: ({ signal }) => getJson<ItemAnalysisRow[]>(`${examPath(classId, examId)}/item-analysis`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id && classId && examId),
  });
}

/** A question set with its keys; shares the Question sets page's cache entry. */
export function useKeySet(setId: number | null | undefined, enabled = true) {
  const viewer = useViewer();
  const id = setId ?? 0;
  return useQuery({
    queryKey: questionSetKeys.detail(viewer.id, id),
    queryFn: ({ signal }) => getJson<KeySet>(`/api/questionnaires/${id}`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: enabled && Boolean(viewer.id) && id > 0,
  });
}

/**
 * Refreshes everything a grade or a re-score changes: this instructor's grading data (attempts,
 * spelling, analysis), the question sets, and the overview the class pages and gradebook read.
 */
export function useRefreshGrading(): () => Promise<void> {
  const queryClient = useQueryClient();
  const { instructorId } = useInstructorSession();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gradingKeys.instructor(instructorId) }),
      queryClient.invalidateQueries({ queryKey: questionSetKeys.all }),
      queryClient.invalidateQueries({ queryKey: instructorKeys.overview(instructorId) }),
    ]);
  }, [queryClient, instructorId]);
}

/**
 * Accept or reject a near miss. The row changes at once; on an error it goes back to how it
 * was and `onError` gets a plain reason. On success the server's row replaces it.
 */
export function useSpellingDecision(classId: string, examId: string, handlers: { onSuccess?: (row: SpellingReviewRow) => void; onError?: (message: string, row: SpellingReviewRow) => void } = {}) {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const refresh = useRefreshGrading();
  const key = gradingKeys.spelling(viewer.id, classId, examId);
  return useMutation({
    mutationFn: ({ row, decision }: { row: SpellingReviewRow; decision: SpellingDecision }) =>
      sendJson<SpellingReviewRow>("PUT", `${examPath(classId, examId)}/spelling-review/${row.submissionId}/${row.questionId}`, { decision }, { viewer }),
    onMutate: async ({ row, decision }) => {
      await queryClient.cancelQueries({ queryKey: key });
      let previous: SpellingReviewRow | undefined;
      queryClient.setQueryData<SpellingReviewRow[]>(key, (rows) => {
        if (!rows) return rows;
        const next = applyDecision(rows, row, decision);
        previous = next.previous;
        return next.rows;
      });
      return { previous };
    },
    onError: (error, { row }, context) => {
      queryClient.setQueryData<SpellingReviewRow[]>(key, (rows) => (rows ? rollbackDecision(rows, context?.previous) : rows));
      const { title, detail } = describeApiError(error);
      handlers.onError?.(`${title}. ${detail}`, row);
    },
    onSuccess: (updated, { row }) => {
      // Some servers answer 204; keep the optimistic row then.
      if (updated && typeof updated === "object") queryClient.setQueryData<SpellingReviewRow[]>(key, (rows) => (rows ? replaceRow(rows, updated) : rows));
      handlers.onSuccess?.(updated && typeof updated === "object" ? updated : row);
    },
    onSettled: () => refresh(),
  });
}

/** Saves a set's answer key; every submitted attempt that uses it is re-scored (D-042). */
export function useFixAnswerKey() {
  const viewer = useViewer();
  const refresh = useRefreshGrading();
  return useCallback(
    async (setId: number, questions: AnswerKeyChange[]): Promise<ActionResult & { result?: AnswerKeyResult }> => {
      let result: AnswerKeyResult | undefined;
      const outcome = await attempt(async () => {
        const response = await sendJson<AnswerKeyResult>("PUT", `/api/questionnaires/${setId}/answer-key`, { questions }, { viewer });
        result = { regraded: response?.regraded ?? 0, changed: response?.changed ?? 0 };
      });
      if (outcome.ok) await refresh();
      return { ...outcome, result };
    },
    [viewer, refresh],
  );
}
