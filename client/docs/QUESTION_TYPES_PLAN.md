# Assessment builder plan

Question types, many questions with sections, a new assessment builder screen, answer-review and
spelling settings, importing exams from files, accuracy tools, and data retention. Decisions:
D-040, D-041, D-042 in [`ui-memory/DECISIONS.md`](ui-memory/DECISIONS.md). The exact API shapes
are in [`ASSESSMENTS_API_CONTRACT.md`](ASSESSMENTS_API_CONTRACT.md).

## Goals

- An instructor builds a full exam with mixed question types quickly, by typing it or by
  uploading the Word file they already have.
- Scoring is right and fair, and a wrong answer key is easy to catch and fix.
- Student data is kept only as long as needed, and answer keys never reach students early.
- Nothing that works today breaks: existing sets, exams, attempts, and grades behave as before.

## Decisions (2026-11-17, the defaults the team accepted)

| # | Decision |
|---|---|
| 1 | "Multiple" is multiple choice with one correct answer. Select-all-that-apply comes later as its own type. |
| 2 | Modified true or false is all or nothing. |
| 3 | The default answer review is "Score and which questions were right" (today's behavior). |
| 5, 6 | Import A (Word or text format) and B (Excel or CSV template) come first. Pasting text uses the same parser as A. |
| 7 | The server adds `DocumentFormat.OpenXml` (Microsoft, MIT) to read and write `.docx` and `.xlsx`. |
| 8 | AI import (way C) is **not built** until the school approves sending exam content to Anthropic. |
| 9 | Attempts are anonymized 2 terms after their term ends (to be confirmed by the registrar or DPO; RA 10173). |
| 10 | The answer key can be fixed after attempts start, and every attempt is re-scored (D-042). |
| 11 | Shuffling question and choice order is an option on each exam, off by default. |
| 12 | Sets can be saved with incomplete questions, but an exam can't be published until its set is complete. |
| 13 | Spelling has three modes: Strict (default; existing exams stay Strict), Allow small typos, I'll check near misses. |

## The assessment builder (instructor)

An assessment gets its own page (`/instructor/classes/:classId/assessments/new` and
`…/:id/edit`) instead of a form squeezed into the Create content tab:

1. **Details:** title, module, category label (Quiz, Long quiz, Exam), instructions.
2. **Questions**, with three ways in, all using the same editor:
   - **Write questions:** sections with directions and default points; add a question by type;
     duplicate, move, remove; Enter adds a choice; pasting lines splits them into choices; a jump
     list of question numbers marks the ones that need attention.
   - **Import from a file:** Word, Excel, CSV, or pasted text. The drafts open in the same
     editor with the original text and warnings beside each question.
   - **Use a question set:** reuse one of the instructor's sets (D-034).
3. **Settings:**
   - due date and availability, attempts, time limit;
   - after submitting, students see: score only, or which questions were right, or the correct
     answers after the due date, or the correct answers right after submitting;
   - spelling in typed answers;
   - shuffle questions and choices.
4. **Summary and actions:** a summary panel on wide screens (a bar at the bottom on phones). It
   shows the question count, total points, types used, and what needs attention, with the
   actions **Preview as student**, **Save draft**, and **Publish**.

The Question sets page uses the same editor. The Create content tab keeps its three cards; its
**Create** button for Assessments opens the builder.

## Students

- Each question type gets the input it needs, and typed answers are saved automatically.
- Section directions appear above their questions, and the spelling rule is shown before and
  during the quiz.
- Results show Correct, Partly correct, Incorrect, or Waiting for grading, spelling notes, and the
  correct answers when the exam allows. A "Your score was updated" note appears after a regrade.

## Accuracy

- **Before publishing:** Preview as student.
- **Imports:** checks for numbering gaps and points mismatches, and the original text beside
  each draft.
- **After attempts:** item analysis (correct rate, top answers, a "check the key" flag), a
  spelling review list, and fixing the key with a regrade.
- **Tests:** the server's scoring tests cover each type and spelling mode.

## Data retention and security

- **Uploads:** never stored; read in memory and discarded.
- **Unsaved drafts:** live only in the open tab, never in browser storage.
- **Attempts:** anonymized after the retention period. Grades stay; answer and essay text is
  removed.
- **Audit rows:** metadata only.
- **Answer keys:** only the owning instructor gets them, plus students once the exam's setting
  allows.
- **Import limits:** macro-enabled files are refused; size, entry count, and parse time are
  capped.

## Delivery

The work runs as parallel streams on `feat/assessments`, each as its own PR into that branch.
`feat/assessments` merges into `main` once everything passes together.

| Stream | Scope |
|---|---|
| 0 | This plan, the API contract, D-040–D-042 |
| API | Types, sections, incomplete sets, settings, spelling, answer review, shuffle, key fix, regrade, item analysis, preview, retention job, demo seed |
| Import | The `/api/questionnaires/import` parser and templates (Word, Excel, CSV, text) |
| Builder | The assessment builder page, the shared question editor, the Question sets page, the import dialog |
| Grading | The grading view for each type, the spelling review list, item analysis, fix the key |
| Student | Quiz inputs for each type, autosave, directions, spelling notice, results |

Every PR runs lint, typecheck, unit tests, e2e (dev and `E2E_PREVIEW=1`), build, budget,
`style:check`, `memory:check`, and `dotnet test`. The UI rules C-019, D-005 (text ≥ 14px) and
44px controls apply, with no sideways scroll at 320px. Later, optional work: AI import (after
approval), generating questions from a material, exporting a set to Word or Excel, and
select-all-that-apply.
