# LMS API

ASP.NET Core (.NET 10) backend for the LMS. This first slice is **read-only**: it pulls subjects,
instructors, class schedules and class rosters from the school's ISMS and gives them to the
React client.

The LMS does not create subjects or classes. ISMS owns them. The LMS reaches ISMS **only through
the ISMS API over HTTP**, using a client id and API key. It never connects to the ISMS database.

```
React client ──/api/*──▶ LMS API (this) ──X-Client-Id / X-Api-Key──▶ ISMS API ──▶ ISMS
                         in-memory cache (TTL, stale-serve)
```

## Layout

| Path | What |
|---|---|
| `Lms.slnx` | Solution: the web project and its tests |
| `src/Lms.Api/` | The web project (minimal APIs) |
| `src/Lms.Api/Isms/` | `IIsmsClient` (typed `HttpClient`: paging, timeout, retry), `IIsmsCatalog` + in-memory cache, options |
| `src/Lms.Api/Classes/` | Mapping ISMS schedules to LMS classes, `ClassId` |
| `src/Lms.Api/Endpoints/` | HTTP endpoints, ISMS error → problem-details mapping |
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

## Run

```bash
cd server
dotnet run --project src/Lms.Api      # http://localhost:5200, OpenAPI at /openapi/v1.json (Development)
dotnet build Lms.slnx
dotnet test Lms.slnx
```

Run the ISMS API on `http://localhost:5100` first. Then `GET /api/isms/status` tells you
whether the LMS can reach it and whether ISMS accepts the credentials. `server.http` has example requests.

HTTPS redirection and HSTS are on outside Development only.

## Endpoints

All responses are camelCase JSON. Errors are RFC 7807 problem details (`application/problem+json`)
with a `code` field. Every list endpoint returns `{ "items": [...], "source": "isms", "syncedAt": "<ISO-8601>" }`.
`syncedAt` is when the LMS fetched that data from ISMS.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/classes?instructorId=&schoolYearId=&semesterId=` | classes: `id, scheduleId, subjectId, subjectCode, subjectName, sectionId, sectionName, instructorId, instructorName, schoolYearId, semesterId, meetings[{day,timeFrom,timeTo,roomId,modality}]` |
| GET | `/api/classes/{id}/students` | `studentId, enrollmentId, firstName, middleName, lastName` |
| GET | `/api/subjects` | ISMS subjects: `id, code, name, units, status` |
| GET | `/api/instructors` | ISMS instructors: `id, employeeNo, firstName, middleName, lastName, suffix, honorific, departmentId, status` |
| GET | `/api/isms/status` | `{ reachable, authorized, checkedAt, detail }`. Always 200. Never contains the key or base URL |

A **class** is one section + subject + instructor offering. ISMS schedule rows with the same
`scheduleId + subjectId + instructorId` are merged into one class, and their meetings are
de-duplicated. The class `id` is the base64url form of those three values. It is stable, safe to
put in a URL, and decodes back to the ISMS schedule without a lookup table. Any id the LMS did
not issue returns 404.

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
- Any LMS-owned data or database.
