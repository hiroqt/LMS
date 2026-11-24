# Assignments API contract

The shapes for [`ASSIGNMENTS_PLAN.md`](ASSIGNMENTS_PLAN.md). §1–§4 are Phase 1; §5–§9 are Phase 2
(D-058); §10 is the outline for Phase 3, settled in detail when it starts. Routes are under
`/api/classes/{classId}/coursework`. Validation errors are the usual 400 field errors; refusals
are 409 with a plain `title`.

## §1 Coursework: new assignment fields

| Field | Type | Default | Rules |
|---|---|---|---|
| `closeAt` | ISO date-time or null | null | "Accept until": the last moment late work is accepted. Needs `allowLate: true` and a `dueAt`, and must be after `dueAt`. `clearCloseAt: true` removes it. Assignments only. |
| `gradeRelease` | `"immediate"` or `"returned"` | `"immediate"` | When students see a grade: once it is saved, or once the instructor returns it (§3). Assignments only. |

Sending either for an exam is a 400 on that field. Turning `allowLate` off or clearing `dueAt`
while `closeAt` is set is a 400 on `closeAt`. Both fields come back on every `CourseworkDto`.

## §2 `turnIn`: the server's verdict for one student

Students receive `turnIn` on each assignment (`GET …/coursework`, `GET …/coursework/{id}`,
`GET /api/me/overview`); instructors and exams get `null`.

```json
"turnIn": { "state": "turned_in", "canTurnIn": false, "reason": "already_turned_in", "late": false }
```

- `state`: `assigned`, `missing` (nothing handed in and the due date has passed), `draft`,
  `turned_in`, `graded`, `returned`, `not_handed_in`. With `gradeRelease: "returned"`, a graded
  submission that is not returned yet is `turned_in`.
- `canTurnIn`: whether `POST …/submissions` would be accepted now.
- `reason` (null when `canTurnIn`), the first that applies: `closed`, `not_handed_in`,
  `already_turned_in` (handed in and resubmission is off), `past_close` (after `closeAt`),
  `past_due` (after `dueAt` and late work is off).
- `late`: handing in now would be late.

`POST …/submissions` uses the same rules (`AssignmentRules.Evaluate`) and refuses with the
reason's sentence. The student page shows the turn-in form when `canTurnIn`, or disabled when the
reason is `past_due` or `past_close`, and hides it otherwise.

## §3 Grade release

With `gradeRelease: "returned"`, a student's submission (in `my-submissions`, the overview, and
the turn-in response) shows `status: "submitted"` and null `score`, `feedback` and `gradedAt`
until it is returned. "Not handed in" grades (D-036) are held the same way.

`POST …/coursework/{id}/return` with `{ "studentIds": ["STU-1"] }`, or `{}` for every student
whose latest handed-in work is graded, sets those submissions to `returned` and answers
`{ "returned": 3 }`. Work that isn't graded is skipped. Assignments only (409 for an exam);
instructors of the class only. One metadata-only audit row per call. Grading a returned
submission again keeps it returned, so a correction reaches the student at once. Switching
`gradeRelease` back to `immediate` shows every saved grade.

## §4 Drafts and the last day

- An assignment submission with `status: "in_progress"` is the student's draft. Instructors never
  receive drafts (submission list, overview); grading progress, the close rule (D-036) and
  "latest submission" use handed-in work only.
- `POST …/submissions` turns the student's draft in when there is one, instead of adding a row.
- A "not handed in" grade waits until `closeAt` when it is set, otherwise until `dueAt` (as before).

## §5 Coursework: how students hand in (Phase 2)

| Field | Type | Default | Rules |
|---|---|---|---|
| `submissionKinds` | array of `"text"`, `"file"`, `"link"` | `["text","file"]` | What a student may hand in. At least one. |
| `allowedFileTypes` | array of `"pdf"`, `"word"`, `"powerpoint"`, `"excel"`, `"image"`, `"text"` | all six | Which file types are accepted. At least one. Sending all six stores "all". |
| `maxFiles` | 1 to 5 | 5 | Files per turn-in. |
| `honorStatement` | boolean | `false` | The student must confirm "This is my own work" to turn in. |

Assignments only: sending any of them for an exam is a 400 on that field. All four come back on
every `CourseworkDto` (exams get the defaults). They can change after students have handed in;
work already handed in is not checked again.

File types (the server decides the type from the file's bytes, and the name must agree):

| Type | Extensions | Stored content type |
|---|---|---|
| `pdf` | `.pdf` | `application/pdf` |
| `word` | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `powerpoint` | `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `excel` | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `image` | `.jpg`, `.jpeg`, `.png` | `image/jpeg`, `image/png` |
| `text` | `.txt` | `text/plain; charset=utf-8` |

Each file is at most 25 MB (26,214,400 bytes). The old Office formats (`.doc`, `.xls`, `.ppt`),
macro-enabled files, a document that attaches its template from the web or a network share, ZIP
and HEIC are refused (D-058). Invisible format characters are dropped from file names.

## §6 Submissions carry a link and files (Phase 2)

`SubmissionDto` gains:

- `link`: string or null.
- `files`: array of `FileDto`, never null.
- `status` can also be `"withdrawn"`: a turned-in version the student took back (§7). Only the
  student receives withdrawn rows (`my-submissions`, the overview); instructors never do, and
  grading progress, the close rule, "not handed in" grades and Return ignore them.

```json
{ "id": 12, "name": "er-diagram.pdf", "contentType": "application/pdf", "size": 183422,
  "code": "9F2C-41AB", "sameAsAnotherStudent": false }
```

- `code`: the first 8 characters of the file's SHA-256, for the receipt.
- `sameAsAnotherStudent`: instructors only (null for students): another student handed in a file
  with the same SHA-256 for this assignment.

`fileName` (a typed file name, no file) is still returned for work handed in before Phase 2.
`POST …/submissions` still works with `text` (it turns in the student's draft when there is one,
after the same checks as `…/draft/turn-in`). Sending `fileName` is a 400: the file itself is
added to the draft.

`turnIn` (§2) gains `canUnsubmit`: whether `POST …/unsubmit` would be accepted now.

## §7 Drafts, turning in, unsubmitting (Phase 2)

All under `/api/classes/{classId}/coursework/{id}`, students on the class list only, assignments
only (404 for an exam). The student reads their draft from `my-submissions` (the row with
`status: "in_progress"`); nothing is created by reading.

| Route | Does | Answers |
|---|---|---|
| `POST …/draft` | Returns the draft, creating it when there is none. A new draft after turned-in work starts as a copy of that work (text, link, files). | 200 or 201, `SubmissionDto` |
| `PUT …/draft` | `{ "text": "…", "link": "https://…" }` replaces both (send null to clear). Creates the draft when there is none (with the files of the latest version, as above). Autosave. | 200, `SubmissionDto` |
| `POST …/draft/files` | One file, `multipart/form-data`, field `file`. Creates the draft when there is none. | 201, `SubmissionDto` |
| `DELETE …/draft/files/{fileId}` | Takes the file off the draft. | 200, `SubmissionDto` |
| `POST …/draft/turn-in` | `{ "honorStatement": true }` (needed only when the assignment asks for it). | 200, `TurnInReceipt` |
| `POST …/unsubmit` | Takes back the latest turned-in work and leaves a draft with the same content. | 200, `SubmissionDto` (the draft) |

- **A draft changes only while it could be turned in.** Creating, saving, and uploading are
  refused (409, the sentence for `turnIn.reason`) when `turnIn.canTurnIn` is false. Removing a
  file is always allowed.
- **Checks on save:** `text` at most 20,000 characters; `link` at most 2,000, an absolute
  `http://` or `https://` URL. `text` or `link` for a kind the assignment doesn't take is a 400 on
  that field.
- **Checks on upload**, in this order: the assignment takes files (409); the draft has room (409,
  "This assignment takes at most N files."); there is a `file` part, not empty and at most 25 MB
  (422 on `file`); the type is recognized from the bytes, matches the name, and is allowed for
  this assignment (422 on `file`); the same bytes are not on the draft already (422 on `file`);
  the virus scan passes (422 on `file`; 503 when the scanner can't be reached). At most 20 uploads
  per minute per student (429, `Retry-After: 60`). **A refused upload leaves nothing behind:** no
  draft is started, no row, no bytes (L-078). The answer to every 422 is one sentence for the
  student in `errors.file[0]`.
- **Work turned in a moment ago stays as it was.** A save, an upload, or a file removal that
  arrives after the draft was turned in (an upload can be scanning for a while) is a 409 ("This
  work was turned in a moment ago…"; a removal is a 404) and changes nothing. Any two changes of
  the same work that cross (a grade and "take back", two turn-ins) end the same way: the later one
  is a 409 and does nothing (L-090).
- **Turn-in** needs the usual verdict (409 with the reason's sentence), at least one thing the
  assignment takes (400 on `work`), nothing it doesn't take (400 on `work`, e.g. after the
  instructor changed the settings), and `honorStatement: true` when asked (400 on
  `honorStatement`). **A repeat is safe:** with no draft, it answers the receipt of the latest
  turned-in work.

```json
{ "submission": { "…": "SubmissionDto" },
  "receipt": { "submissionId": 41, "attemptNumber": 2, "submittedAt": "2026-11-20T07:41:10Z", "late": false,
               "files": [{ "id": 12, "name": "er-diagram.pdf", "size": 183422, "code": "9F2C-41AB" }] } }
```

- **Unsubmit** is accepted when `turnIn.canUnsubmit`: the assignment is published, resubmission is
  on, the due date has not passed (or there is none), and the latest turned-in work has no grade
  and is not a "not handed in" record. Otherwise 409, "This work can no longer be taken back."
  The taken-back version becomes `withdrawn` and is kept; if a draft already exists it is kept as
  it is.

## §8 Files (Phase 2)

`GET /api/files/{fileId}` streams the file with `X-Content-Type-Options: nosniff`,
`Content-Disposition: attachment`, `Content-Security-Policy: sandbox` and
`Cache-Control: private, no-store`. Allowed for the student who owns it, and for the instructor
of its class once it is part of handed-in work (not a draft, not withdrawn). Everyone else, and
a removed file, get 404. Fetch it with the workspace headers and show it from a blob (L-075).

A file's bytes are deleted when no draft or version uses it any more, and by retention (D-042),
which keeps the grades.

## §9 Configuration (Phase 2)

| Setting | Default | Notes |
|---|---|---|
| `Lms:Files:Root` | `App_Data/files` in Development; the sandbox folder in Demo; otherwise required | Where file bytes are kept. The API refuses to start without it. |
| `Lms:Files:Scanner` | `none` in Development and Demo; otherwise required | `clamav` or `none`. `none` is refused outside Development and Demo. `none` is not a scanner: it refuses only a file that starts with the text `LMS-VIRUS-SCAN-TEST-FILE`, so the refusal can be tried out and tested (L-079). |
| `Lms:Files:ClamAv:Host` / `Port` / `TimeoutSeconds` | `127.0.0.1` / `3310` / `60` | clamd, over TCP (`INSTREAM`). Its `StreamMaxLength` must be at least 26M. |
| `Lms:Files:UploadsPerMinute` | 20 | Per student. |

## §10 Phase 3 outline

- **Late penalties:** `latePenaltyPercentPerDay`, `latePenaltyMaxPercent`: a percent of the earned
  score per calendar day late (Asia/Manila), up to the cap; the grade keeps the raw points and the
  penalty applied, and can be waived per student.
- **Extensions and excused work:** `PUT …/students/{id}/extension`, `POST …/students/{id}/excuse`;
  `turnIn.state` gains `excused`, which leaves the average and the close rule.
- **Rubrics** per class, locked once used; a comment bank per instructor; batch Return;
  `GET …/submissions.zip` (streamed, size-capped).
