# Assignments plan

Easier setup for instructors, a smoother and safer way for students to hand in work, and settings
that can grow without every new option becoming another checkbox. Decisions: D-054 and D-055 in
[`ui-memory/DECISIONS.md`](ui-memory/DECISIONS.md). The API shapes are in
[`ASSIGNMENTS_API_CONTRACT.md`](ASSIGNMENTS_API_CONTRACT.md).

## Where assignments are today (2026-11-18)

| Area | Today |
|---|---|
| Setup | An inline form in Create content: module, title, instructions, due date, points, "Accept late work", "Allow resubmission". No draft, preview, or presets. |
| Files | The student types a file name; the server stores the name only. Nothing is uploaded. |
| Rules | Checked on the server, and again in the student page (`AssessmentPage.tsx`), so the two can drift. |
| Grading | Points and feedback. Students see a grade as soon as it is saved. |
| Identity | A demo identity in request headers. Production needs sign-in (ISMS plan). |

## Fit with the system (reviewed 2026-11-18)

The first draft of this plan was checked against the code and changed where it did not fit:

- **Settings are columns,** like the assessment settings (D-040). The database provider is
  `MySql.EntityFrameworkCore` and tests run on SQLite; JSON-mapped settings are not reliable on
  either (L-074). Maintainability comes from one place in code that reads and checks them.
- **There is no outbox yet** (planned with sign-in). Drafts are saved on the server, like quiz
  autosave (D-043).
- **The identity is in request headers,** so `<img src>` or `<iframe src>` can't be authorized.
  Files are fetched with the usual headers and shown from a blob (L-075). No signed URLs.
- **Students already receive their own in-progress rows.** The client learns about assignment
  drafts before any exist (Phase 1).
- **Hosting is not decided,** so files go to disk behind `IFileStore`. Cloud storage comes later.
- **Simpler where it is enough:** one streamed upload per file with retry (no chunking), a
  streamed zip (no job queue), presets in the client (no defaults table), and turn-in made safe to
  retry by the draft itself (no idempotency key).
- **Reused:** `SubmissionStatus.Returned` (already defined, unused), `ToDtoAsync` (the one place
  students receive grades), `ClassAccess`, the builder's `DetailsSection`/`SettingsSection`/
  `SummaryPanel`, the leave-page guard, and `AttemptRetention`.

## Phases

| Phase | Scope | Visible change |
|---|---|---|
| 0 | This plan, the API contract, D-054, D-055, FLOW_PARITY rows | None |
| 1 | `closeAt` and `gradeRelease` columns; `AssignmentRules` decides turn-in and the student page shows its verdict; grades held until returned (`POST …/return`); drafts private and ignored by grading progress; "not handed in" grades wait for the last day | None: the instructor UI sets neither new field yet, and every e2e spec passes unchanged |
| 2 | Four PRs (D-058). **2A, the API:** files (`IFileStore`, `IFileScanner`, checks, downloads), drafts, the receipt, unsubmit, and the hand-in settings. **2B:** the assignment builder. **2C:** the student "Your work" card with drafts, uploads, turn in, receipt, unsubmit. **2D:** the assignment grading page with Return | Yes; two specs move from typing a file name to `setInputFiles` (journey change, new D-entry) |
| 3 | Late penalties, extensions and excuse, rubrics (per class), comment bank, batch return, zip download | Yes |
| Later | Cloud storage, originality checks (needs school approval), group work, peer review, notifications, real files for class materials | — |

New settings are added in the phase that uses them, so no setting is accepted and then ignored.

## Instructor

- **Builder** (`/instructor/classes/:classId/assignments/new` and `…/:id/edit`): three tabs like
  the assessment builder (D-056, D-058): **Details**, **Hand-in** (what students hand in, file
  types, how many files, the "my own work" statement), and **Dates and grading** (due date, late
  work and its last day, resubmission, when grades show), with a presets row (Homework, In-class
  activity, Project, Copy a previous assignment). A summary panel (a bar on phones) shows the
  rules as students will read them, with Preview as student, Save draft, and Publish.
- **Grading page** (`…/assignments/:id/grading`), like the exam grading page (D-043): a filtered
  list (Needs grading, Late, Missing, Graded, Returned), a file viewer, points and feedback,
  Save and next, Return.

## Students

- The assignment page lists what to hand in and the rules in plain words.
- **Your work:** choose files or take a photo, progress per file with retry, text that saves by
  itself. Turn in asks for confirmation and gives a receipt (time, files, a short code from each
  file's SHA-256). Unsubmit before the due date when resubmission is on; every turn-in is kept.
- States: Assigned, Draft, Turned in, Late, Missing, Returned, Not handed in.

## Security and privacy

- The server decides every rule: availability, due date, last day, resubmission, grade release.
- Files (Phase 2): an allowlist checked against the file's content, size and count limits, clean
  names, macro files refused, random storage keys, a malware scan before anyone opens a file, a
  rate limit on uploads, and downloads only through the API (`nosniff`, attachment, sandbox CSP).
  Another student's file is a 404.
- Audit rows are metadata only. Retention (D-042) deletes files and keeps grades.
- An identical file handed in by two students is flagged by its SHA-256. Originality checking
  that sends work to a third party waits for the school's approval.

## Decisions (defaults accepted 2026-11-18)

| # | Decision |
|---|---|
| 1 | Up to 5 files, 25 MB each, per turn-in |
| 2 | PDF, Word, PowerPoint, Excel (`.docx`, `.pptx`, `.xlsx` only; D-058), JPEG, PNG, TXT; no ZIP; no HEIC (the picker asks for JPEG/PNG, so iPhones convert) |
| 3 | Disk storage behind `IFileStore`; one folder per sandbox in Demo |
| 4 | ClamAV behind `IFileScanner`; outside Development and Demo the API refuses to start without a scanner |
| 5 | New assignments don't accept late work (today's default) |
| 6 | Grades show right away (today's behavior); "When I return them" is an option |
| 7 | Unsubmit before the due date when resubmission is on; every version kept |
| 8 | Text answers are plain text; links are shown as links |
| 9 | Rubrics belong to a class (Phase 3); reuse across classes later |
| 10 | Files follow the 2-term retention; grades stay |
| 11 | No originality service until the school approves |
| 12 | Production needs real sign-in first |

## Checks for every PR

lint, typecheck, unit tests, e2e (dev and `E2E_PREVIEW=1`), build, budget, `style:check`,
`memory:check`, `dotnet test`. C-019, D-005 (text ≥ 14px), 44px controls, no sideways scroll at
320px, zero axe violations.
