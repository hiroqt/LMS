import { describe, expect, it } from "vitest";
import {
  addQuestion,
  appendSections,
  applySaved,
  attentionFor,
  blankQuestion,
  blankSection,
  canMove,
  changeType,
  draftProblems,
  duplicateQuestion,
  firstErrorKey,
  flatten,
  fromImport,
  mapFieldErrors,
  moveQuestion,
  pasteChoices,
  splitChoiceLines,
  splitUnderlined,
  summarize,
  toDraft,
  toDraftSections,
  toInput,
  toSaveBody,
  untypedQuestions,
  type DraftQuestion,
  type DraftSection,
} from "./questionDrafts";
import type { Question, QuestionSet } from "./questionSets";

// Fictional questions, shaped like GET /api/questionnaires/{id} (contract §2).
const base = { sortOrder: 1, timeLimitSeconds: null, options: [], expectedAnswers: [], pairs: [] };
const questions: Question[] = [
  { ...base, id: 1, type: "multiple_choice", prompt: "Which key identifies a row?", points: 2, timeLimitSeconds: 60, options: [{ id: 10, text: "Primary key", isCorrect: true }, { id: 11, text: "Foreign key", isCorrect: false }] },
  { ...base, id: 2, type: "true_false", prompt: "SQL keywords are case-sensitive.", points: 1, options: [{ id: 12, text: "True", isCorrect: false }, { id: 13, text: "False", isCorrect: true }] },
  { ...base, id: 3, type: "identification", prompt: "The father of computers.", points: 1, expectedAnswers: ["Charles Babbage", "Babbage"], alwaysStrict: true, caseSensitive: false },
  { ...base, id: 4, type: "enumeration", prompt: "Name two join types.", points: 2, expectedAnswers: ["inner", "left"], caseSensitive: true },
  { ...base, id: 5, type: "essay", prompt: "Explain normalisation.", points: 5 },
  {
    ...base, id: 6, type: "modified_true_false", prompt: "The CPU stores data permanently.", points: 2, underlined: "CPU",
    options: [{ id: 14, text: "True", isCorrect: false }, { id: 15, text: "False", isCorrect: true }], expectedAnswers: ["storage", "hard disk"],
  },
  { ...base, id: 7, type: "matching", prompt: "Match the command.", points: 2, pairs: [{ left: "SELECT", right: "read" }, { left: "DELETE", right: "remove" }] },
];

describe("toDraft and toInput", () => {
  it("send back every question type exactly as the server stored it", () => {
    expect(questions.map((question) => toInput(toDraft(question)))).toEqual([
      { type: "multiple_choice", prompt: "Which key identifies a row?", points: 2, timeLimitSeconds: 60, options: [{ text: "Primary key", isCorrect: true }, { text: "Foreign key", isCorrect: false }] },
      { type: "true_false", prompt: "SQL keywords are case-sensitive.", points: 1, correctAnswer: false },
      { type: "identification", prompt: "The father of computers.", points: 1, alwaysStrict: true, caseSensitive: false, expectedAnswers: ["Charles Babbage", "Babbage"] },
      { type: "enumeration", prompt: "Name two join types.", points: 2, alwaysStrict: false, caseSensitive: true, expectedAnswers: ["inner", "left"] },
      { type: "essay", prompt: "Explain normalisation.", points: 5 },
      { type: "modified_true_false", prompt: "The CPU stores data permanently.", points: 2, alwaysStrict: false, caseSensitive: false, underlined: "CPU", correctAnswer: false, expectedAnswers: ["storage", "hard disk"] },
      { type: "matching", prompt: "Match the command.", points: 2, pairs: [{ left: "SELECT", right: "read" }, { left: "DELETE", right: "remove" }] },
    ]);
  });

  it("reads a true statement as true, and a missing answer as not chosen", () => {
    const statement = { ...questions[1]!, options: [{ id: 1, text: "True", isCorrect: true }, { id: 2, text: "False", isCorrect: false }] };
    expect(toInput(toDraft(statement))).toMatchObject({ correctAnswer: true });
    const unanswered = toDraft({ ...questions[1]!, options: [] });
    expect(unanswered.correctAnswer).toBeNull();
    expect(toInput(unanswered)).not.toHaveProperty("correctAnswer");
  });

  it("sends a true modified statement without corrections", () => {
    const draft = { ...toDraft(questions[5]!), correctAnswer: true };
    expect(toInput(draft)).not.toHaveProperty("expectedAnswers");
  });

  it("trims text, drops blank answer lines, and saves blank points as 0", () => {
    const draft = { ...toDraft(questions[3]!), prompt: "  Name joins ", expectedAnswers: " inner \n\n outer \n", points: "" };
    expect(toInput(draft)).toMatchObject({ prompt: "Name joins", points: 0, expectedAnswers: ["inner", "outer"] });
  });

  it("keeps the server's problems for an incomplete question", () => {
    const draft = toDraft({ ...questions[0]!, incomplete: true, problems: ["Mark the correct choice."] });
    expect(draft.problems).toEqual(["Mark the correct choice."]);
  });
});

describe("sections", () => {
  const set: QuestionSet = {
    id: 9, title: "Midterm", subjectId: 3, locked: false, usedBy: [],
    sections: [
      { id: 21, title: "Test II. Essay", directions: null, defaultPoints: 5, sortOrder: 2 },
      { id: 20, title: "Test I. Multiple choice", directions: "Choose the best answer.", defaultPoints: 1, sortOrder: 1 },
    ],
    questions: [
      { ...questions[4]!, sectionId: 21, sortOrder: 2 },
      { ...questions[0]!, sectionId: 20, sortOrder: 1 },
    ],
  };

  it("loads sections in order with their questions, and saves them with section indexes", () => {
    const sections = toDraftSections(set);
    expect(sections.map((section) => [section.title, section.defaultPoints, section.questions.map((q) => q.prompt)])).toEqual([
      ["Test I. Multiple choice", "1", ["Which key identifies a row?"]],
      ["Test II. Essay", "5", ["Explain normalisation."]],
    ]);
    const body = toSaveBody(sections, true);
    expect(body.allowIncomplete).toBe(true);
    expect(body.sections).toEqual([
      { title: "Test I. Multiple choice", directions: "Choose the best answer.", defaultPoints: 1 },
      { title: "Test II. Essay", directions: "", defaultPoints: 5 },
    ]);
    expect(body.questions.map((question) => question.section)).toEqual([0, 1]);
  });

  it("reads a set saved before sections as one unnamed section", () => {
    const sections = toDraftSections({ questions: [questions[0]!, questions[1]!] });
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBe("");
    expect(sections[0]!.questions).toHaveLength(2);
  });

  it("gives a new question its section's default points", () => {
    const section: DraftSection = { ...blankSection(), defaultPoints: "2.5" };
    const { sections, key } = addQuestion([section], section.key, "identification");
    const added = sections[0]!.questions.find((draft) => draft.key === key)!;
    expect(added.points).toBe("2.5");
    expect(addQuestion([blankSection()], "nope", "essay").sections[0]!.questions).toHaveLength(0);
    const plain = blankSection();
    expect(addQuestion([plain], plain.key, "essay").sections[0]!.questions[0]!.points).toBe("1");
  });
});

describe("changeType", () => {
  it("keeps the prompt and points, and what was typed for the other type", () => {
    const draft = { ...blankQuestion("multiple_choice", "3"), prompt: "Pick one" };
    const filled = { ...draft, options: draft.options.map((option, i) => ({ ...option, text: `Choice ${i}` })) };
    const asMatching = changeType(filled, "matching");
    expect(asMatching).toMatchObject({ type: "matching", prompt: "Pick one", points: "3" });
    expect(asMatching.pairs).toHaveLength(2);
    expect(changeType(asMatching, "multiple_choice").options.map((option) => option.text)).toEqual(["Choice 0", "Choice 1", "Choice 2", "Choice 3"]);
  });
});

describe("pasting choices", () => {
  it("splits lines, drops blanks, and removes letters and bullets", () => {
    expect(splitChoiceLines("a. var\r\nB) const\n\n(c) let\n- final\n  readonly  ")).toEqual(["var", "const", "let", "final", "readonly"]);
    expect(splitChoiceLines("A plain sentence")).toEqual(["A plain sentence"]);
  });

  it("fills the choice it was pasted into, inserts the rest after it, and stops at 10", () => {
    const draft = blankQuestion("multiple_choice");
    const { options, dropped } = pasteChoices(draft.options, 1, ["b", "c", "d"]);
    expect(options.map((option) => option.text)).toEqual(["", "b", "c", "d", "", ""]);
    expect(dropped).toBe(0);
    const many = pasteChoices(draft.options, 0, Array.from({ length: 12 }, (_, i) => `line ${i + 1}`));
    expect(many.options).toHaveLength(10);
    expect(many.dropped).toBe(5);
    expect(many.options[6]!.text).toBe("line 7");
  });
});

describe("underlined phrase", () => {
  it("finds the first match ignoring capitals and keeps the statement's own spelling", () => {
    expect(splitUnderlined("The CPU stores data.", "cpu")).toEqual(["The ", "CPU", " stores data."]);
    expect(splitUnderlined("The CPU stores data.", "RAM")).toBeNull();
    expect(splitUnderlined("The CPU stores data.", "  ")).toBeNull();
  });
});

describe("incomplete questions", () => {
  const complete = (type: Parameters<typeof blankQuestion>[0], change: Partial<DraftQuestion>) => ({ ...blankQuestion(type), prompt: "Prompt", ...change });

  it("accepts a complete question of every type", () => {
    const mc = blankQuestion("multiple_choice");
    expect([
      complete("multiple_choice", { options: mc.options.map((option, i) => ({ ...option, text: `c${i}`, isCorrect: i === 0 })) }),
      complete("true_false", { correctAnswer: true }),
      complete("identification", { expectedAnswers: "Babbage" }),
      complete("enumeration", { expectedAnswers: "red\ngreen" }),
      complete("essay", {}),
      complete("modified_true_false", { prompt: "The CPU stores data.", underlined: "cpu", correctAnswer: false, expectedAnswers: "storage" }),
      complete("matching", { pairs: [{ key: "a", left: "A", right: "1" }, { key: "b", left: "B", right: "2" }] }),
    ].map(draftProblems)).toEqual([[], [], [], [], [], [], []]);
  });

  it("names what each type is missing", () => {
    expect(draftProblems(blankQuestion("multiple_choice"))).toEqual(["Enter the question.", "Fill in every choice, or remove the empty ones.", "Mark the correct choice."]);
    expect(draftProblems(complete("true_false", { points: "0" }))).toEqual(["Give it more than 0 and at most 1000 points.", "Say whether the statement is true or false."]);
    expect(draftProblems(complete("identification", { expectedAnswers: Array.from({ length: 11 }, (_, i) => `a${i}`).join("\n") }))).toEqual(["Give 1 to 10 accepted answers."]);
    expect(draftProblems(complete("modified_true_false", { underlined: "RAM", correctAnswer: false }))).toEqual(["The underlined phrase must appear in the statement.", "Give 1 to 10 accepted corrections."]);
    expect(draftProblems(complete("matching", {}))).toEqual(["Fill in both sides of every pair."]);
    expect(draftProblems({ ...blankQuestion("essay"), type: "" })).toEqual(["Choose the type."]);
  });

  it("counts questions needing attention and the server's problems until the question changes", () => {
    const fine = complete("essay", {});
    const flagged = { ...fine, problems: ["The server says no."] };
    expect(attentionFor(flagged)).toEqual(["The server says no."]);
    const section: DraftSection = { ...blankSection(), questions: [fine, flagged, blankQuestion("true_false", "2")] };
    expect(summarize([section])).toEqual({ count: 3, totalPoints: 4, types: ["essay", "true_false"], attention: [{ key: flagged.key, number: 2 }, { key: section.questions[2]!.key, number: 3 }] });
  });

  it("takes the server's problems by position after a save", () => {
    const a = blankQuestion("essay");
    const b = blankQuestion("essay");
    const saved = applySaved([{ ...blankSection(), questions: [a, b] }], {
      id: 1, title: "", subjectId: null, locked: false, usedBy: [],
      questions: [
        { ...questions[4]!, id: 1, sortOrder: 2, incomplete: true, problems: ["Enter the question."] },
        { ...questions[4]!, id: 2, sortOrder: 1, incomplete: false, problems: [] },
      ],
    });
    expect(saved[0]!.questions.map((draft) => draft.problems)).toEqual([[], ["Enter the question."]]);
  });

  it("matches the server's problems to the questions as sent, even after a move or an edit during the save", () => {
    const [a, b, c] = [blankQuestion("essay"), blankQuestion("essay"), blankQuestion("essay")];
    const sent = [{ ...blankSection(), questions: [a, b, c] }];
    const stored = (id: number, problems: string[]) => ({ ...questions[4]!, id, sortOrder: id, incomplete: problems.length > 0, problems });
    const set: QuestionSet = { id: 1, title: "", subjectId: null, locked: false, usedBy: [], questions: [stored(1, ["Enter the question."]), stored(2, []), stored(3, ["Give it more than 0 and at most 1000 points."])] };
    // While saving, b moved to the top, c was edited (which clears its problems), and d was added.
    const editedC = { ...c, prompt: "Changed", problems: [] };
    const d = blankQuestion("essay");
    const now = [{ ...sent[0]!, questions: [b, a, editedC, d] }];
    const result = applySaved(now, set, sent)[0]!.questions;
    expect(result.map((draft) => draft.key)).toEqual([b.key, a.key, c.key, d.key]);
    expect(result.map((draft) => draft.problems)).toEqual([[], ["Enter the question."], [], []]);
    expect(result[2]).toBe(editedC);
  });

  it("lists questions whose type was never chosen", () => {
    expect(untypedQuestions([{ ...blankSection(), questions: [blankQuestion("essay"), { ...blankQuestion("essay"), type: "" }] }])).toEqual([2]);
  });
});

describe("moving and duplicating", () => {
  const first = blankSection();
  const second = blankSection();
  const [a, b, c] = [blankQuestion("essay"), blankQuestion("essay"), blankQuestion("essay")];
  const sections = [{ ...first, questions: [a, b] }, { ...second, questions: [c] }];

  it("moves within a section and across into the next one", () => {
    expect(flatten(moveQuestion(sections, a.key, 1)).map((draft) => draft.key)).toEqual([b.key, a.key, c.key]);
    const across = moveQuestion(sections, b.key, 1);
    expect(across.map((section) => section.questions.map((draft) => draft.key))).toEqual([[a.key], [b.key, c.key]]);
    expect(moveQuestion(sections, a.key, -1)).toBe(sections);
    expect(canMove(sections, a.key, -1)).toBe(false);
    expect(canMove(sections, c.key, 1)).toBe(false);
    expect(canMove(sections, c.key, -1)).toBe(true);
  });

  it("puts a copy right after the original, with new keys and no server problems", () => {
    const { sections: next, key } = duplicateQuestion(sections, a.key);
    expect(flatten(next).map((draft) => draft.key)).toEqual([a.key, key, b.key, c.key]);
    expect(key).not.toBe(a.key);
  });
});

describe("imports", () => {
  it("loads drafts with their sections, original text, and warnings", () => {
    const sections = fromImport({
      sections: [{ title: "Test I. Multiple choice", directions: "Choose.", defaultPoints: 1 }, { title: "Test II", directions: "", defaultPoints: null }],
      questions: [
        { type: "multiple_choice", prompt: "Which?", points: 1, section: 0, options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: false }], number: 1, source: "1. Which?\na. a\nb. b", warnings: ["No answer found."] },
        { type: null, prompt: "Something", section: 1, number: 2, source: "2. Something", warnings: ["Choose the type."] },
        { type: "essay", prompt: "Out of range", section: 9, number: 3, source: "3.", warnings: [] },
      ],
    });
    expect(sections.map((section) => section.questions.map((draft) => draft.prompt))).toEqual([["Which?", "Out of range"], ["Something"]]);
    const [mc, untyped] = [sections[0]!.questions[0]!, sections[1]!.questions[0]!];
    expect(mc).toMatchObject({ source: "1. Which?\na. a\nb. b", number: 1, warnings: ["No answer found."] });
    expect(draftProblems(mc)).toContain("Mark the correct choice.");
    expect(untyped.type).toBe("");
  });

  it("replaces a lone empty section, and otherwise adds after", () => {
    const imported = [{ ...blankSection(), title: "Imported" }];
    expect(appendSections([blankSection()], imported)).toBe(imported);
    const kept = [{ ...blankSection(), questions: [blankQuestion("essay")] }];
    expect(appendSections(kept, imported)).toHaveLength(2);
  });
});

describe("server errors", () => {
  it("maps questions[i] and sections[i] to the cards they are about, numbered across sections", () => {
    const one = { ...blankSection(), questions: [blankQuestion("essay")] };
    const two = { ...blankSection(), questions: [blankQuestion("essay"), blankQuestion("true_false")] };
    const sections = [one, two];
    const mapped = mapFieldErrors({
      "questions[2].correctAnswer": ["Say whether the statement is true or false."],
      "questions[0].prompt": ["Enter the question."],
      "sections[1].title": ["Use at most 200 characters."],
      questions: ["Use at most 200 questions."],
      "questions[9].prompt": ["Out of range."],
      title: ["Not ours."],
    }, sections);
    expect(mapped.questions).toEqual({
      [two.questions[1]!.key]: [{ field: "correctAnswer", message: "Say whether the statement is true or false." }],
      [one.questions[0]!.key]: [{ field: "prompt", message: "Enter the question." }],
    });
    expect(mapped.sections).toEqual({ [two.key]: [{ field: "title", message: "Use at most 200 characters." }] });
    expect(mapped.general).toEqual(["Use at most 200 questions.", "Out of range."]);
    expect(firstErrorKey(mapped, sections)).toBe(one.questions[0]!.key);
  });
});
