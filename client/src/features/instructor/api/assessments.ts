import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getJson, isApiError, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import { attempt, instant } from "./actions";
import { toSaveBody, untypedQuestions, type DraftSection } from "./questionDrafts";
import { questionSetKeys, useInstructorViewer, type QuestionSet } from "./questionSets";
import { useRefreshOverview } from "./store";

/*
 * The assessment builder's settings and its save (D-040, contract §3). Writing or
 * importing questions saves them as the exam's own set (POST /api/questionnaires once,
 * then PUT …/questions); "Use a question set" points the exam at one of the
 * instructor's sets (D-034). Then the exam is created or patched with the settings.
 */

export type AnswerReview = "score_only" | "results" | "answers_after_due" | "answers_after_submit";
export type SpellingMode = "strict" | "typos" | "review";
export type QuestionSource = "write" | "import" | "use";

export const ANSWER_REVIEW_OPTIONS: Array<{ value: AnswerReview; label: string }> = [
  { value: "score_only", label: "Their score only" },
  { value: "results", label: "Their score and which questions were right" },
  { value: "answers_after_due", label: "The correct answers, after the due date" },
  { value: "answers_after_submit", label: "The correct answers, right after submitting" },
];

export const SPELLING_OPTIONS: Array<{ value: SpellingMode; label: string; hint: string }> = [
  { value: "strict", label: "Strict", hint: "A typed answer must match an accepted answer. Extra spaces and end punctuation are ignored." },
  { value: "typos", label: "Allow small typos", hint: "A near miss, such as “Babage” for “Babbage”, gets full points and is flagged for you." },
  { value: "review", label: "I’ll check near misses", hint: "A near miss waits for you to accept or reject it before the score is final." },
];

export const CATEGORY_PRESETS = ["Quiz", "Long quiz", "Exam"] as const;

/** GET /api/classes/{classId}/coursework/{id}, as the builder reads it. */
export interface CourseworkDto {
  id: number;
  moduleId: number;
  type: string;
  title: string;
  category: string | null;
  instructions: string | null;
  maxPoints: number;
  dueAt: string | null;
  availableFrom: string | null;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  questionnaireId: number | null;
  questionCount: number;
  status: string;
  answerReview?: AnswerReview;
  spellingMode?: SpellingMode;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
}

/** The builder's details and settings; numbers stay text until saved. */
export interface AssessmentSettings {
  title: string;
  moduleId: string;
  category: string;
  instructions: string;
  /** datetime-local values, "" for none. */
  dueAt: string;
  availableFrom: string;
  attempts: string;
  /** Minutes, "0" for no limit. */
  timeLimit: string;
  answerReview: AnswerReview;
  spellingMode: SpellingMode;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
}

export function defaultSettings(moduleId: string): AssessmentSettings {
  return {
    title: "",
    moduleId,
    category: "Quiz",
    instructions: "",
    dueAt: "",
    availableFrom: "",
    attempts: "1",
    timeLimit: "0",
    answerReview: "results",
    spellingMode: "strict",
    shuffleQuestions: false,
    shuffleChoices: false,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** An instant as a datetime-local value in the browser's time zone; null stays "". */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function settingsFromDto(dto: CourseworkDto): AssessmentSettings {
  return {
    title: dto.title,
    moduleId: String(dto.moduleId),
    category: dto.category ?? "",
    instructions: dto.instructions ?? "",
    dueAt: toLocalInput(dto.dueAt),
    availableFrom: toLocalInput(dto.availableFrom),
    attempts: String(dto.maxAttempts ?? 1),
    timeLimit: String(dto.timeLimitMinutes ?? 0),
    answerReview: dto.answerReview ?? "results",
    spellingMode: dto.spellingMode ?? "strict",
    shuffleQuestions: Boolean(dto.shuffleQuestions),
    shuffleChoices: Boolean(dto.shuffleChoices),
  };
}

export type SettingsErrors = Partial<Record<keyof AssessmentSettings | "questions" | "publish", string>>;

/** What the builder checks before sending anything; the server checks again. */
export function validateSettings(settings: AssessmentSettings): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!settings.title.trim()) errors.title = "Enter a title.";
  if (!settings.moduleId) errors.moduleId = "Choose a module.";
  if (settings.category.trim().length > 40) errors.category = "Use at most 40 characters.";
  const attempts = Number(settings.attempts);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) errors.attempts = "Allow 1 to 20 attempts.";
  const minutes = Number(settings.timeLimit || "0");
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) errors.timeLimit = "Use 0 to 600 minutes (0 means no limit).";
  if (settings.dueAt && settings.availableFrom && new Date(settings.dueAt) <= new Date(settings.availableFrom)) errors.dueAt = "The due date must be after the date it becomes available.";
  return errors;
}

const COURSEWORK_FIELDS: Record<string, keyof SettingsErrors> = {
  title: "title",
  moduleId: "moduleId",
  category: "category",
  instructions: "instructions",
  dueAt: "dueAt",
  availableFrom: "availableFrom",
  maxAttempts: "attempts",
  timeLimitMinutes: "timeLimit",
  answerReview: "answerReview",
  spellingMode: "spellingMode",
  questionnaireId: "publish",
  status: "publish",
};

/** The server's coursework field errors on the builder's fields; anything else is about publishing. */
export function courseworkErrors(fieldErrors: Record<string, string[]> | undefined): SettingsErrors {
  const errors: SettingsErrors = {};
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const key = COURSEWORK_FIELDS[field] ?? "publish";
    if (messages[0] && !errors[key]) errors[key] = messages[0];
  }
  return errors;
}

export function courseworkBody(settings: AssessmentSettings, questionnaireId: number, status: "draft" | "published") {
  return {
    moduleId: Number(settings.moduleId),
    title: settings.title.trim(),
    category: settings.category.trim() || "Quiz",
    instructions: settings.instructions,
    dueAt: instant(settings.dueAt),
    availableFrom: instant(settings.availableFrom),
    timeLimitMinutes: Number(settings.timeLimit || "0"),
    maxAttempts: Number(settings.attempts),
    questionnaireId,
    status,
    answerReview: settings.answerReview,
    spellingMode: settings.spellingMode,
    shuffleQuestions: settings.shuffleQuestions,
    shuffleChoices: settings.shuffleChoices,
  };
}

export interface SaveRequest {
  classId: string;
  /** Null until the exam has been created. */
  examId: number | null;
  /** The class's ISMS subject: the exam's own set belongs to it. */
  subjectId: number | undefined;
  settings: AssessmentSettings;
  status: "draft" | "published";
  /** The exam's own questions (written or imported), or one of the instructor's sets. */
  questions: { source: "own"; setId: number | null; setTitle: string | null; sections: DraftSection[] } | { source: "set"; setId: number | null };
}

export interface SaveOutcome {
  ok: boolean;
  /** Which step failed: the set, its questions, or the exam. */
  stage?: "set" | "questions" | "exam";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  examId: number | null;
  /** The exam's own set, once created, so a retry never makes a second one. */
  setId: number | null;
  /** The set as the server stored it (incomplete questions marked). */
  saved?: QuestionSet;
}

export type Sender = <T>(method: "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<T>;

const classPath = (classId: string) => `/api/classes/${encodeURIComponent(classId)}`;

/** Saves the questions (when they are the exam's own) and then the exam, step by step. */
export async function saveAssessment(send: Sender, request: SaveRequest): Promise<SaveOutcome> {
  const { questions, settings } = request;
  let setId = questions.setId;
  let examId = request.examId;
  let saved: QuestionSet | undefined;
  const fail = async (stage: NonNullable<SaveOutcome["stage"]>, change: () => Promise<unknown>) => {
    const result = await attempt(change);
    return result.ok ? null : { ...result, stage, examId, setId, saved };
  };

  if (questions.source === "set") {
    if (setId === null) return { ok: false, stage: "questions", message: "Choose a question set.", fieldErrors: { questionnaireId: ["Choose a question set."] }, examId, setId };
  } else {
    const untyped = untypedQuestions(questions.sections);
    if (untyped.length) {
      const message = `Choose the type of question ${untyped.join(", ")}.`;
      return { ok: false, stage: "questions", message, fieldErrors: Object.fromEntries(untyped.map((n) => [`questions[${n - 1}].type`, ["Choose the type."]])), examId, setId };
    }
    const title = settings.title.trim();
    const setStep = await fail("set", async () => {
      if (setId === null) setId = (await send<QuestionSet>("POST", "/api/questionnaires", { title, subjectId: request.subjectId })).id;
      else if (questions.setTitle !== null && questions.setTitle !== title) await send("PATCH", `/api/questionnaires/${setId}`, { title });
    });
    if (setStep) return setStep;
    const questionStep = await fail("questions", async () => {
      saved = await send<QuestionSet>("PUT", `/api/questionnaires/${setId}/questions`, toSaveBody(questions.sections, true));
    });
    if (questionStep) return questionStep;
  }

  const body = courseworkBody(settings, setId!, request.status);
  const examStep = await fail("exam", async () => {
    if (examId === null) examId = (await send<CourseworkDto>("POST", `${classPath(request.classId)}/coursework`, { type: "exam", ...body })).id;
    else await send("PATCH", `${classPath(request.classId)}/coursework/${examId}`, body);
  });
  if (examStep) return examStep;
  return { ok: true, examId, setId, saved };
}

export const assessmentKeys = {
  detail: (instructorId: string, classId: string, id: number) => ["instructor", "assessment", instructorId, classId, id] as const,
};

export function useAssessment(classId: string, id: number) {
  const viewer = useInstructorViewer();
  return useQuery({
    queryKey: assessmentKeys.detail(viewer.id, classId, id),
    queryFn: ({ signal }) => getJson<CourseworkDto>(`${classPath(classId)}/coursework/${id}`, { identity: true, viewer, signal }),
    retry: shouldRetryApiRead,
    networkMode: "always",
    enabled: Boolean(viewer.id) && Number.isInteger(id) && id > 0,
    // The builder keeps its own copy while open; a refetch must not replace it.
    staleTime: Infinity,
  });
}

/** Saves through the API as the viewed instructor, then refreshes Classwork and the Question sets page. */
export function useSaveAssessment() {
  const viewer = useInstructorViewer();
  const queryClient = useQueryClient();
  const refreshOverview = useRefreshOverview();
  return useCallback(
    async (request: SaveRequest) => {
      const outcome = await saveAssessment((method, path, body) => sendJson(method, path, body, { viewer }), request);
      await Promise.all([refreshOverview(), queryClient.invalidateQueries({ queryKey: questionSetKeys.all })]);
      return outcome;
    },
    [viewer, queryClient, refreshOverview],
  );
}

export const isNotFound = (error: unknown) => isApiError(error) && error.status === 404;
