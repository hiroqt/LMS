# Assessments API contract (D-040, D-041, D-042)

The agreed shapes between the LMS API (`server/`) and the client for the assessment builder
([`QUESTION_TYPES_PLAN.md`](QUESTION_TYPES_PLAN.md)). JSON is camelCase. Every change is
additive: an existing request still works, and existing rows keep their meaning.

## 1. Question types

`type` is one of:

| Type | Fields used in `QuestionInput` | Student answer (`AnswerInput`) |
|---|---|---|
| `multiple_choice` | `options` 2–10, exactly one `isCorrect` | `optionId` |
| `true_false` | `correctAnswer` | `optionId` (options "True", "False") |
| `identification` (new) | `expectedAnswers` 1–10: any one is correct | `text` (≤ 200 chars) |
| `enumeration` | `expectedAnswers` 1–20: each counts once, any order | `items` (≤ 20, each ≤ 200 chars) |
| `essay` | prompt only | `text` (≤ 10,000 chars) |
| `modified_true_false` (new) | `underlined` (must appear in `prompt`, ignoring case), `correctAnswer`; when `false`, `expectedAnswers` 1–10 accepted corrections | `optionId` (True/False) and, when False, `text` (≤ 200 chars) |
| `matching` | `pairs` 2–20 | `matches` |

Storage: `modified_true_false` keeps True/False as options (like `true_false`), its
corrections as expected answers, and the phrase in `Question.Underlined`. `identification`
keeps its accepted answers as expected answers. No HTML is stored anywhere; the client draws the
underline from `underlined`.

## 2. Question sets (instructor)

### `PUT /api/questionnaires/{id}/questions` (extended)

```jsonc
{
  "sections": [                                  // optional; omitted = one unnamed section
    { "title": "Test I. Multiple choice", "directions": "Choose the best answer.", "defaultPoints": 1 }
  ],
  "questions": [
    {
      "type": "modified_true_false",
      "prompt": "The CPU stores data permanently.",
      "points": 2,
      "timeLimitSeconds": 0,
      "section": 0,                              // index into sections; omitted = first section
      "underlined": "CPU",
      "correctAnswer": false,
      "expectedAnswers": ["storage", "hard disk"],
      "alwaysStrict": false,                     // spelling: ignore the exam's typo setting
      "caseSensitive": false                     // capitals matter ("Co" vs "CO")
    }
  ],
  "allowIncomplete": true                        // optional, default false
}
```

- Section `title` ≤ 200 chars (it may be empty for the unnamed section), `directions` ≤ 2,000, `defaultPoints` 0–1000 or null.
- With `allowIncomplete: false` (the default, the existing behavior), any invalid question is a
  422 with `questions[i].field` errors.
- With `allowIncomplete: true`, the request is still refused for structural problems: an unknown
  `type`, more than 200 questions, or a `section` index out of range. A question that fails only
  its content rules (blank prompt, no correct choice, missing answers, points out of range) is
  saved as given and marked `incomplete`. The server keeps those fields as sent, trimmed. Points
  are clamped to 0–1000, and a missing value saves as 0.
- A locked set (a student has started an exam that uses it) answers 409, as today.

### `QuestionnaireDto` (extended)

```jsonc
{
  "id": 7, "title": "Midterm", "subjectId": 3, "locked": false,
  "sections": [ { "id": 11, "title": "Test I. Multiple choice", "directions": "…", "defaultPoints": 1, "sortOrder": 1 } ],
  "questions": [
    {
      "id": 90, "type": "modified_true_false", "prompt": "…", "points": 2, "sortOrder": 1, "timeLimitSeconds": null,
      "sectionId": 11, "underlined": "CPU", "alwaysStrict": false, "caseSensitive": false,
      "incomplete": false, "problems": [],            // problems: plain sentences when incomplete
      "options": [ { "id": 1, "text": "True", "isCorrect": false }, { "id": 2, "text": "False", "isCorrect": true } ],
      "expectedAnswers": ["storage", "hard disk"], "pairs": []
    }
  ],
  "usedBy": []
}
```

`QuestionnaireSummary` gains `incompleteCount`. Every set has at least one section once it is
saved. Sets saved before this change get one unnamed section the first time they are loaded or
saved; the migration may also create it.

### `PUT /api/questionnaires/{id}/answer-key` (new: fix the key, D-042)

This works on a locked set too. It changes **only** answer keys: never prompts, choices'
text, pairs' left side, types, points, or order. Every question named must exist in the set.

```jsonc
{ "questions": [
  { "questionId": 90, "correctOptionId": 2 },              // multiple_choice
  { "questionId": 91, "correctAnswer": true },             // true_false, modified_true_false
  { "questionId": 92, "expectedAnswers": ["Manila"] },     // identification, enumeration, modified_true_false corrections
  { "questionId": 93, "pairs": [ { "left": "CPU", "right": "Processor" } ] } // matching: rights only, lefts must match
] }
```

It answers with `{ "questionnaire": QuestionnaireDto, "regraded": 12, "changed": 3 }`.
Every submitted attempt of every exam that uses the set is re-scored (§5), with one audit row.
Each attempt whose score changed gets `scoreUpdatedAt`.

### `POST /api/questionnaires/import` (new: D-041)

The body is either `multipart/form-data` with `file` (`.docx`, `.xlsx`, `.csv`, `.txt`;
≤ 5 MB) or JSON `{ "text": "…" }` (≤ 200,000 chars). Only instructors may call it. **Nothing is
saved and the file is not stored.** The audit row holds the file name, format, and question
count only.

```jsonc
{
  "format": "docx",                      // docx | xlsx | csv | text
  "title": "Midterm Examination",         // first heading or file name, may be null
  "sections": [ { "title": "Test I. Multiple choice", "directions": "…", "defaultPoints": 1 } ],
  "questions": [
    {
      // …the same fields as a QuestionInput above, plus:
      "number": 1,                        // the number in the document, or null
      "source": "1. Which keyword declares a constant?\na. var\nb. const\nAnswer: b",
      "warnings": ["No answer found."]    // per question; plain sentences
    }
  ],
  "warnings": [                           // whole document
    "Your document numbers questions 1–45, but 43 were found. Missing: 12, 30.",
    "Test I says 20 points, but its questions add up to 18."
  ]
}
```

Refusals: 422 `file` ("Upload a .docx, .xlsx, .csv, or .txt file of at most 5 MB.");
macro-enabled or invalid files are refused with 422 `file` ("This file could not be read.").

`GET /api/questionnaires/import/template?format=docx|xlsx|csv` returns a sample file with one
question of every type and the rules written in it.

**Word and text format:**

```
Midterm Examination                           ← optional title (first line, not numbered)

Test I. Multiple choice (1 point each)        ← section: the type from its words, points from "(N point(s) each)"
Directions: Choose the best answer.           ← section directions
1. Which keyword declares a constant in C#?   ← question: "N." or "N)"
a. var                                        ← choices: "a." "a)" "A." "(a)"
b. const
Answer: b                                     ← key: letter, or the choice text

Test II. True or false (1 point each)
2. HTML is a programming language.
Answer: False

Test III. Modified true or false (2 points each)
3. The [CPU] stores data permanently.         ← [brackets] or Word underline mark the phrase
Answer: False – storage / hard disk           ← "/" separates accepted answers

Test IV. Identification (1 point each)
4. The father of computers.
Answer: Charles Babbage / Babbage

Test V. Enumeration (3 points)
5. Give the three primary colors of light.
Answer: red; green; blue

Test VI. Matching (4 points)
6. Match the device to its use.
- Keyboard = input                            ← "- left = right"
- Monitor = output

Test VII. Essay (10 points)
7. Explain why backups matter.

Answer key                                    ← optional: keys at the end instead, "N. answer"
1. b
```

Section types are matched by name, ignoring case: "multiple choice", "true or false" / "true
false", "modified true or false", "identification", "enumeration", "matching", "essay".
Outside a typed section, a question's type is guessed: choices mean multiple choice, `=` lines
mean matching, an answer of True/False means true or false. Otherwise its warning says "Choose
the type." **Excel and CSV template columns:** `Section`, `Directions`, `Type`, `Question`,
`Points`, `Choice 1` … `Choice 10`, `Answer`, `Underlined`. `Answer` uses the same forms as the
text format.

## 3. Assessments (coursework)

`CourseworkInput` and `CourseworkDto` gain these fields. Students receive them too, because
they need the notices:

| Field | Values | Default |
|---|---|---|
| `answerReview` | `score_only` · `results` (which questions were right) · `answers_after_due` (correct answers after the due date, or once closed) · `answers_after_submit` | `results` |
| `spellingMode` | `strict` · `typos` (near misses get full points, flagged) · `review` (near misses wait for the instructor) | `strict` |
| `shuffleQuestions` | bool: shuffled within each section | `false` |
| `shuffleChoices` | bool: multiple choice only | `false` |

Publishing an exam whose set has an incomplete question is a 422 on `questionnaireId`: "Finish
the questions marked "needs attention" before publishing." A draft exam may use an incomplete
set. Changing `spellingMode` after students have submitted re-scores them (§5).

### `POST /api/classes/{classId}/coursework` with new questions

There is no new endpoint. The client creates the set (`POST /api/questionnaires`), saves its
questions (`PUT …/questions`), then creates the exam with `questionnaireId`, exactly as today.
`status: "draft"` saves without publishing.

## 4. Attempts (student)

`AttemptDto` (extended):

```jsonc
{
  "id": 5, "attemptNumber": 1, "status": "graded", "startedAt": "…", "submittedAt": "…", "deadline": null,
  "score": 18, "maxPoints": 20, "feedback": null,
  "answerReview": "results", "spellingMode": "typos", "scoreUpdatedAt": null,
  "sections": [ { "id": 11, "title": "Test I. Multiple choice", "directions": "…" } ],
  "questions": [
    { "id": 90, "type": "modified_true_false", "prompt": "…", "points": 2, "timeLimitSeconds": null,
      "sectionId": 11, "underlined": "CPU",
      "options": [ { "id": 1, "text": "True" }, { "id": 2, "text": "False" } ],
      "itemCount": null, "lefts": [], "rights": [],
      "key": null }                               // see "Correct answers" below
  ],
  "answers": [
    { "questionId": 90, "optionId": 2, "text": "storage", "items": [], "matches": {},
      "pointsAwarded": 2, "matchNote": "exact" }  // exact | typo | review | null
  ]
}
```

- **Order:** with `shuffleQuestions`, questions are shuffled within each section; with
  `shuffleChoices`, multiple-choice options are shuffled. The order is stable for each attempt
  (seeded by the attempt id), so a reload shows the same order.
- **What a student sees after submitting** depends on `answerReview`:
  - `score_only`: `score` only. Every `pointsAwarded` and `matchNote` is null.
  - `results`: `pointsAwarded` and `matchNote`.
  - `answers_after_due` / `answers_after_submit`: also `key` on each question, once the
    condition is met:
    `{ "optionIds": [2], "answers": ["storage", "hard disk"], "pairs": [ { "leftId": 4, "right": "Processor" } ], "correctAnswer": false }`
    (only the fields the type uses).
- **The server sends nothing of the key before then.** Before submitting, `key`,
  `pointsAwarded`, and `matchNote` are always null.
- **Waiting for grading:** `pointsAwarded` is null for essays until graded, and for `review`
  near misses until decided. An attempt with either stays `submitted`, the same as an essay
  today.

## 5. Scoring and spelling (server)

- **Normalize:**
  1. Unicode NFC.
  2. Trim, and collapse runs of spaces to one.
  3. Drop trailing `. , ; : ! ?`.
  4. Lowercase, unless `caseSensitive`.
- **Exact match:** the normalized answer equals a normalized accepted answer.
- **Near miss:**
  - Applies only when `spellingMode` is not `strict` and the question is not `alwaysStrict`.
  - Never for answers of 3 characters or fewer, or answers containing a digit.
  - The Damerau-Levenshtein distance to an accepted answer is ≤ 1 (length 4–7) or ≤ 2
    (length ≥ 8).
  - An answer that differs only in accents (for example `Pina` and `Piña`) counts as a near
    miss.
- **`typos` mode:** a near miss counts as correct, and `matchNote` is `typo`.
- **`review` mode:** a near miss sets `matchNote` to `review` and `pointsAwarded` to null until
  the instructor decides.
- **Enumeration:** each item is matched separately, and each accepted item counts once. The
  answer's `matchNote` is the "worst" of its items, in the order `review` > `typo` > `exact`.
- **Modified true or false:** full points for True on a true statement, or for False on a
  false statement plus a matching correction. Otherwise 0.
- **Identification:** full points if the answer matches any accepted answer.
- **Rounding:** points are rounded to 2 decimals, as today.
- **Spelling decisions:** a stored `SpellingDecision` (`accepted`/`rejected`) on an answer turns
  its near misses into right or wrong when it is re-scored.

## 6. Grading and accuracy (instructor)

All endpoints in this section are for the class's instructor only.

- `GET /api/classes/{classId}/coursework/{id}/spelling-review` returns
  `[{ submissionId, studentId, studentName, questionId, number, prompt, given, accepted: string[], matchNote, decision, pointsAwarded, points }]`.
  It lists every `typo` and `review` answer.
- `PUT /api/classes/{classId}/coursework/{id}/spelling-review/{submissionId}/{questionId}` with
  body `{ "decision": "accepted" | "rejected" }`:
  - It re-scores that answer.
  - An attempt with nothing left waiting becomes `graded`.
  - It writes an audit row.
  - It answers with the updated row.
- `GET /api/classes/{classId}/coursework/{id}/item-analysis` returns
  `[{ questionId, number, type, prompt, points, answered, correctRate, averagePoints, topAnswers: [{ answer, count, isKey }], flag }]`.
  - `correctRate` is 0–1, over submitted attempts.
  - `topAnswers` lists at most 3 for choice types (their text) and for typed answers (the
    normalized text).
  - `flag` is `"check_key"` when at least 3 attempts answered, and a single wrong answer was
    chosen by at least 50% of them. Otherwise it is null.
- `GET /api/classes/{classId}/coursework/{id}/preview` returns an `AttemptDto` built from the
  questions, with nothing saved and keys left out.
- `POST /api/classes/{classId}/coursework/{id}/preview/score` takes `{ answers: AnswerInput[] }`
  and returns `{ score, maxPoints, answers: [{ questionId, pointsAwarded, matchNote }], keys: [{ questionId, key }] }`.
  Nothing is saved.
- The instructor's `SubmissionDetail` answers gain `matchNote` and `decision`. Its questions
  carry the new fields from §2.

## 7. Retention (D-042)

- `Lms:Retention:AttemptTerms` (default 2): attempts of terms that ended more than that many
  terms ago are anonymized.
  - Answer text, items, and matches are cleared, and `Submission.Text` too.
  - Scores, points, and grades stay.
- This runs as a daily background job in the API; Demo mode leaves it off. Admin's browser-local
  Settings shows the value read-only until Admin moves to the API.

## 8. Settled during the build (2026-11-17)

Where the build differs from or adds to the sections above, this section wins. Full lists are in
PRs #47–#51.

- **Status codes:** validation refusals keep the API's existing `400` response with `errors`
  (fields as named above). Only import refusals are `422`.
- **Incomplete sets:** `allowIncomplete` still refuses anything that breaks the storage limits:
  - lengths over the limit (prompt 4,000; choice, answer, or underlined phrase 1,000);
  - counts over the maximum (10 choices, 10 or 20 answers, 20 pairs, 50 sections);
  - `timeLimitSeconds` outside 0–3600.
- **Matching pairs** in the instructor `QuestionDto` and `SubmissionDetail` are
  `{ leftId, left, right }`. A copied set gets new left ids.
- **`SubmissionDetail` answers** carry `text` (identification, modified true or false, essay),
  `items`, `matches`, `matchNote`, and `decision`.
- **Answer-key entries:** a modified true or false entry may send `correctAnswer` and
  `expectedAnswers` together.
- **Point overrides:** `answerPoints` on a waiting `review` answer settles it (decision
  `accepted` when the points are above 0, otherwise `rejected`).
- **Re-scoring:** recomputes auto-scored answers from the key. It keeps manual `answerPoints`
  overrides (stored per answer), essay points, and spelling decisions, and skips anonymized
  attempts.
- **Keys are released only when the student can't start another attempt:** attempts are used up,
  the exam is closed, or the due date has passed without late work. This applies on top of
  `answerReview`.
- **Saving questions to a set that a published exam uses** refuses incomplete questions, the same
  as publishing does. Starting an attempt on an incomplete set is refused too.
- **Near misses:**
  - Skipped when either side is 3 characters or fewer or contains a digit.
  - The threshold uses the accepted answer's accent-stripped length.
  - Matching is always exact.
  - A rejected near miss keeps its `matchNote` and scores 0.
- **`answers_after_due` with no due date** shows keys once the exam is closed.
- **Overview fields:** `/api/me/overview` coursework items carry `answerReview` and
  `spellingMode`, plus the shuffle flags.
- **Preview attempt:** carries the exam `title` and has `id: 0`.
- **Clearing dates:** `CourseworkInput` gains `clearDueAt` and `clearAvailableFrom`. A null date
  still means "unchanged".
- **CORS** exposes `Content-Disposition`.
- **Retention:**
  - Orders terms by ISMS `(schoolYearId, semesterId)`.
  - Touches only classes ISMS no longer offers.
  - Can be turned off with `Lms:Retention:Enabled`.
- **Import format rules:**
  - Headings start with Test, Part, or Section, or a roman numeral naming a type, or are just a
    type name.
  - "(N points)" is a section total; "(N points each)" is per question.
  - In Excel and CSV, matching pairs go in the Choice cells as `left = right`; rows starting
    with `#` are notes.
  - A non-UTF-8 CSV or text file is read as Windows-1252, with a warning.
  - Only the first Excel sheet is read.
