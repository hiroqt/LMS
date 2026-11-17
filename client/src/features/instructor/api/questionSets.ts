import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getFile, getJson, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { attempt, type ActionResult } from "./actions";
import { toSaveBody, type DraftSection } from "./questionDrafts";
import { useRefreshOverview } from "./store";

/*
 * Question sets (the API's "questionnaires") are owned by one instructor and can
 * back exams in several classes of the same subject (D-034). A set is locked once
 * a student has started an exam that uses it; a copy is the way to change it.
 * Shapes: docs/ASSESSMENTS_API_CONTRACT.md §1–2 (D-040, D-041). Fields the contract
 * added are optional here, so a set saved before them still reads.
 */

export type QuestionType = "multiple_choice" | "true_false" | "identification" | "enumeration" | "essay" | "modified_true_false" | "matching";

/** Every type, in the order the "Add question" menu offers them. */
export const QUESTION_TYPES: readonly QuestionType[] = ["multiple_choice", "true_false", "modified_true_false", "identification", "enumeration", "matching", "essay"];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  modified_true_false: "Modified true or false",
  identification: "Identification",
  enumeration: "Enumeration",
  matching: "Matching",
  essay: "Essay",
};

/** One line under each type in the "Add question" menu. */
export const QUESTION_TYPE_HINTS: Record<QuestionType, string> = {
  multiple_choice: "Students pick one of 2 to 10 choices.",
  true_false: "Students say whether a statement is true.",
  modified_true_false: "If false, students correct the underlined phrase.",
  identification: "Students type a word or phrase.",
  enumeration: "Students list several answers, in any order.",
  matching: "Students match each item to its pair.",
  essay: "Students write; you grade it yourself.",
};

/** Types whose answers are typed, so spelling and capitals matter. */
export const TYPED_ANSWER_TYPES: readonly QuestionType[] = ["identification", "enumeration", "modified_true_false"];

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
  /** Questions saved as incomplete (D-040). */
  incompleteCount?: number;
}

export interface Section {
  id: number;
  title: string;
  directions: string | null;
  defaultPoints: number | null;
  sortOrder: number;
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
  sectionId?: number | null;
  /** Modified true or false: the phrase drawn underlined. */
  underlined?: string | null;
  /** Spelling: ignore the exam's typo setting. */
  alwaysStrict?: boolean;
  /** Capitals matter ("Co" vs "CO"). */
  caseSensitive?: boolean;
  incomplete?: boolean;
  /** Plain sentences, when incomplete. */
  problems?: string[];
}

export interface QuestionSet {
  id: number;
  title: string;
  subjectId: number | null;
  locked: boolean;
  /** At least one once saved; absent from a server before D-040. */
  sections?: Section[];
  questions: Question[];
  usedBy: QuestionUse[];
}

export interface SectionInput {
  title: string;
  directions: string;
  defaultPoints: number | null;
}

/** What PUT /api/questionnaires/{id}/questions takes for one question. */
export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  points: number;
  timeLimitSeconds?: number;
  /** Index into the request's sections. */
  section?: number;
  options?: Array<{ text: string; isCorrect: boolean }>;
  correctAnswer?: boolean;
  expectedAnswers?: string[];
  pairs?: Array<{ left: string; right: string }>;
  underlined?: string;
  alwaysStrict?: boolean;
  caseSensitive?: boolean;
}

export interface QuestionsBody {
  sections: SectionInput[];
  questions: QuestionInput[];
  allowIncomplete: boolean;
}

/** One question read from a document: a QuestionInput the parser may have left unfinished. */
export interface ImportedQuestion extends Partial<Omit<QuestionInput, "type">> {
  /** Null when the parser could not tell; its warning says "Choose the type." */
  type?: QuestionType | null;
  /** The number in the document. */
  number: number | null;
  /** The question's original text. */
  source: string;
  warnings: string[];
}

/** POST /api/questionnaires/import: drafts only; nothing is saved (D-041). */
export interface ImportResult {
  format: "docx" | "xlsx" | "csv" | "text";
  title: string | null;
  sections: SectionInput[];
  questions: ImportedQuestion[];
  /** Whole-document notes, such as numbering gaps. */
  warnings: string[];
}

export type TemplateFormat = "docx" | "xlsx" | "csv";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_CHARS = 200_000;
export const IMPORT_EXTENSIONS = [".docx", ".xlsx", ".csv", ".txt"] as const;

/** A plain reason the file cannot be sent, or null when it can (the server checks again). */
export function importFileProblem(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  if (!IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension)) || file.size > IMPORT_MAX_BYTES) return "Upload a .docx, .xlsx, .csv, or .txt file of at most 5 MB.";
  if (file.size === 0) return "This file is empty.";
  return null;
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

const queryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;

export const questionSetKeys = {
  all: ["instructor", "question-sets"] as const,
  list: (instructorId: string) => [...questionSetKeys.all, instructorId] as const,
  detail: (instructorId: string, id: number) => [...questionSetKeys.all, instructorId, id] as const,
};

export function useInstructorViewer(): Viewer {
  const { instructorId } = useInstructorSession();
  return useMemo(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
}

export function useQuestionSets() {
  const viewer = useInstructorViewer();
  return useQuery({
    queryKey: questionSetKeys.list(viewer.id),
    queryFn: ({ signal }) => getJson<QuestionSetSummary[]>("/api/questionnaires", { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id),
  });
}

export function useQuestionSet(id: number) {
  const viewer = useInstructorViewer();
  return useQuery({
    queryKey: questionSetKeys.detail(viewer.id, id),
    queryFn: ({ signal }) => getJson<QuestionSet>(`/api/questionnaires/${id}`, { identity: true, viewer, signal }),
    ...queryOptions,
    enabled: Boolean(viewer.id) && Number.isInteger(id) && id > 0,
  });
}

/** Creates an empty set; the questions are saved with `putQuestions`. */
export function createSet(viewer: Viewer, title: string, subjectId: number | undefined) {
  return sendJson<QuestionSet>("POST", "/api/questionnaires", { title: title.trim(), subjectId }, { viewer });
}

/** Replaces the whole question list. Incomplete questions are kept and marked (D-040). */
export function putQuestions(viewer: Viewer, id: number, sections: DraftSection[]) {
  return sendJson<QuestionSet>("PUT", `/api/questionnaires/${id}/questions`, toSaveBody(sections, true), { viewer });
}

/** Reads a file or pasted text into drafts; nothing is saved (D-041). */
export function importQuestions(viewer: Viewer, input: { file: File } | { text: string }) {
  let body: FormData | { text: string };
  if ("file" in input) {
    body = new FormData();
    body.append("file", input.file);
  } else body = { text: input.text };
  // A long document can take a while to read.
  return sendJson<ImportResult>("POST", "/api/questionnaires/import", body, { viewer, timeoutMs: 60_000 });
}

export function downloadTemplate(viewer: Viewer, format: TemplateFormat) {
  return getFile("/api/questionnaires/import/template", { viewer, params: { format } });
}

export function useQuestionSetActions() {
  const viewer = useInstructorViewer();
  const queryClient = useQueryClient();
  const refreshOverview = useRefreshOverview();

  return useMemo(() => {
    // Exams are worth their set's points, so the overview refreshes too.
    const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: questionSetKeys.all }), refreshOverview()]);
    return {
      /** Saves the title (when changed) and the whole question list; resolves with the saved set. */
      save: async (set: QuestionSet, title: string, sections: DraftSection[]): Promise<ActionResult & { saved?: QuestionSet }> => {
        let saved: QuestionSet | undefined;
        const result = await attempt(async () => {
          if (title.trim() !== set.title) await sendJson("PATCH", `/api/questionnaires/${set.id}`, { title }, { viewer });
          saved = await putQuestions(viewer, set.id, sections);
        });
        if (result.ok) await refresh();
        return { ...result, saved };
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
      /** A new, empty set for a subject; resolves with its id. */
      create: async (title: string, subjectId: number | undefined): Promise<ActionResult & { id?: number }> => {
        let id: number | undefined;
        const result = await attempt(async () => {
          id = (await createSet(viewer, title, subjectId)).id;
        });
        if (result.ok) await queryClient.invalidateQueries({ queryKey: questionSetKeys.all });
        return { ...result, id };
      },
    };
  }, [viewer, queryClient, refreshOverview]);
}
