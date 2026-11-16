# ISMS stand-in database (development only)

A local MySQL 8.4 with **fictional** data shaped like the real ISMS `tmccdb`
tables the ISMS API reads. The database is called `isms_dev` on purpose, so a
real local copy of `tmccdb` can never be overwritten by these scripts.

Table and column names, types, lengths, defaults and indexes match the EF Core
mappings in the reference `ISMSdbContext.cs` exactly (including casing).

## Files

| File | What it does |
|---|---|
| `01_schema.sql` | Creates `isms_dev` and (re)creates its 11 tables. Every `DROP`/`CREATE` is qualified with `isms_dev`. |
| `02_seed.sql` | Inserts the fictional seed data. |
| `03_users.sh` | Creates the empty `ismsapi_dev` database and the `isms_api_ro` / `isms_api_rw` users. Passwords come from environment variables. |
| `04_lmsdb.sh` | Creates the LMS API's own database `lmsdb` and its user `lms_api_rw`. Not ISMS data: it shares this dev server for convenience. |
| `../docker-compose.yml` | MySQL 8.4 on host port **3307** (bound to 127.0.0.1) that runs the files above on first start. |

## Start

Run from `isms-api/`:

```sh
docker compose up -d
docker compose ps        # wait for "healthy" (the first start takes ~20-40 s)
```

The init scripts run **only** when the data volume is empty (that is, on first start).
The server listens on `127.0.0.1:3307`. It never uses or touches port 3306, so a
Homebrew MySQL there is unaffected.

### Passwords

The compose file ships with obvious dev-only placeholders. To override them, export
them or put them in an untracked `isms-api/.env` **before the first start**:

```sh
ISMS_DB_ROOT_PASSWORD=dev_only_root_change_me
ISMS_API_RO_PASSWORD=dev_only_ro_change_me
ISMS_API_RW_PASSWORD=dev_only_rw_change_me
LMS_API_RW_PASSWORD=dev_only_lms_change_me
```

All API passwords, including `LMS_API_RW_PASSWORD`, must not contain `'` or `\`. If they do, `03_users.sh` refuses to run.

## Reset

Wipe everything and re-seed from the scripts:

```sh
docker compose down -v && docker compose up -d
```

To reload only the schema and seed without touching the users, run this from `isms-api/`:

```sh
docker compose exec -T isms-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot' < db/01_schema.sql
docker compose exec -T isms-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot' < db/02_seed.sql
```

Stop the server and keep the data with `docker compose down`.

## Connection strings for the API

| Purpose | Connection string |
|---|---|
| ISMS data (read-only) | `Server=127.0.0.1;Port=3307;Database=isms_dev;User=isms_api_ro;Password=dev_only_ro_change_me;` |
| API's own tables (EF migrations) | `Server=127.0.0.1;Port=3307;Database=ismsapi_dev;User=isms_api_rw;Password=dev_only_rw_change_me;` |
| LMS API's database (`../../server`) | `Server=127.0.0.1;Port=3307;Database=lmsdb;User=lms_api_rw;Password=dev_only_lms_change_me;` |

| User | Rights |
|---|---|
| `isms_api_ro` | `SELECT` on `isms_dev.*` only. It cannot write and has no access to `ismsapi_dev`. |
| `isms_api_rw` | `ALL PRIVILEGES` on `ismsapi_dev.*` only. It has no access to `isms_dev`. |
| `lms_api_rw` | `ALL PRIVILEGES` on `lmsdb.*` only. It cannot read `isms_dev`, so the LMS reaches ISMS data only through the ISMS API. |

**Existing volume.** `04_lmsdb.sh` runs by itself only on a fresh volume. If your container was
created before it existed, run it once:

```bash
cd isms-api
docker compose up -d      # picks up LMS_API_RW_PASSWORD; data is kept
docker compose exec isms-db bash /docker-entrypoint-initdb.d/04_lmsdb.sh
```

## Join keys

- `scheduleitems_tbl.RefID` and `schedulestudents_tbl.RefID` both join to `schedules_tbl.RefID`.
- `schedulestudents_tbl.EnrollmentID` joins to `enrollments_tbl.RefID`.
- `enrollments_tbl.StudentID` joins to `students_tbl.RefID`.
- `scheduleitems_tbl.InstructorID` and `schedules_tbl.AdviserID` join to `employees_tbl.RefID`.
- `scheduleitems_tbl.SubjectID` joins to `subjects_tbl.ID`.
- `schedules_tbl.SectionID` joins to `educsections_tbl.ID`.
- `schedules_tbl.SYID` joins to `schoolyear_tbl.ID`, and `SemesterID` joins to `semester_tbl.ID`.

These codes are conventions of the stand-in, not confirmed against the real ISMS:

| Field | Values |
|---|---|
| `Status` | `'1'` means active, `'0'` means inactive. |
| `schoolyear_tbl.Standing` / `semester_tbl.StandingID` | `'1'` marks the current one. |
| `DayID` | `M`, `T`, `W`, `TH`, `F`, `S`, combined, for example `MW` or `TTH`. |
| `scheduleitems_tbl.Modality` | `1` is face-to-face, `2` is online. |
| `RoomID` | A plain number. The stand-in has no rooms table. |

## Seed contents

| Table | Rows | Notes |
|---|---|---|
| `schoolyear_tbl` | 2 | ID 1 = 2025-2026 (past), **ID 2 = 2026-2027 (current)** |
| `semester_tbl` | 3 | **ID 1 = 1st Semester (current)**, 2 = 2nd Semester, 3 = Summer |
| `educsections_tbl` | 3 | ID 1 = BSIT 1-A, 2 = BSIT 2-A, 3 = BSIT 3-A |
| `subjects_tbl` | 10 | IDs 1-9 = IT101-IT103, IT201-IT203, IT301-IT303 (active). **ID 10 = IT199, inactive.** |
| `employees_tbl` | 7 | EMP-0001..0005 are active instructors. **EMP-0006 is an inactive instructor.** EMP-0007 is registrar staff. |
| `schedules_tbl` | 4 | SCH-2026-1-S1/S2/S3 = current term (SYID 2, Sem 1, sections 1-3). SCH-2025-2-S1 = past term (SYID 1, Sem 2, section 1). |
| `scheduleitems_tbl` | 11 | 3 per current schedule (subject + instructor + day + time + room), 2 on the past one |
| `students_tbl` | 30 | STU-0001..0010 are in 1-A, 0011..0020 in 2-A, 0021..0030 in 3-A |
| `enrollments_tbl` | 35 | 30 current (ENR-2026-1-0001..0030) plus 5 past (ENR-2025-2-0011..0015) |
| `schedulestudents_tbl` | 35 | Every enrollment is attached to its schedule. |
| `educsectionsitems_tbl` | 35 | Section membership for every enrollment |

Quick check: this should return the 10 students of BSIT 2-A taking IT202:

```sql
SELECT st.FName, st.LName
FROM schedules_tbl s
JOIN schedulestudents_tbl ss ON s.RefID = ss.RefID
JOIN scheduleitems_tbl si    ON s.RefID = si.RefID
JOIN enrollments_tbl e       ON ss.EnrollmentID = e.RefID
JOIN students_tbl st         ON e.StudentID = st.RefID
WHERE s.SYID = 2 AND s.SemesterID = 1 AND s.SectionID = 2 AND si.SubjectID = 5;
```

All names, addresses, phone numbers (`555-0xxx`) and emails (`@example.com`) are invented.
