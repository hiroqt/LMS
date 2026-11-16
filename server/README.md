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
| LMS-owned | `modules` (optional parent for submodules), `materials`, `announcements`, `questionnaires`, `questions`, `question_options`, `question_expected_answers`, `coursework`, `submissions`, `submission_answers`, `grades`, `gradebook_settings`, `audit_log` |

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

## Caching

`IIsmsCatalog` is the LMS's read-side copy of ISMS data. Today it is `MemoryIsmsCatalog`, which is
per process and lost on restart. Each key is fetched by one request at a time, so a burst of
requests on a cold cache calls ISMS once. A database-backed copy can implement the same interface
later without changing the endpoints.

## Not in this slice

- Login and authorization. The old empty `Auth` placeholders were removed. Every endpoint is anonymous.
- Coursework, questionnaires, submissions, grading, and production content endpoints remain for later Phase 2 slices.

## Phase 2: class content demo (Development only)

In Development the Instructor workspace reads and writes modules, material metadata, and announcements in `lmsdb` for ISMS classes. The class must already exist in the synced reference copy; otherwise content returns 404 until sync succeeds. Existing browser-local demo records are kept. No files are uploaded.

These routes are absent outside Development. Every request needs `X-Demo-Instructor-Id` matching the class's raw ISMS instructor ID. This is a caller-selected demo identity, not authentication or authorization suitable for real users. Use fictional data and local development only. Configure real sign-in and resource authorization before exposing content in production. Development CORS permits GET, POST, PATCH and DELETE for the configured origins; other environments remain GET-only.

| Method | Route below `/api/classes/{classId}/content` | Body / response |
|---|---|---|
| GET | (root) `?offset=0&limit=200` | `{ modules, materials, announcements, nextOffset }`; limit 1–200, follow `nextOffset` until null |
| POST | `/modules` | `{ title, sortOrder }` → 201 module |
| POST | `/materials` | `{ moduleId, title, kind, description?, fileName?, fileType?, fileSize? }` → 201 material |
| POST | `/announcements` | `{ title, message }` → 201 announcement |
| PATCH | `/materials/{id}` | `{ status: "active" | "archived" }` → material |
| DELETE | `/materials/{id}` | 204; removes material metadata |

IDs are database integers. Modules are ordered by sort order then ID, materials by ID, announcements newest first. The aggregate uses the same offset independently for each collection. A missing class/resource returns 404, a mismatched demo instructor 403, invalid fields 400, and writes to an inactive class 409. Reads of retained inactive-class content are permitted. Material references must belong to the requested class. Content writes and metadata-only audit entries commit together; audit summaries omit message and description content.
