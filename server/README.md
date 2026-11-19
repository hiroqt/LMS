# LMS API

ASP.NET Core (.NET 10) backend for the LMS. It pulls subjects, instructors, class schedules and
class rosters from the school's ISMS and gives them to the React client, and it has its own MySQL
database, `lmsdb`, for everything the LMS owns (Phase 2, in progress).

The LMS does not create subjects or classes. ISMS owns them. The LMS reaches ISMS **only through
the ISMS API over HTTP**, using a client id and API key. It never connects to the ISMS database.

```
React client ──/api/*──▶ LMS API (this) ──X-Client-Id / X-Api-Key──▶ ISMS API ──▶ ISMS
                         │  in-memory cache (TTL, stale-serve)
                         └─▶ lmsdb (MySQL): ISMS reference copy + LMS-owned tables
```

## Layout

| Path | What |
|---|---|
| `Lms.slnx` | Solution: the web project and its tests |
| `src/Lms.Api/` | The web project (minimal APIs) |
| `src/Lms.Api/Isms/` | `IIsmsClient` (typed `HttpClient`: paging, timeout, retry), `IIsmsCatalog` + in-memory cache, options |
| `src/Lms.Api/Classes/` | Mapping ISMS schedules to LMS classes, `ClassId` |
| `src/Lms.Api/Endpoints/` | HTTP endpoints, ISMS error → problem-details mapping |
| `src/Lms.Api/Data/` | `LmsDbContext`, the entities, and EF migrations (`Data/Migrations`) |
| `src/Lms.Api/Sync/` | `IsmsReferenceSync` (ISMS classes and class lists into `lmsdb`) and its background worker |
| `tests/Lms.Api.Tests/` | xUnit + `WebApplicationFactory`, with ISMS replaced by a stub `HttpMessageHandler` |

## Configure ISMS credentials

The API key must **never** go in a committed file. Use user-secrets locally, environment variables elsewhere:

```bash
cd server/src/Lms.Api
dotnet user-secrets set Isms:ClientId "<client id issued by ISMS>"
dotnet user-secrets set Isms:ApiKey   "<api key issued by ISMS>"
```

Environment-variable form: `Isms__ClientId`, `Isms__ApiKey`, `Isms__BaseUrl`.

If `Isms:BaseUrl`, `Isms:ClientId` or `Isms:ApiKey` is missing, the app refuses to start and says which one.

| Setting | Default | Notes |
|---|---|---|
| `Isms:BaseUrl` | `http://localhost:5100` in Development, otherwise empty (required) | |
| `Isms:ClientId` / `Isms:ApiKey` | none (required) | user-secrets or environment variables only |
| `Isms:TimeoutSeconds` | 10 | per attempt |
| `Isms:MaxRetries` | 2 | network errors, timeouts, 408/502/503/504. Never 401/403/429 |
| `Isms:PageSize` | 200 | ISMS max is 200. Every page is followed |
| `Isms:CacheTtlSeconds` | 300 | how long a cached ISMS read counts as fresh |
| `Isms:MaxStaleSeconds` | 86400 | how long past the TTL a cached copy may still be served while ISMS is down. 0 turns this off |
| `Cors:AllowedOrigins` | `[]`; `["http://localhost:5173"]` in Development | there is no allow-any-origin option |

## Database (lmsdb)

`lmsdb` runs on the development MySQL in Docker (port 3307), next to the stand-in ISMS database.
Its user, `lms_api_rw`, has rights on `lmsdb` only, so the LMS still cannot read ISMS tables.
See `../isms-api/db/README.md` to create it.

```bash
cd server/src/Lms.Api
dotnet user-secrets set ConnectionStrings:LmsDb "Server=127.0.0.1;Port=3307;Database=lmsdb;User=lms_api_rw;Password=dev_only_lms_change_me;"
cd ../..
dotnet tool restore
dotnet ef database update --project src/Lms.Api          # apply migrations
dotnet ef migrations add <Name> --project src/Lms.Api --output-dir Data/Migrations   # after a model change
```

The initial migration sets `utf8mb4_bin` before creating tables so base64url class IDs and their foreign keys compare case-sensitively. This migration is intended for a fresh LMS schema; do not reapply or edit migration history on an existing database.

The API refuses to start without `ConnectionStrings:LmsDb`. A test fails when the model changes
without a migration.

| Group | Tables |
|---|---|
| ISMS reference (written only by the sync) | `isms_classes`, `isms_class_students` |
| LMS-owned | `modules` (optional parent for submodules), `materials`, `announcements`, `questionnaires`, `questions`, `question_options`, `question_expected_answers`, `coursework`, `submissions`, `submission_answers`, `stored_files`, `submission_files`, `grades`, `gradebook_settings`, `attendance_months`, `attendance_entries`, `audit_log` |

Every LMS-owned row records `created_at`, `created_by`, `updated_at` and `updated_by`. ISMS people
are stored by their ISMS reference ids, never as LMS accounts.

**ISMS sync.** At startup and every `Lms:Sync:IntervalMinutes` (default 15) the API copies the
current term's ISMS classes and their class lists into `lmsdb`. Rows are never deleted: a class or
student ISMS stops listing is marked inactive and the LMS content for it is kept. An empty answer
from ISMS preserves existing classes or roster memberships. Stale cache fallbacks are rejected by the sync (read endpoints may still serve them). All required data is fetched before writes, and database updates commit in one transaction; a failed sync keeps the previous copy. Set `Lms:Sync:Enabled` to `false`
to turn it off. Each run asks ISMS for every class list, one at a time; at real-school scale this
needs to respect the ISMS API's rate limit (120 requests per minute by default).

## Run

```bash
cd server
dotnet run --project src/Lms.Api      # http://localhost:5200, OpenAPI at /openapi/v1.json (Development)
dotnet build Lms.slnx
dotnet test Lms.slnx
```

Run the ISMS API on `http://localhost:5100` first. Then `GET /api/isms/status` tells you
whether the LMS can reach it and whether ISMS accepts the credentials, and `GET /api/lms/status`
reports the database and the last sync. `server.http` has example requests.

HTTPS redirection and HSTS are on outside Development only.

## Endpoints

All responses are camelCase JSON. Errors are RFC 7807 problem details (`application/problem+json`)
with a `code` field. Every list endpoint returns `{ "items": [...], "source": "isms", "syncedAt": "<ISO-8601>" }`.
`syncedAt` is when the LMS fetched that data from ISMS.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/classes?instructorId=&schoolYearId=&semesterId=&term=current` | classes: `id, scheduleId, subjectId, subjectCode, subjectName, sectionId, sectionName, instructorId, instructorName, schoolYearId, semesterId, meetings[{day,timeFrom,timeTo,roomId,modality}]` |
| GET | `/api/classes/{id}/students` | `studentId, enrollmentId, firstName, middleName, lastName` |
| GET | `/api/lms/status` | `database { reachable, pendingMigrations }`, `sync { at, termName, classes, activeClasses, students, error }` (null before the first sync), `checkedAt` |
| GET | `/api/subjects` | ISMS subjects: `id, code, name, units, status` |
| GET | `/api/instructors` | ISMS instructors: `id, employeeNo, firstName, middleName, lastName, suffix, honorific, departmentId, status` |
| GET | `/api/isms/status` | `{ reachable, authorized, checkedAt, detail }`. Always 200. Never contains the key or base URL |

A **class** is one section + subject + instructor offering. ISMS schedule rows with the same
`scheduleId + subjectId + instructorId` are merged into one class, and their meetings are
de-duplicated. The class `id` is the base64url form of those three values. It is stable, safe to
put in a URL, and decodes back to the ISMS schedule without a lookup table. Any id the LMS did
not issue returns 404.

`term=current` limits classes to the school year and semester that ISMS flags as current, and
adds a `term` object (`schoolYearId, schoolYearName, semesterId, semesterName`) to the response.
When ISMS flags no current term, nothing is filtered and `term` is `null`.

There is **no POST/PUT/PATCH/DELETE** for classes or subjects, because ISMS owns them.

### Errors

| Situation | LMS answers |
|---|---|
| ISMS answers 401 (bad client id/key) | **502** `isms_unauthorized`. The LMS server is misconfigured; the browser user did nothing wrong |
| ISMS answers 403 (client lacks permission) | **502** `isms_forbidden` |
| ISMS unreachable, timing out or 5xx, with no usable cached copy | **503** `isms_unavailable` + `Retry-After` |
| ISMS answers 429, with no usable cached copy | **503** `isms_rate_limited` + `Retry-After` |
| ISMS unreachable or 429, and a cached copy is younger than TTL + MaxStale | **200** with the cached data; `syncedAt` shows its age |
| ISMS answers 404 (for example, an unknown schedule) | **404** `isms_not_found` |
| ISMS sends a body the LMS cannot parse | **502** `isms_bad_response` |

A 401 or 403 from ISMS is never hidden behind stale data, so a credentials problem shows up straight away.

## Class content (Phase 2, step 2)

Modules, materials and announcements are stored in `lmsdb`. ISMS classes are never created or
edited here; the content hangs off the synced classes.

**Who is asking (demo only).** Sign-in arrives in Phase 4. Until then the client sends the person
it is "viewing as" in `X-Demo-User-Id` (an ISMS reference id, such as `EMP-0003` or `STU-0011`)
and `X-Demo-Role` (`instructor` or `student`). Anyone can send any value, so this is **not
authentication**. It is on only when `Lms:DemoIdentity:Enabled` is `true`, which
`appsettings.Development.json` sets; everywhere else these routes answer 401. The server still
enforces every rule below against that identity, so real sign-in only changes where the identity
comes from.

| Who | Can |
|---|---|
| The class's instructor (ISMS) | Read everything, including archived items; create and change content while ISMS still offers the class (409 after that) |
| A student on the class's active ISMS class list | Read modules, active materials and active announcements; 403 on any change |
| Anyone else | 404, as if the class did not exist |

| Method | Route | Notes |
|---|---|---|
| GET | `/api/me/classes` | `{ role, items }`: the caller's active classes, with `termName` and `meetings` |
| GET | `/api/classes/{classId}/modules` | Ordered by `sortOrder`. `parentModuleId` marks a submodule |
| POST | `/api/classes/{classId}/modules` | `{ title, parentModuleId?, sortOrder? }`. Two levels at most; `sortOrder` defaults to the next number |
| PATCH | `/api/classes/{classId}/modules/{id}` | `{ title?, sortOrder? }` |
| GET | `/api/classes/{classId}/materials?moduleId=&page=&pageSize=` | Paged `{ items, page, pageSize, total }` |
| POST | `/api/classes/{classId}/materials` | `{ moduleId, title, kind, description?, fileName?, fileType?, fileSize? }`. `kind` is one of the six types on the Instructor form. File name only; nothing is uploaded |
| PATCH | `/api/classes/{classId}/materials/{id}` | `{ title?, kind?, description?, status?, moduleId? }`, where status is `active` or `archived`; `moduleId` moves it to another module or submodule of the same class |
| DELETE | `/api/classes/{classId}/materials/{id}` | 204 |
| GET | `/api/classes/{classId}/announcements?page=&pageSize=` | Newest first, paged; `postedBy` is the instructor's ISMS id |
| POST | `/api/classes/{classId}/announcements` | `{ title (≤120), message (≤1,200) }` |
| PATCH | `/api/classes/{classId}/announcements/{id}` | `{ status }`: archive or restore |

Validation errors are 400 with field errors. Every change writes an `audit_log` row (who, action,
what, id) in the same transaction, never the text itself. The ISMS sync gives every offered class
a starter module ("Unit 1 · Foundations") and default gradebook weights, once.

## Coursework (Phase 2, step 3)

**Questionnaires** are reusable question sets owned by one instructor; one questionnaire can back
exams in several sections. Only the owner sees one (others get 404, students 403). Once any
student has started an exam that uses it, its questions are locked (409) so recorded answers keep
pointing at the questions they answered.

| Question type | Send | Stored as |
|---|---|---|
| `multiple_choice` | `options: [{ text, isCorrect }]`, 2–10, exactly one correct | options |
| `true_false` | `correctAnswer: true/false` | options "True" and "False" |
| `essay` | prompt only (graded by the instructor) | — |
| `enumeration` | `expectedAnswers: [...]`, 1–20 | expected answers |
| `matching` | `pairs: [{ left, right }]`, 2–20 | option (left) + expected answer (right) with the same sort order |

Every question has `prompt`, `points` (more than 0, at most 1000) and an optional
`timeLimitSeconds` (0 means none).

| Method | Route | Notes |
|---|---|---|
| GET | `/api/questionnaires` | The caller's questionnaires with question count, total points, `locked`, and `usedBy` (each exam using it: `examId, examTitle, classId, subjectName, sectionName`; archived exams left out) |
| POST | `/api/questionnaires` | `{ title, subjectId? }`; `subjectId` must be a subject the caller teaches |
| POST | `/api/questionnaires/{id}/copy` | Owner only (others 404). A deep copy (questions, choices, accepted answers, pairs) titled "… (copy)", unlocked, owned by the caller, same subject |
| GET / PATCH | `/api/questionnaires/{id}` | Full view with correct answers (owner only) / `{ title }` |
| PUT | `/api/questionnaires/{id}/questions` | `{ questions: [...] }` replaces the whole list in one transaction; errors name the position, e.g. `questions[2].pairs` |
| GET | `/api/classes/{classId}/coursework?type=&page=&pageSize=` | Soonest due first. Students see published and closed work whose `availableFrom` has passed. Instructors also get `gradedCount` and `rosterCount` |
| GET | `/api/classes/{classId}/coursework/{id}` | Same visibility |
| POST | `/api/classes/{classId}/coursework` | `{ type (assignment or exam), moduleId, title, instructions?, maxPoints (assignments), dueAt?, availableFrom?, allowLate?, allowResubmission?, maxAttempts? (1–20), timeLimitMinutes? (0–600), questionnaireId (exams), status? }` |
| PATCH | `/api/classes/{classId}/coursework/{id}` | Any of the fields above except `type`; `status` is draft, published or archived. It cannot set or leave `closed` (400 pointing to the actions below) |
| POST | `/api/classes/{classId}/coursework/{id}/close` | Published work only. 409 with `ungraded: [{ studentId, name }]` until every student active on the class list is graded |
| POST | `/api/classes/{classId}/coursework/{id}/reopen` | Closed work back to published |

An exam is worth the total points of its questionnaire and cannot be published without
questions. An exam can use only the caller's own questionnaire, and only one for the class's
subject (or one with no subject). Several exams can share one questionnaire; each keeps its own
dates, attempts and time limit. Assignments cannot have a questionnaire. Students never receive `questionnaireId`,
questions or answers from these routes; they get questions when they start an attempt (step 4).

**Closing (D-036).** "Graded" means: assignment, the student's latest submission has a grade;
exam, at least one attempt is graded (an attempt whose essays still wait is not). Closed work
refuses hand-ins and starting, saving or submitting attempts (409); grades can still be corrected.
Close and reopen each write a metadata-only audit row.

## Submissions and grading (Phase 2, step 4)

Every rule is checked by the server: when work is available, due dates and late work, attempt
limits, the exam time limit, and scoring. Correct answers reach only the class's instructor.

**Exams (students).** `POST …/coursework/{id}/attempts` starts an attempt, or returns the open one
(so a reload resumes it). The response holds the questions without answers: choices for multiple
choice and true/false, how many items an enumeration expects, and for matching the left items with
the right-hand items in alphabetical order. Answers are saved with `PUT …/attempts/{attemptId}/answers`
and the attempt is handed in with `POST …/attempts/{attemptId}/submit` (answers may be sent with it).

| Rule | Behaviour |
|---|---|
| Attempts | `maxAttempts` (1 when not set); 409 once used |
| Due date | Starting or handing in after `dueAt` is refused unless `allowLate` |
| Time limit | Saving stops at start + `timeLimitMinutes` (or the due date, when late work is not allowed), plus 60 seconds' grace; a later submit records the saved answers only |
| Per-question time limits | Stored and sent to the client, but not enforced by the server yet |

**Scoring.** Multiple choice and true/false are all or nothing. Enumeration ignores case, spacing
and order and gives points in proportion to the expected answers given. Matching gives points in
proportion to correct pairs. Essays wait for the instructor. An exam with no essays is graded on
submit (`graded_by` = `auto`). Points are rounded to two decimals.

**Assignments (students).** A student works on a draft (text, a link, uploaded files), turns it in
for a receipt, and can take it back before the due date: see
[Assignment drafts and files](#assignment-drafts-and-files-d-055-d-058). The older
`POST …/coursework/{id}/submissions` with `{ text?, fileName? }` (a typed file name, no file) still
works. A second hand-in needs `allowResubmission`. `late` is true when handed in after the due date.
`GET …/coursework/{id}/my-submissions` lists the student's own work with score and feedback,
including their draft and any version they took back.

**Grading (the class's instructor, also after ISMS stops offering the class).**

| Method | Route | Notes |
|---|---|---|
| GET | `…/coursework/{id}/submissions` | Every attempt, plus `missing`: students on the class list who have handed nothing in |
| GET | `…/coursework/{id}/submissions/{submissionId}` | The attempt with the correct answers beside the student's |
| PUT | `…/coursework/{id}/submissions/{submissionId}/grade` | Assignments `{ points, feedback? }`. Exams `{ answerPoints: { questionId: points }, feedback? }`; every written essay needs points, and the score is the sum of all answers |
| PUT | `…/coursework/{id}/students/{studentId}/grade` | `{ points, feedback? }` for a student who handed in nothing: creates a "not handed in" record (graded, no work, `submittedAt` null, `notHandedIn: true`) or corrects it. 409 when the student handed in or has an attempt in progress |
| POST | `…/coursework/{id}/grade-missing` | `{ points, feedback? }` for every active student with no submission at all, in one transaction and one audit row; returns `{ graded }`. Never overwrites |
| GET | `/api/classes/{classId}/gradebook` | Weights and each student's averages; a student sees only their own row |
| PUT | `/api/classes/{classId}/gradebook` | `{ activityWeight, examWeight, passingScore }`; the weights must add up to 100 |

Gradebook rules are the prototype's: graded work only, the latest graded assignment submission,
the highest graded exam attempt, and an overall only once every weighted category has a grade.
Phase 3 replaces the two fixed categories with teacher-defined grade components. A "not handed
in" grade counts like any graded work, and once a student has one they can no longer hand in or
start an attempt for that coursework (409).

**Monthly attendance.** Monthly totals, not a daily roll call: attendance % = days present ÷
school days × 100. Recorded only; it does not count in the gradebook yet.

| Method | Route | Notes |
|---|---|---|
| GET | `/api/classes/{classId}/attendance` | Months, newest first, with `entries` (`studentId`, `daysPresent`); a student gets only their own entry |
| PUT | `/api/classes/{classId}/attendance/{year}/{month}` | `{ schoolDays, entries: [{ studentId, daysPresent }] }`; creates or updates the month in one transaction. Students left out keep their saved days |

The class's instructor writes, only while ISMS offers the class (409 after). School days are 1 to
the days in that month; days present are 0 to the school days, for students active on the class
list. Lowering the school days below a saved entry is refused, naming the students to change first.

## Demo mode

`ASPNETCORE_ENVIRONMENT=Demo` runs the API on its own, with no MySQL and no ISMS API:

```bash
cd server
ASPNETCORE_ENVIRONMENT=Demo dotnet run --project src/Lms.Api --no-launch-profile --urls http://localhost:5299
```

- **Data.** The fictional people, classes, materials and quizzes in `client/src/data.js`, exported
  to `src/Lms.Api/Demo/demo-seed.json` by `npm run demo-seed` in `client/` (CI fails when they
  differ). People and classes are served through a built-in fake ISMS, with the same ids as the
  browser-local seed (`instructor-1`, student `s0`, class `biology`).
- **Sandboxes.** Each `X-Demo-Sandbox` header value gets its own freshly seeded SQLite database
  (without the header, the `default` one), so parallel browser tests never see each other's
  changes. Files live in `Lms:Demo:DataDirectory` and are deleted at startup.
- **Time.** Seed dates are read in `Lms:Demo:TimeZone` (Asia/Manila). `Lms:Demo:Now`, for example
  `2026-10-23T09:00:00+08:00`, starts the server's clock at a fixed moment, as the browser tests do.
- The demo identity is on, and CORS allows ports 5173 and 4173.

Never run demo mode on a server other people can reach: anyone can say who they are.

`GET /api/me/overview` returns everything a workspace shows in one call: classes with class size,
modules, materials, announcements, coursework, submissions, class lists, gradebook settings and attendance months.
Students get only published, available work, active content, their own submissions and their own attendance.
`GET /api/people` lists who the client can view as, when the demo identity is on.

## Caching

`IIsmsCatalog` is the LMS's read-side copy of ISMS data. Today it is `MemoryIsmsCatalog`, which is
per process and lost on restart. Each key is fetched by one request at a time, so a burst of
requests on a cold cache calls ISMS once. A database-backed copy can implement the same interface
later without changing the endpoints.

## Not in this slice

- Real sign-in. Content routes use the demo identity above; the ISMS, status and diagnostic routes are anonymous.
- The client does not use the content, coursework or submission endpoints yet (steps 5 and 6).

## Attempt retention (D-042)

Once a day (first run five minutes after startup) the API anonymizes old attempts: answer text,
enumeration items, matching answers and a submission's text and link are cleared and its uploaded
files are deleted (the `stored_files` row stays, without its name), while scores, points and
grades stay. A term's attempts are cleared once it is more than `Lms:Retention:AttemptTerms` terms
behind the current one, and only for classes ISMS no longer offers. Terms are ordered by ISMS school
year and semester ids. Nothing runs when no class is offered. Each run that clears something writes
one metadata-only audit row. Demo mode has no retention job.

| Setting | Default | Notes |
|---|---|---|
| `Lms:Retention:AttemptTerms` | 2 | to be confirmed by the registrar or data protection officer (RA 10173) |
| `Lms:Retention:Enabled` | `true` | `false` turns the daily job off |

## Assignment drafts and files (D-055, D-058)

The shapes are in [`client/docs/ASSIGNMENTS_API_CONTRACT.md`](../client/docs/ASSIGNMENTS_API_CONTRACT.md) §5–§9.

**Hand-in settings** on an assignment (`POST`/`PATCH …/coursework`): `submissionKinds` (`text`,
`file`, `link`), `allowedFileTypes` (`pdf`, `word`, `powerpoint`, `excel`, `image`, `text`),
`maxFiles` (1 to 5) and `honorStatement`. They are enforced on save, at upload and at turn-in.

| Method | Route (under `/api/classes/{classId}/coursework/{id}`) | Notes |
|---|---|---|
| POST | `…/draft` | The student's draft, created when there is none. After turned-in work it starts as a copy of it |
| PUT | `…/draft` | `{ text, link }` (autosave); null clears one |
| POST | `…/draft/files` | One file, `multipart/form-data`, field `file`. 20 a minute per student |
| DELETE | `…/draft/files/{fileId}` | Takes the file off the draft |
| POST | `…/draft/turn-in` | `{ honorStatement? }`. Answers the work and a receipt; a repeat answers the same receipt |
| POST | `…/unsubmit` | Takes back the latest turned-in work: it becomes `withdrawn` (kept, hidden from instructors) and a draft with the same content takes its place |
| GET | `/api/files/{fileId}` | The file, as a download only (`nosniff`, attachment, `Content-Security-Policy: sandbox`) |

**What happens to an upload.** It is streamed to `tmp/` in the file store while its size and
SHA-256 are counted; its type is decided **from its bytes** (the name only has to agree); the
assignment's settings are checked; it is sent to the virus scanner; and only then is it moved to
its place under a random key and recorded in `stored_files`. A refused upload leaves nothing
behind. Old Office formats, macro-enabled files, ZIP and anything unrecognized are refused with
the reason. A file is on a draft or version through `submission_files`, so a new draft reuses the
files of the version it was copied from; the bytes are deleted when the last link goes, and by
[retention](#attempt-retention-d-042).

**Who can download.** The student who uploaded the file, and the instructor of its class once
the file is part of handed-in work (not a draft, not a version taken back). Everyone else gets
the same 404 as for a file that doesn't exist.

| Setting | Default | Notes |
|---|---|---|
| `Lms:Files:Root` | `App_Data/files` in Development; a folder per sandbox in Demo mode; otherwise **required** | Keep it outside any web root, back it up, and make it writable by the API only |
| `Lms:Files:Scanner` | `none` in Development and Demo mode; otherwise **required** | `clamav` or `none`. `none` is refused outside Development and Demo mode. It is not a scanner: it refuses only a file that starts with `LMS-VIRUS-SCAN-TEST-FILE`, so the refusal can be tried out |
| `Lms:Files:ClamAv:Host` / `Port` / `TimeoutSeconds` | `127.0.0.1` / `3310` / `60` | clamd over TCP (`INSTREAM`). Set clamd's `StreamMaxLength` to at least `26M` |
| `Lms:Files:UploadsPerMinute` | 20 | Per student |

The API refuses to start without a folder and a scanner, like a missing connection string. To
try ClamAV locally:

```bash
cd server
docker compose -f docker-compose.clamav.yml up -d        # first start downloads the virus database
cd src/Lms.Api
dotnet user-secrets set Lms:Files:Scanner clamav
```

When clamd can't be reached the upload fails with 503 and nothing is kept; the student tries again.

