# Assignments API contract

The shapes for [`ASSIGNMENTS_PLAN.md`](ASSIGNMENTS_PLAN.md). §1–§4 are Phase 1 and are built;
§5 is the outline for Phase 2 and 3, settled in detail when those phases start. Routes are under
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

## §5 Phase 2 and 3 outline

- **Draft:** `POST …/{id}/draft` (create or return), `PUT …/{id}/draft` (`text`, `link`;
  autosave), `POST …/{id}/draft/turn-in` (receipt; a repeat returns the same receipt),
  `POST …/{id}/unsubmit`.
- **Files:** `POST …/{id}/draft/files` (one multipart file, streamed), `DELETE …/draft/files/{fileId}`,
  `GET /api/files/{fileId}` (owner student or the class's instructors; 404 otherwise; `nosniff`,
  `Content-Disposition: attachment`, `Content-Security-Policy: sandbox`).
  `StoredFile`: id, owner, storage key, clean name, content type checked against the bytes, size,
  `sha256`, `scanStatus` (`pending`, `clean`, `infected`), deleted-at.
- **New assignment fields** (added with the UI that sets them): `submissionKinds`
  (`text`, `file`, `link`), `allowedFileTypes`, `maxFiles`, `honorStatement`; Phase 3:
  `latePenaltyPercentPerDay`, `latePenaltyMaxPercent`.
- **Instructor:** `GET …/submissions?status=&page=`, `PUT …/students/{id}/extension`,
  `POST …/students/{id}/excuse`, `GET …/submissions.zip` (streamed, size-capped), rubrics.
- **Config:** `Lms:Files:Root`, `Lms:Files:Scanner` (`clamav` or `none`; `none` is refused
  outside Development and Demo), `Lms:Files:ClamAv:Host`/`Port`.
