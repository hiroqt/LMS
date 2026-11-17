import type { ImportedQuestion, ImportResult, Question, QuestionInput, QuestionsBody, QuestionSet, QuestionType, SectionInput } from "./questionSets";

/*
 * The question editor's working copy (D-040). Text stays text until it is saved, so a
 * half-typed number or a blank choice never throws; `toSaveBody` turns the sections
 * into the PUT …/questions body, and `draftProblems` says, in plain words, what a
 * question still needs. Drafts live only in memory: never in browser storage, because
 * lab computers are shared.
 */

export interface DraftOption {
  key: string;
  text: string;
  isCorrect: boolean;
}

export interface DraftPair {
  key: string;
  left: string;
  right: string;
}

export interface DraftQuestion {
  key: string;
  /** "" when an import could not tell the type. */
  type: QuestionType | "";
  prompt: string;
  points: string;
  timeLimitSeconds: number | null;
  options: DraftOption[];
  /** True or false, and modified true or false; null until chosen. */
  correctAnswer: boolean | null;
  /** One accepted answer per line. */
  expectedAnswers: string;
  pairs: DraftPair[];
  underlined: string;
  alwaysStrict: boolean;
  caseSensitive: boolean;
  /** The server's reasons from the last save; cleared when the question is edited. */
  problems: string[];
  /** From an import: the original text, the document's number, and the parser's notes. */
  source?: string;
  number?: number | null;
  warnings: string[];
}

export interface DraftSection {
  key: string;
  title: string;
  directions: string;
  /** New questions in the section start with these points. "" means none. */
  defaultPoints: string;
  questions: DraftQuestion[];
}

const TYPED: ReadonlySet<string> = new Set(["identification", "enumeration", "modified_true_false"]);
export const usesTypedAnswers = (type: QuestionType | "") => TYPED.has(type);

const MAX_CHOICES = 10;
const MAX_PAIRS = 20;

let counter = 0;
export function newKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

const blankOption = (): DraftOption => ({ key: newKey("o"), text: "", isCorrect: false });
const blankPair = (): DraftPair => ({ key: newKey("p"), left: "", right: "" });

export function blankSection(): DraftSection {
  return { key: newKey("s"), title: "", directions: "", defaultPoints: "", questions: [] };
}

/** A new question of a type, worth `points` (its section's default, or 1). */
export function blankQuestion(type: QuestionType, points = "1"): DraftQuestion {
  return withTypeFields({
    key: newKey("q"),
    type,
    prompt: "",
    points,
    timeLimitSeconds: null,
    options: [],
    correctAnswer: null,
    expectedAnswers: "",
    pairs: [],
    underlined: "",
    alwaysStrict: false,
    caseSensitive: false,
    problems: [],
    warnings: [],
  });
}

/** Gives a question the parts its type needs, keeping anything already typed. */
function withTypeFields(draft: DraftQuestion): DraftQuestion {
  if (draft.type === "multiple_choice" && draft.options.length < 2) {
    return { ...draft, options: [...draft.options, ...Array.from({ length: 4 - draft.options.length }, blankOption)] };
  }
  if (draft.type === "matching" && draft.pairs.length < 2) {
    return { ...draft, pairs: [...draft.pairs, ...Array.from({ length: 2 - draft.pairs.length }, blankPair)] };
  }
  return draft;
}

/** Changing the type keeps the prompt, the points, and every typed part (switching back restores them). */
export function changeType(draft: DraftQuestion, type: QuestionType): DraftQuestion {
  return withTypeFields({ ...draft, type, problems: [] });
}

/** The section's default points for a new question, or "1". */
export function pointsFor(section: DraftSection): string {
  const points = Number(section.defaultPoints);
  return section.defaultPoints.trim() && Number.isFinite(points) && points > 0 ? String(points) : "1";
}

/** True or false is stored as the options "True" and "False"; the correct one is the answer. */
function storedAnswer(question: Question): boolean | null {
  const correct = question.options.find((option) => option.isCorrect)?.text.trim().toLowerCase();
  return correct === "true" ? true : correct === "false" ? false : null;
}

export function toDraft(question: Question): DraftQuestion {
  const answerIsStored = question.type === "true_false" || question.type === "modified_true_false";
  return withTypeFields({
    key: `q-${question.id}`,
    type: question.type,
    prompt: question.prompt,
    points: String(question.points),
    timeLimitSeconds: question.timeLimitSeconds,
    options: question.type === "multiple_choice" ? question.options.map(({ text, isCorrect }) => ({ key: newKey("o"), text, isCorrect })) : [],
    correctAnswer: answerIsStored ? storedAnswer(question) : null,
    expectedAnswers: question.expectedAnswers.join("\n"),
    pairs: question.pairs.map(({ left, right }) => ({ key: newKey("p"), left, right })),
    underlined: question.underlined ?? "",
    alwaysStrict: Boolean(question.alwaysStrict),
    caseSensitive: Boolean(question.caseSensitive),
    problems: question.incomplete ? (question.problems ?? []) : [],
    warnings: [],
  });
}

/** A saved set as editor sections. A set saved before sections existed is one unnamed section. */
export function toDraftSections(set: Pick<QuestionSet, "sections" | "questions">): DraftSection[] {
  const sections = [...(set.sections ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const drafts: DraftSection[] = sections.map((section) => ({
    key: `s-${section.id}`,
    title: section.title,
    directions: section.directions ?? "",
    defaultPoints: section.defaultPoints === null ? "" : String(section.defaultPoints),
    questions: [],
  }));
  if (!drafts.length) drafts.push(blankSection());
  const index = new Map(sections.map((section, i) => [section.id, i]));
  for (const question of [...set.questions].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const at = (question.sectionId !== undefined && question.sectionId !== null ? index.get(question.sectionId) : undefined) ?? 0;
    drafts[at]!.questions.push(toDraft(question));
  }
  return drafts;
}

const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);
const joinAnswers = (answers: string[] | undefined) => (answers ?? []).join("\n");

/** One imported question as a draft, with its original text and warnings. */
export function fromImported(question: ImportedQuestion): DraftQuestion {
  const type = question.type ?? "";
  return withTypeFields({
    key: newKey("q"),
    type,
    prompt: question.prompt ?? "",
    points: question.points === undefined || question.points === null ? "1" : String(question.points),
    timeLimitSeconds: question.timeLimitSeconds ?? null,
    options: (question.options ?? []).map(({ text, isCorrect }) => ({ key: newKey("o"), text, isCorrect })),
    correctAnswer: question.correctAnswer ?? null,
    expectedAnswers: joinAnswers(question.expectedAnswers),
    pairs: (question.pairs ?? []).map(({ left, right }) => ({ key: newKey("p"), left, right })),
    underlined: question.underlined ?? "",
    alwaysStrict: Boolean(question.alwaysStrict),
    caseSensitive: Boolean(question.caseSensitive),
    problems: [],
    source: question.source,
    number: question.number,
    warnings: question.warnings ?? [],
  });
}

/** The import's sections and questions as editor sections. */
export function fromImport(result: Pick<ImportResult, "sections" | "questions">): DraftSection[] {
  const sections: DraftSection[] = result.sections.map((section) => ({
    key: newKey("s"),
    title: section.title ?? "",
    directions: section.directions ?? "",
    defaultPoints: section.defaultPoints === null || section.defaultPoints === undefined ? "" : String(section.defaultPoints),
    questions: [],
  }));
  if (!sections.length) sections.push(blankSection());
  for (const question of result.questions) {
    const at = question.section !== undefined && question.section >= 0 && question.section < sections.length ? question.section : 0;
    sections[at]!.questions.push(fromImported(question));
  }
  return sections;
}

/** Imported sections go after the current ones; a lone empty, unnamed section is replaced. */
export function appendSections(current: DraftSection[], added: DraftSection[]): DraftSection[] {
  const empty = current.length === 1 && !current[0]!.questions.length && !current[0]!.title.trim() && !current[0]!.directions.trim();
  return empty ? added : [...current, ...added];
}

/** The server shape of an edited question; only the fields its type uses are sent. */
export function toInput(draft: DraftQuestion, section?: number): QuestionInput {
  const points = Number(draft.points);
  const base: QuestionInput = {
    // The editor refuses to save an untyped question first (see untypedQuestions).
    type: draft.type as QuestionType,
    prompt: draft.prompt.trim(),
    // A blank or invalid value saves as 0 and is marked incomplete.
    points: draft.points.trim() && Number.isFinite(points) ? points : 0,
  };
  if (draft.timeLimitSeconds) base.timeLimitSeconds = draft.timeLimitSeconds;
  if (section !== undefined) base.section = section;
  if (usesTypedAnswers(draft.type)) Object.assign(base, { alwaysStrict: draft.alwaysStrict, caseSensitive: draft.caseSensitive });
  const answer = draft.correctAnswer === null ? {} : { correctAnswer: draft.correctAnswer };
  switch (draft.type) {
    case "multiple_choice":
      return { ...base, options: draft.options.map(({ text, isCorrect }) => ({ text: text.trim(), isCorrect })) };
    case "true_false":
      return { ...base, ...answer };
    case "identification":
    case "enumeration":
      return { ...base, expectedAnswers: lines(draft.expectedAnswers) };
    case "modified_true_false":
      return { ...base, underlined: draft.underlined.trim(), ...answer, ...(draft.correctAnswer === false ? { expectedAnswers: lines(draft.expectedAnswers) } : {}) };
    case "matching":
      return { ...base, pairs: draft.pairs.map(({ left, right }) => ({ left: left.trim(), right: right.trim() })) };
    default:
      return base;
  }
}

export function toSectionInput(section: DraftSection): SectionInput {
  const points = Number(section.defaultPoints);
  return {
    title: section.title.trim(),
    directions: section.directions.trim(),
    defaultPoints: section.defaultPoints.trim() && Number.isFinite(points) ? points : null,
  };
}

/** The PUT …/questions body: every section, then every question pointing at its section. */
export function toSaveBody(sections: DraftSection[], allowIncomplete: boolean): QuestionsBody {
  return {
    sections: sections.map(toSectionInput),
    questions: sections.flatMap((section, index) => section.questions.map((draft) => toInput(draft, index))),
    allowIncomplete,
  };
}

/** Every question in order, numbered from 1 across sections. */
export function flatten(sections: DraftSection[]): DraftQuestion[] {
  return sections.flatMap((section) => section.questions);
}

/** Questions whose type was never chosen: the server refuses an unknown type outright. */
export function untypedQuestions(sections: DraftSection[]): number[] {
  return flatten(sections).flatMap((draft, index) => (draft.type ? [] : [index + 1]));
}

/** What a question still needs, in plain words (the contract's content rules, §1). Empty when complete. */
export function draftProblems(draft: DraftQuestion): string[] {
  const problems: string[] = [];
  if (!draft.type) return ["Choose the type."];
  if (!draft.prompt.trim()) problems.push(draft.type === "true_false" || draft.type === "modified_true_false" ? "Enter the statement." : "Enter the question.");
  const points = Number(draft.points);
  if (!draft.points.trim() || !Number.isFinite(points) || points <= 0 || points > 1000) problems.push("Give it more than 0 and at most 1000 points.");
  const answers = lines(draft.expectedAnswers);
  switch (draft.type) {
    case "multiple_choice": {
      if (draft.options.length < 2 || draft.options.length > MAX_CHOICES) problems.push("Give 2 to 10 choices.");
      if (draft.options.some((option) => !option.text.trim())) problems.push("Fill in every choice, or remove the empty ones.");
      if (draft.options.filter((option) => option.isCorrect).length !== 1) problems.push("Mark the correct choice.");
      break;
    }
    case "true_false":
      if (draft.correctAnswer === null) problems.push("Say whether the statement is true or false.");
      break;
    case "identification":
      if (answers.length < 1 || answers.length > 10) problems.push("Give 1 to 10 accepted answers.");
      break;
    case "enumeration":
      if (answers.length < 1 || answers.length > 20) problems.push("Give 1 to 20 accepted answers.");
      break;
    case "modified_true_false":
      if (!draft.underlined.trim()) problems.push("Enter the underlined phrase.");
      else if (!draft.prompt.toLowerCase().includes(draft.underlined.trim().toLowerCase())) problems.push("The underlined phrase must appear in the statement.");
      if (draft.correctAnswer === null) problems.push("Say whether the statement is true or false.");
      else if (!draft.correctAnswer && (answers.length < 1 || answers.length > 10)) problems.push("Give 1 to 10 accepted corrections.");
      break;
    case "matching":
      if (draft.pairs.length < 2 || draft.pairs.length > MAX_PAIRS) problems.push("Give 2 to 20 pairs.");
      if (draft.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) problems.push("Fill in both sides of every pair.");
      break;
    default:
      break;
  }
  return problems;
}

/** Live problems while editing; the server's from the last save until the question changes. */
export function attentionFor(draft: DraftQuestion): string[] {
  const local = draftProblems(draft);
  return local.length ? local : draft.problems;
}

export interface SetSummary {
  count: number;
  totalPoints: number;
  types: QuestionType[];
  /** Questions that need attention, by key and number. */
  attention: Array<{ key: string; number: number }>;
}

export function summarize(sections: DraftSection[]): SetSummary {
  const all = flatten(sections);
  const types = new Set<QuestionType>();
  let totalPoints = 0;
  const attention: SetSummary["attention"] = [];
  all.forEach((draft, index) => {
    if (draft.type) types.add(draft.type);
    const points = Number(draft.points);
    if (Number.isFinite(points) && points > 0) totalPoints += points;
    if (attentionFor(draft).length) attention.push({ key: draft.key, number: index + 1 });
  });
  return { count: all.length, totalPoints: Math.round(totalPoints * 100) / 100, types: [...types], attention };
}

/**
 * After a save: the server's `problems` for each question. `sent` is the sections as they were
 * sent; the stored questions come back in that order, so each is matched to the sent question's
 * key, not to whatever sits at its position now. The editor stays open during a save, so a
 * question added, moved, or edited meanwhile is left as it is: an edit already cleared its
 * problems, and the server's would describe the version before it.
 */
export function applySaved(sections: DraftSection[], saved: QuestionSet, sent: DraftSection[] = sections): DraftSection[] {
  const ordered = [...saved.questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const byKey = new Map(flatten(sent).map((draft, index) => [draft.key, { draft, stored: ordered[index] }]));
  return sections.map((section) => ({
    ...section,
    questions: section.questions.map((draft) => {
      const match = byKey.get(draft.key);
      if (!match || match.draft !== draft) return draft;
      return { ...draft, problems: match.stored?.incomplete ? (match.stored.problems ?? []) : [] };
    }),
  }));
}

// ---- Choices -------------------------------------------------------------

/** "a. var", "B) const", "(c) let", "- final" → the choice text. */
const CHOICE_MARK = /^(?:\(?[a-jA-J][.)]|[-*•])\s+/;

/** Pasted lines as choices: blank lines dropped, letters and bullets removed. */
export function splitChoiceLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim().replace(CHOICE_MARK, "").trim()).filter(Boolean);
}

/**
 * Pasting several lines into choice `index`: the first line replaces that choice and the rest
 * follow it, up to 10 choices. Returns the new choices and how many lines did not fit.
 */
export function pasteChoices(options: DraftOption[], index: number, pasted: string[]): { options: DraftOption[]; dropped: number } {
  const room = MAX_CHOICES - options.length;
  const [first = "", ...rest] = pasted;
  const added = rest.slice(0, Math.max(0, room)).map((text) => ({ key: newKey("o"), text, isCorrect: false }));
  const next = options.map((option, i) => (i === index ? { ...option, text: first } : option));
  next.splice(index + 1, 0, ...added);
  return { options: next, dropped: rest.length - added.length };
}

export const canAddChoice = (draft: DraftQuestion) => draft.options.length < MAX_CHOICES;
export const canAddPair = (draft: DraftQuestion) => draft.pairs.length < MAX_PAIRS;
export const addChoice = (draft: DraftQuestion): DraftOption[] => (canAddChoice(draft) ? [...draft.options, blankOption()] : draft.options);
export const addPair = (draft: DraftQuestion): DraftPair[] => (canAddPair(draft) ? [...draft.pairs, blankPair()] : draft.pairs);

/** Modified true or false: the statement split around its underlined phrase (first match, ignoring case). */
export function splitUnderlined(prompt: string, phrase: string): [string, string, string] | null {
  const needle = phrase.trim();
  if (!needle) return null;
  const at = prompt.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return null;
  return [prompt.slice(0, at), prompt.slice(at, at + needle.length), prompt.slice(at + needle.length)];
}

// ---- Moving questions and sections --------------------------------------

/** A copy of `list` with `remove` items at `start` replaced by `insert` (Array#toSpliced, for older browsers). */
function spliced<T>(list: readonly T[], start: number, remove: number, ...insert: T[]): T[] {
  const copy = [...list];
  copy.splice(start, remove, ...insert);
  return copy;
}

function locate(sections: DraftSection[], key: string): [number, number] | null {
  for (let s = 0; s < sections.length; s += 1) {
    const q = sections[s]!.questions.findIndex((draft) => draft.key === key);
    if (q >= 0) return [s, q];
  }
  return null;
}

export function updateQuestion(sections: DraftSection[], key: string, change: (draft: DraftQuestion) => DraftQuestion): DraftSection[] {
  return sections.map((section) => (section.questions.some((draft) => draft.key === key) ? { ...section, questions: section.questions.map((draft) => (draft.key === key ? change(draft) : draft)) } : section));
}

export function addQuestion(sections: DraftSection[], sectionKey: string, type: QuestionType): { sections: DraftSection[]; key: string } {
  let key = "";
  const next = sections.map((section) => {
    if (section.key !== sectionKey) return section;
    const draft = blankQuestion(type, pointsFor(section));
    key = draft.key;
    return { ...section, questions: [...section.questions, draft] };
  });
  return { sections: next, key };
}

export function duplicateQuestion(sections: DraftSection[], key: string): { sections: DraftSection[]; key: string } {
  const at = locate(sections, key);
  if (!at) return { sections, key };
  const original = sections[at[0]]!.questions[at[1]]!;
  const copy: DraftQuestion = {
    ...original,
    key: newKey("q"),
    options: original.options.map((option) => ({ ...option, key: newKey("o") })),
    pairs: original.pairs.map((pair) => ({ ...pair, key: newKey("p") })),
    problems: [],
  };
  const next = sections.map((section, s) => (s === at[0] ? { ...section, questions: spliced(section.questions, at[1] + 1, 0, copy) } : section));
  return { sections: next, key: copy.key };
}

export function removeQuestion(sections: DraftSection[], key: string): DraftSection[] {
  return sections.map((section) => ({ ...section, questions: section.questions.filter((draft) => draft.key !== key) }));
}

/** Moves a question one place; past the edge of its section it joins the neighboring section. */
export function moveQuestion(sections: DraftSection[], key: string, direction: -1 | 1): DraftSection[] {
  const at = locate(sections, key);
  if (!at) return sections;
  const [s, q] = at;
  const list = sections[s]!.questions;
  const draft = list[q]!;
  const target = q + direction;
  if (target >= 0 && target < list.length) {
    const moved = spliced(spliced(list, q, 1), target, 0, draft);
    return sections.map((section, i) => (i === s ? { ...section, questions: moved } : section));
  }
  const neighbor = s + direction;
  if (neighbor < 0 || neighbor >= sections.length) return sections;
  return sections.map((section, i) => {
    if (i === s) return { ...section, questions: spliced(list, q, 1) };
    if (i === neighbor) return { ...section, questions: direction < 0 ? [...section.questions, draft] : [draft, ...section.questions] };
    return section;
  });
}

/** Whether a question can move: not past the first or last question of the set. */
export function canMove(sections: DraftSection[], key: string, direction: -1 | 1): boolean {
  const all = flatten(sections);
  const index = all.findIndex((draft) => draft.key === key);
  if (index < 0) return false;
  if (direction < 0) return index > 0 || locate(sections, key)![0] > 0;
  return index < all.length - 1 || locate(sections, key)![0] < sections.length - 1;
}

export function moveSection(sections: DraftSection[], key: string, direction: -1 | 1): DraftSection[] {
  const index = sections.findIndex((section) => section.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  return spliced(spliced(sections, index, 1), target, 0, sections[index]!);
}

// ---- Server errors -------------------------------------------------------

export interface MappedErrors {
  /** By question key: messages, with the field each one is about. */
  questions: Record<string, Array<{ field: string; message: string }>>;
  /** By section key. */
  sections: Record<string, Array<{ field: string; message: string }>>;
  /** Messages about the whole list ("questions"). */
  general: string[];
}

const PATH = /^(questions|sections)\[(\d+)\]\.?(.*)$/;

/** Server field errors (`questions[i].field`, `sections[i].field`) mapped to the cards they are about. */
export function mapFieldErrors(fieldErrors: Record<string, string[]> | undefined, sections: DraftSection[]): MappedErrors {
  const all = flatten(sections);
  const mapped: MappedErrors = { questions: {}, sections: {}, general: [] };
  for (const [path, messages] of Object.entries(fieldErrors ?? {})) {
    const match = PATH.exec(path);
    const target = match ? (match[1] === "questions" ? all[Number(match[2])] : sections[Number(match[2])]) : undefined;
    if (!match || !target) {
      if (path === "questions" || path === "sections" || path.startsWith("questions") || path.startsWith("sections")) mapped.general.push(...messages);
      continue;
    }
    const bucket = match[1] === "questions" ? mapped.questions : mapped.sections;
    bucket[target.key] = [...(bucket[target.key] ?? []), ...messages.map((message) => ({ field: match[3] ?? "", message }))];
  }
  return mapped;
}

/** The key of the first question or section with an error, in page order. */
export function firstErrorKey(errors: MappedErrors, sections: DraftSection[]): string | null {
  for (const section of sections) {
    if (errors.sections[section.key]?.length) return section.key;
    for (const draft of section.questions) if (errors.questions[draft.key]?.length) return draft.key;
  }
  return null;
}
