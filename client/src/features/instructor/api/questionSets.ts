import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getJson, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { attempt, type ActionResult } from "./actions";
import { useRefreshOverview } from "./store";

/*
 * Question sets (the API's "questionnaires") are owned by one instructor and can
 * back exams in several classes of the same subject (D-034). A set is locked once
 * a student has started an exam that uses it; a copy is the way to change it.
 */

export type QuestionType = "multiple_choice" | "true_false" | "essay" | "enumeration" | "matching";

export interface QuestionUse {
  examId: number;
  examTitle: string;
  classId: string;
  subjectName: string;
  sectionName: string | null;
}

export interface QuestionSetSummary {
  id: number;
  title: string;
  subjectId: number | null;
  questionCount: number;
  totalPoints: number;
  locked: boolean;
  usedBy: QuestionUse[];
}

export interface Question {
  id: number;
  type: QuestionType;
  prompt: string;
  points: number;
  sortOrder: number;
  timeLimitSeconds: number | null;
  options: Array<{ id: number; text: string; isCorrect: boolean }>;
  expectedAnswers: string[];
  pairs: Array<{ left: string; right: string }>;
}

export interface QuestionSet {
  id: number;
  title: string;
  subjectId: number | null;
  locked: boolean;
  questions: Question[];
  usedBy: QuestionUse[];
}

/** What PUT /api/questionnaires/{id}/questions takes for one question. */
export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  points: number;
  timeLimitSeconds?: number;
  options?: Array<{ text: string; isCorrect: boolean }>;
  correctAnswer?: boolean;
  expectedAnswers?: string[];
  pairs?: Array<{ left: string; right: string }>;
}

/** One question while it is being edited: text fields stay strings until saved. */
export interface DraftQuestion {
  key: string;
  type: QuestionType;
  prompt: string;
  points: string;
  timeLimitSeconds: number | null;
  options: Array<{ text: string; isCorrect: boolean }>;
  correctAnswer: boolean;
  /** One accepted answer per line. */
  expectedAnswers: string;
  pairs: Array<{ left: string; right: string }>;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  essay: "Essay",
  enumeration: "Enumeration",
  matching: "Matching",
};

export function toDraft(question: Question): DraftQuestion {
  return {
    key: `q-${question.id}`,
    type: question.type,
    prompt: question.prompt,
    points: String(question.points),
    timeLimitSeconds: question.timeLimitSeconds,
    options: question.type === "multiple_choice" ? question.options.map(({ text, isCorrect }) => ({ text, isCorrect })) : [],
    // True or false is stored as the options "True" and "False"; the correct one is the answer.
    correctAnswer: question.type === "true_false" ? question.options.find((option) => option.isCorrect)?.text === "True" : true,
    expectedAnswers: question.expectedAnswers.join("\n"),
    pairs: question.pairs.map(({ left, right }) => ({ left, right })),
  };
}

let nextKey = 0;

/** A blank multiple-choice question with four choices, the first marked correct. */
export function newQuestion(): DraftQuestion {
  nextKey += 1;
  return {
    key: `new-${nextKey}`,
    type: "multiple_choice",
    prompt: "",
    points: "1",
    timeLimitSeconds: null,
    options: [0, 1, 2, 3].map((index) => ({ text: "", isCorrect: index === 0 })),
    correctAnswer: true,
    expectedAnswers: "",
    pairs: [],
  };
}

/** The server shape of an edited question; only the fields its type uses are sent. */
export function toInput(draft: DraftQuestion): QuestionInput {
  const base: QuestionInput = { type: draft.type, prompt: draft.prompt.trim(), points: Number(draft.points) };
  if (draft.timeLimitSeconds) base.timeLimitSeconds = draft.timeLimitSeconds;
  switch (draft.type) {
    case "multiple_choice":
      return { ...base, options: draft.options.map(({ text, isCorrect }) => ({ text: text.trim(), isCorrect })) };
    case "true_false":
      return { ...base, correctAnswer: draft.correctAnswer };
    case "enumeration":
      return { ...base, expectedAnswers: draft.expectedAnswers.split("\n").map((line) => line.trim()).filter(Boolean) };
    case "matching":
      return { ...base, pairs: draft.pairs.map(({ left, right }) => ({ left: left.trim(), right: right.trim() })) };
    default:
      return base;
  }
}

/** Sets an exam in this subject may use: the subject's own, and older sets with no subject. */
export function setsForSubject(sets: QuestionSetSummary[], subjectId: number | undefined): QuestionSetSummary[] {
  return sets.filter((set) => set.subjectId === null || set.subjectId === subjectId);
}

/** "5 questions · 12 points" */
export function setFacts(set: { questionCount: number; totalPoints: number }): string {
  const questions = `${set.questionCount} ${set.questionCount === 1 ? "question" : "questions"}`;
  const points = `${set.totalPoints} ${set.totalPoints === 1 ? "point" : "points"}`;
  return `${questions} · ${points}`;
}

/** Server field errors for question i, e.g. "questions[2].pairs" → the pairs message. */
export function questionErrors(fieldErrors: Record<string, string[]> | undefined, index: number): string[] {
  const prefix = `questions[${index}].`;
  return Object.entries(fieldErrors ?? {}).filter(([field]) => field.startsWith(prefix)).flatMap(([, messages]) => messages);
}

const queryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;

export const questionSetKeys = {
  all: ["instructor", "question-sets"] as const,
  list: (instructorId: string) => [...questionSetKeys.all, instructorId] as const,
  detail: (instructorId: string, id: number) => [...questionSetKeys.all, instructorId, id] as const,
};

function useViewer(): Viewer {
  const { instructorId } = useInstructorSession();
  return useMemo(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
}

export function useQuestionSets() {
  const viewer = useViewer();
  return useQuery({
    queryKey: questionSetKeys.list(viewer.id),
    queryFn: ({ signal }) => getJson<QuestionSetSummary[]>("/api/questionnaires", { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id),
  });
}

export function useQuestionSet(id: number) {
  const viewer = useViewer();
  return useQuery({
    queryKey: questionSetKeys.detail(viewer.id, id),
    queryFn: ({ signal }) => getJson<QuestionSet>(`/api/questionnaires/${id}`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id) && Number.isInteger(id) && id > 0,
  });
}

export function useQuestionSetActions() {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const refreshOverview = useRefreshOverview();

  return useMemo(() => {
    // Exams are worth their set's points, so the overview refreshes too.
    const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: questionSetKeys.all }), refreshOverview()]);
    return {
      /** Saves the title (when changed) and the whole question list. */
      save: async (set: QuestionSet, title: string, questions: DraftQuestion[]): Promise<ActionResult> => {
        const result = await attempt(async () => {
          if (title.trim() !== set.title) await sendJson("PATCH", `/api/questionnaires/${set.id}`, { title }, { viewer });
          await sendJson("PUT", `/api/questionnaires/${set.id}/questions`, { questions: questions.map(toInput) }, { viewer });
        });
        if (result.ok) await refresh();
        return result;
      },
      /** A deep, unlocked copy; resolves with the copy's id. */
      copy: async (id: number): Promise<ActionResult & { copyId?: number }> => {
        let copyId: number | undefined;
        const result = await attempt(async () => {
          copyId = (await sendJson<QuestionSet>("POST", `/api/questionnaires/${id}/copy`, undefined, { viewer })).id;
        });
        if (result.ok) await refresh();
        return { ...result, copyId };
      },
    };
  }, [viewer, queryClient, refreshOverview]);
}
