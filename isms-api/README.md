# ISMS API

A small read-only HTTP API in front of the school's ISMS (student information system,
MySQL). Third parties such as the LMS never connect to the ISMS database. They call this
API, and each one gets only the operations it has been granted.

- ASP.NET Core 10 minimal APIs, EF Core 10, `MySql.EntityFrameworkCore`.
- Structure: endpoint -> small service -> EF, one folder per feature (`src/Isms.Api/Features/*`).
- Two databases:
  - `IsmsDb`: the ISMS data, read-only. The account only needs `SELECT`. Queries are no-tracking, and `SaveChanges` on `IsmsDbContext` throws.
  - `IsmsApiDb`: this API's own tables (`api_clients`, `api_client_keys`, `api_client_permissions`, `api_request_logs`), managed with EF migrations.

## The two-step check

Every request passes two checks:

1. **Who are you?** The client sends `X-Client-Id: <username>` and `X-Api-Key: <key>`.
   `ApiKeyAuthenticationHandler` looks up the client and its unexpired, unrevoked keys by key prefix. It then compares the SHA-256 of the presented key with the stored hash in constant time.
   A missing header, unknown client, disabled client, wrong key, or expired or revoked key all get the same **401** problem response. The response never says which part failed.
2. **May you do this?** Each endpoint declares exactly one permission (`.RequirePermission(...)`). A client without that permission gets **403**.
   A fallback policy denies anything that declares no permission, including unknown routes and non-GET methods. Only `/openapi/v1.json` and `/health` are anonymous, and only in Development.

Requests are also rate limited per client (default 120 per minute, `RateLimiting:PermitsPerMinute`), and excess requests get **429**. Every request writes one row to `api_request_logs` with the time, the client (if authenticated), method, path, required permission, status code and remote IP. Headers and keys are never logged.

Keys are 32 random bytes from a CSPRNG, base64url encoded (43 characters). Only the first 8 characters, used for lookup, and the SHA-256 hash are stored. The key is printed once, when it is created.

## Endpoints and permissions

All routes are `GET` and read-only. Lists take `page` (default 1) and `pageSize` (default 50, max 200). They return `{ "items": [...], "page", "pageSize", "total" }`. An out-of-range page or page size gets a 400. JSON is camelCase, and errors are RFC 7807 problem details.

| Route | Permission | Notes |
|---|---|---|
| `GET /v1/school-years` | `schedule.view` | `{ id, name ("2025-2026"), status, standing, isCurrent }` |
| `GET /v1/semesters` | `schedule.view` | `{ id, name, status, standing, isCurrent }` |
| `GET /v1/subjects?status=` | `subject.view` | `{ id, code (ShortCode), name, units, status }` |
| `GET /v1/instructors` | `instructor.view` | Employees referenced by at least one schedule item. `{ id (employee RefID), employeeNo, firstName, middleName, lastName, suffix, honorific, departmentId, status }`. No birthdate, sex, address, contact number, email or username. These columns are not even mapped. |
| `GET /v1/schedules?schoolYearId=&semesterId=&instructorId=&subjectId=` | `schedule.view` | One item per (schedule RefID, subject, instructor), with `meetings: [{ day, timeFrom "HH:mm", timeTo, roomId, modality }]` |
| `GET /v1/schedules/{scheduleId}/students` | `student.view` | `{ studentId (student RefID), enrollmentId, firstName, middleName, lastName }`. Returns 404 if the schedule does not exist. |

`status`, `standing` and `day` are the raw ISMS codes, for example `"1"` or `"MW"`. `isCurrent` is true when the ISMS standing code is `"1"`.

Known permissions live in one place: `src/Isms.Api/Access/Permissions.cs`. Granting a permission to a client is a data change. Only a new kind of operation needs code.

## Run it locally

Prerequisites: .NET SDK 10. For the dev database (MySQL on `127.0.0.1:3307` with `isms_dev` and `ismsapi_dev`), see `db/README.md` (`docker compose up -d` from `isms-api/`).

All commands below run from `isms-api/`.

### 1. Connection strings (user-secrets, never in a file)

```sh
dotnet user-secrets --project src/Isms.Api set "ConnectionStrings:IsmsDb" \
  "Server=127.0.0.1;Port=3307;Database=isms_dev;User=isms_api_ro;Password=<ro password>;"
dotnet user-secrets --project src/Isms.Api set "ConnectionStrings:IsmsApiDb" \
  "Server=127.0.0.1;Port=3307;Database=ismsapi_dev;User=isms_api_rw;Password=<rw password>;"
```

Outside Development, use the environment variables `ConnectionStrings__IsmsDb` and `ConnectionStrings__IsmsApiDb` instead. `appsettings.json` contains no secrets.

### 2. Apply migrations (creates this API's own tables in `ismsapi_dev`)

```sh
dotnet tool restore
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update --project src/Isms.Api --context ApiAccessDbContext
```

The local tool manifest (`dotnet-tools.json`) pins `dotnet-ef`. To add a migration after changing the access model, run:
`dotnet ef migrations add <Name> --project src/Isms.Api --context ApiAccessDbContext --output-dir Access/Migrations`.

### 3. Create a client (the key is printed once)

```sh
dotnet run --project src/Isms.Api -- clients create lms --name "LMS API" \
  --permissions subject.view,instructor.view,schedule.view,student.view --expires-days 30
```

### 4. Run

```sh
dotnet run --project src/Isms.Api          # http://localhost:5100, OpenAPI at /openapi/v1.json
```

`isms-api.http` has a demo script with a 200, a 401 and a 403.

## Managing clients

All commands run through the same executable, as `dotnet run --project src/Isms.Api -- clients <command>`:

| Command | Effect |
|---|---|
| `create <username> [--name "..."] --permissions a,b [--expires-days 30]` | New client plus first key (printed once) |
| `rotate <username> [--expires-days 30] [--revoke-old]` | Issues a new key (printed once). Without `--revoke-old`, old keys stay valid until they expire, so the consumer can switch over without downtime. |
| `revoke-key <username> <key-prefix>` | Revokes one key, identified by the prefix shown in `list` |
| `grant <username> a,b` / `ungrant <username> a,b` | Changes permissions. This takes effect on the next request. |
| `disable <username>` / `enable <username>` | A disabled client gets a 401 on every request |
| `list` | Clients, permissions and key metadata (prefix, expiry, last used). It never shows keys or hashes. |

Unknown permission strings are rejected.

### Monthly key rotation

1. Run `clients rotate lms --expires-days 30` and give the new key to the LMS operator through a secure channel.
2. The operator puts the new key in the LMS secret store and restarts or reloads the LMS.
3. Check `clients list`. When the new key shows a recent "last used", run `clients revoke-key lms <old prefix>`. You can also just let the old key expire.

## Onboarding a new third party (for example an ID tap system)

1. Decide the smallest set of permissions it needs, for example only `student.view`. If it needs an operation that does not exist yet, that is a code change. Add a permission to `Permissions.cs` and an endpoint that declares it with `.RequirePermission(...)`.
2. Run `clients create idtap --name "ID Tap System" --permissions student.view --expires-days 30`.
3. Send the printed key to the vendor through a secure channel, never by email or chat in plain text. Together with the username it is their credential.
4. They call the API with `X-Client-Id: idtap` and `X-Api-Key: <key>`. Calls to any other operation get a 403.
5. Rotate monthly as above. To cut them off, run `clients disable idtap`.

## Tests

```sh
dotnet test Isms.slnx
```

The xUnit tests run the real app with `WebApplicationFactory` on temporary SQLite files seeded with fictional data, so no MySQL server is needed. They cover:

- the full 401/403/200 access matrix, key rotation overlap and ungranting
- write methods and undeclared endpoints being denied
- the instructor shape (no personal fields) and pagination bounds
- schedule grouping and filters, and the 404 for an unknown schedule
- request logging without keys, rate limiting and the CLI
