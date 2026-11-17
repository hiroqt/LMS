# Decisions

Newest last. A changed decision gets a new entry that supersedes the old one.

### D-001 · Scope: Student and Instructor only; Admin stays as is
`2026-11-16` · hiro · scope: all · confidence: high
The revamp rebuilds the Student and Instructor UIs. Admin keeps `RoleWorkspace.jsx`,
`rolePages.css`, `components/shared/*`, and its own CSS until a later, separate effort.
Admin is covered by a smoke test in `e2e/routing.spec.ts` so foundation changes cannot
break it unnoticed. New Student/Instructor shells are built under `shared/layout`, not by
editing `RoleWorkspace`.

### D-002 · TypeScript, adopted file by file
`2026-11-16` · hiro · scope: all · confidence: high
`allowJs` + `strict`. Every new file is `.ts`/`.tsx`; legacy `.jsx` is not type-checked
and is replaced rather than converted. `npm run typecheck` is a required check.
Compatible with the ASP.NET Core backend: System.Text.Json emits camelCase by default, and
the server already references `Microsoft.AspNetCore.OpenApi`, so API types will be
generated with `openapi-typescript` when the backend is wired (see D-008).

### D-003 · Tailwind v4 without preflight, scanning only rebuilt folders
`2026-11-16` · hiro · scope: styles · confidence: high
Preflight (the CSS reset) would restyle every legacy element, so only Tailwind's theme and
utilities layers are imported until cutover. Utility scanning is limited to `src/app`,
`src/shared`, and `src/features`, because legacy JSX contains words like `hidden` or
`collapse` that would generate utilities and restyle legacy elements (L-004).
Consequence: legacy unlayered CSS beats Tailwind utilities, and preflight's base styles
are missing, so rebuilt components must set their own base styles (C-005).
Revisit at cutover: import preflight and remove the `@source` restriction.

### D-004 · Router: React Router with a legacy-compatible catch-all
`2026-11-16` · hiro · scope: app/router · confidence: high
React Router (v8, declarative mode) replaces the custom `useRoleRoute`. One `*` route
resolves the role with the original `parseRoleFromLocation`, so `?role=`, `#/role`,
`.html`, `/role/index.html`, subpaths, and the unknown-path fallback keep working. Phases
2 and 3 nest real routes (for example `/student/tasks`) under each role's layout and must
keep `e2e/routing.spec.ts` green.

### D-005 · Typography and contrast floor
`2026-11-16` · hiro · scope: styles · confidence: high
Body text minimum is 14px (`text-body`). Tailwind's `text-xs` is removed; `text-label`
(12px) is only for short uppercase eyebrows. Inputs use 16px so iOS does not zoom.
Muted text is `#5f6b67` (legacy `#7d8985` was 3.6:1). Green text uses `primary-700` or
darker; `primary-600` (the brand green) is a fill color (L-006). Supersedes the
12px body / 10–11px metadata scale in the pre-revamp `AGENTS.md`.

### D-006 · Poppins is self-hosted
`2026-11-16` · hiro · scope: styles · confidence: high
`@fontsource/poppins`, latin subset, weights 400/500/600/700, `font-display: swap`, plus
a metric-matched "Poppins Fallback" face. No Google Fonts request: same rendering on
every platform, offline after the first visit, no layout jump on slow connections.

### D-007 · Flow parity is proven by Playwright, not by eye
`2026-11-16` · hiro · scope: tests · confidence: high
`e2e/*-flow.spec.ts` encode the Student and Instructor flow charts and were written
against the pre-revamp UI. A rebuilt screen ships only when the same specs pass
**unchanged**. Specs select by role and accessible name only. The clock is pinned to
`2026-10-23T09:00` (the seed data's "today"). Any uncaught page error fails a spec.
Changing a spec's expectations needs a decision entry explaining why the flow changed.

### D-008 · Backend later: local adapter first, same hook seam
`2026-11-16` · hiro · scope: data · confidence: high
The ASP.NET Core API is wired after the frontend revamp. Until then, data stays in
browser storage under the existing keys and shapes (`tmcc-lms-roles-v1`,
`gclass-student-workspace-v1`) so saved progress survives. Feature code reads and writes
only through hooks (`useClassrooms()`, `useSubmitAssessment()`, …) on the app QueryClient,
so connecting .NET later swaps the adapter without touching screens.

### D-009 · Query client defaults for slow connections
`2026-11-16` · hiro · scope: app/providers · confidence: medium
`networkMode: "offlineFirst"`, `staleTime` 30s, `gcTime` 24h, 3 query retries with capped
backoff (1s → 15s), no automatic mutation retries. Mutations get retries only through
the Phase 4 outbox, which adds idempotency keys first, so a retried quiz submission
cannot be recorded twice.

### D-010 · Tailwind utilities are `!important` until cutover
`2026-11-16` · hiro · scope: styles · confidence: high
Legacy `index.css` has unlayered element rules (`button, input { font: inherit }`,
`button:not(.class-card) { min-height: 24px }`, heading weights). Unlayered CSS beats any
layered utility, so `text-body` or `min-h-touch` on a new button silently lost. The
utilities import now uses Tailwind's `important` flag. Legacy screens are unaffected
because no utilities are generated from legacy files (D-003). `e2e/new-shell.spec.ts`
checks computed sizes in a real browser. Remove the flag with preflight at cutover.
Amends D-003.

### D-011 · Classic/new toggle for the migration
`2026-11-16` · hiro · scope: app/router · confidence: high
`?ui=new` (or `?ui=classic`) chooses the UI and is remembered under its own key
`tmcc-ui-version`; the default stays **classic** until cutover. Students and instructors
can go back with "Use classic view" in the new profile menu. Admin ignores the toggle
(D-001). The new UIs (`features/student/StudentApp`, `features/instructor/InstructorApp`)
are lazy-loaded, so classic users never download them. Screens not rebuilt yet show
`app/migration/RebuildNotice`. The classic UI does not advertise the toggle until Phase 2
ships a real screen.

### D-012 · /ui-kit is the living design-system reference
`2026-11-16` · hiro · scope: shared/ui · confidence: high
`/ui-kit` renders every primitive and state. It is how co-developers find what exists, and
the specs in `e2e/new-shell.spec.ts` run strict axe (including
contrast), the 44px control check, and the 14px text check against it on desktop, iPhone,
and Android. A new primitive is added to this page in the same PR.

### D-013 · How flow specs may change while proving parity
`2026-11-16` · hiro · scope: tests · confidence: high
Rebuilt screens keep the classic **accessible names and roles** the flow specs use
("Main navigation", "My classes", "Dashboard content", textbox "Search student workspace",
radio/aria-checked, "Go to question N"). A spec may change only to drop a dependency on
classic DOM structure while asserting the same journey on both UIs. Phase 2 made exactly
two such changes: the TW spec checks the selected group's description instead of the
classic `<summary>`, and the persistence check loads `/student` fresh instead of
`reload()` (the rebuilt result page has its own URL). Both specs still pass on classic.

### D-014 · The UI preference is per role
`2026-11-16` · hiro · scope: app/router · confidence: high
`tmcc-ui-version:student` and `tmcc-ui-version:instructor` replace the single Phase 1 key,
which is still read as a fallback. Student and Instructor are rebuilt in different phases,
and real people have one role. It also lets the rebuilt Student UI be tested against the
classic Instructor UI in cross-role journeys (Playwright projects `student-new*`).
Supersedes the "switching workspace keeps the new UI" part of D-011.

### D-015 · Students see instructor exam grades on the exam page
`2026-11-16` · hiro (user decision) · scope: student/assessment · confidence: high
The rebuilt assessment page shows "Graded by your instructor · score / points · feedback"
once an exam is graded, plus "View your result" after any submission. Closes the gap in
L-003. Spec: "an instructor's exam grade and feedback appear on the Student exam page".

### D-016 · Student data layer and URLs
`2026-11-16` · hiro · scope: student/api · confidence: high
- `features/student/api/catalog.ts` rebuilds the classic merged view (seed + role store)
  on every read from `studentSeed`, so instructor changes appear without a reload.
  `progressStore.ts` uses the classic key and shape. `submissions.ts` writes the same
  records and audit events as the classic UI.
- Screens read through `useStudentCatalog()` (TanStack Query, refreshed on
  `tmcc-lms-data`/`storage`) and `useProgress()`. Rules live in `selectors.ts` (unit-tested).
- Every Student screen has a URL under `/student/…` (`paths.ts`); filters and tabs live in
  the query string. Back/Forward and deep links work.
- The quiz clock is timestamp-based (`quizSession.ts`), with the classic rules unchanged.

### D-017 · Instructor data layer and URLs
`2026-11-17` · hiro · scope: instructor/api · confidence: high
- `features/instructor/api/store.ts` reads the role store through TanStack Query
  (`useRoleStore`) and writes with `commit(change, audit)`, the same path as the classic
  `useLmsData().update`. `commit` returns false when storage refuses the write (L-024).
- `actions.ts` writes the classic records and metadata-only audit events.
  `selectors.ts` holds the classic rules, including the review queue built from the
  demo student's local progress, with the auto-score suggestion.
- Every screen, tab (`?tab=`), open form (`?create=`), and selected submission
  (`?review=`) has a URL under `/instructor/…`.
- Search results open the matching class tab (Materials or Classwork). The classic UI only
  switched to its Classes view without opening the result.

### D-018 · Phase 3 spec widenings and parity projects
`2026-11-17` · hiro · scope: tests · confidence: high
Under D-013, three classic-specific selectors were widened; all still pass on classic:
tab counts accept a space (`/^Submissions\s?1/`, since the classic "Submissions1" was the
L-021 bug), required labels match by prefix (`/^Assignment title/`, since the classic label
appended " · required"), and category buttons match `/Create/` (now "Create assignment"
instead of "+ Create"). New projects: `instructor-new` (+ iPhone) runs the Instructor
journeys with Student classic, and `both-new` runs every flow spec with both rebuilt UIs,
which is the state after cutover.

### D-019 · Offline app shell (PWA)
`2026-11-17` · hiro · scope: app · confidence: high
`vite-plugin-pwa` precaches the built app, fonts, and icons (~1.1 MB, downloaded once in
the background after the first visit) and caches images the first time they are shown.
After one visit both rebuilt UIs open and work with no connection. Answers and drafts were
already stored on the device. Registration is a deferred script tag, so no JS is added to
the eager bundle. The manifest makes the app installable on phones. Disabled in the dev
server; offline specs run against the production build (`E2E_PREVIEW=1`).

### D-020 · Outbox and persisted query cache wait for the API; a performance budget now
`2026-11-17` · hiro · scope: data, performance · confidence: high
Every write is stored on the device the moment it happens, and nothing is sent over the
network yet, so a submission outbox and a persisted query cache would have nothing to do.
They are built with the .NET `httpAdapter` (plan §6), keeping the rule that success is
shown only after the server accepts (L-024), with idempotency keys. Meanwhile
`npm run budget` (in CI) caps the gzip size of the entry script (135 KB), lazy chunks
(40 KB), and stylesheets (45 KB). Lighthouse mobile on the production build: rebuilt
Student and Instructor score 100 / 100 / 100 (performance / accessibility / best
practices), LCP 0.9 s, CLS 0. The first visit on Slow 3G shows content in 5.8 s (spec-enforced
under 10 s).

### D-021 · Cutover: the rebuilt Student and Instructor UIs are the only ones
`2026-11-17` · hiro (user decision: full cutover) · scope: all · confidence: high
The classic Student (`App.jsx`, `App.css`, `Details.css`, `roles/student`) and Instructor
(`roles/instructor`) UIs, the `?ui=` toggle (D-011, D-014), and the migration notice are
removed; a leftover `?ui=` is ignored. `data.js` no longer merges role data at import (the
Student catalog merges per read). Admin is untouched. Classic CSS rules the Admin shell
still used moved verbatim to `roles/shared/shellCompat.css`; Admin is pixel-identical to
`main` in every captured state (L-034). The screen-reader checklist had not been run by a
person at cutover; run it next. The flow specs that proved parity now guard the rebuilt UI,
and the `*-new` projects are gone. Entry JS 123.5 → 96.8 KB gz, CSS 39.1 → 22.2 KB gz;
the budget is tightened to 105 / 26 KB.

### D-022 · Preflight, `!important` utilities, and the `@source` limit stay until Admin is revamped
`2026-11-17` · hiro · scope: styles · confidence: high
The plan called for enabling Tailwind preflight at cutover. Admin still runs on legacy CSS
that relies on browser defaults, so preflight would restyle it (D-001 says Admin must not
change). D-003 and D-010 therefore stay in force, scoped to Admin's lifetime: no
preflight, `!important` utilities, and scanning limited to `app/`, `shared/`, and
`features/`. Revisit all three when Admin is rebuilt. Supersedes the cutover step in D-003.

### D-023 · Academic dashboard redesign from the user's reference
`2026-11-17` · hiro (user reference image) · scope: student, instructor, shared · confidence: high
The dashboards follow the user's reference: a sidebar with the college seal and name
("TMCC LMS · Trece Martires City College") and a solid green active item; Student
destinations **Dashboard, My Classes, Tasks & Assessments, Calendar, News &
Announcements** (short labels on the phone bar); a large greeting with the date and term
week, compact stat chips, a campus illustration (Student, desktop only); panels with icon
headings and "View all" links: Tasks & Assessments with due pills, My Classes cards with
a left accent and subject icon, a read-only Academic Calendar timeline, and
Announcements. Course codes ("IT101") replace the old two-digit marks, and class pages
use a syllabus-style `CourseHeader`. Journey-name changes, with specs updated: "Today" →
"Dashboard"; News & Announcements is its own page (`/student/news`) instead of a
dashboard toggle (spec B → N); class buttons read "IT101 Introduction to Programming …";
the dashboard course card's name starts with the course title. A term-progress band was
prototyped and dropped in favor of the reference (the term week stays in the date line).
Amended by D-024: the illustration and the cards' left accent were removed.


### D-024 · Display preferences, plainer copy, no side stripes
`2026-11-16` · hiro (user request) · scope: student, instructor, shared · confidence: high
Amends D-023 at the user's request:
- **Cards or table.** The class lists on both dashboards and both My classes pages have
  a "Class list view" toggle (`ViewToggle`, `ClassTable`). The choice is one preference
  (`tmcc-classes-view`) shared by those four places. Other lists stay as they are.
- **Collapsible sidebar.** On desktop the sidebar narrows to icons (`tmcc-sidebar-collapsed`);
  every item keeps its accessible name and gets a tooltip. The "My classes" list in the
  sidebar folds (`SidebarGroup`), in both roles.
- **No side color stripe** on cards. Class identity is the subject icon tile and the code.
- **Plain copy.** Removed the campus illustration, taglines under greetings, eyebrows
  that restate a heading, and encouragement lines ("Enjoy your focus time"). A subtitle
  must state a fact the reader can use (a count, a date) or be left out.
These are display preferences in new localStorage keys; no journey changed and the
existing specs pass unchanged. `e2e/class-view.spec.ts` covers the new controls.

### D-025 · Pages fill the content area and adapt to it
`2026-11-16` · hiro (user request) · scope: student, instructor, shared · confidence: high
The page no longer sits in a 72rem column in the middle of the window. `<main>` fills
the space beside the sidebar (capped at 120rem for very wide monitors) and is a CSS size
container. Dashboards, class lists, and two-column pages choose their columns from the
width they actually have (`@xl:`, `@4xl:`, `@7xl:`), so the layout also responds when
the sidebar collapses. On a wide window the Student dashboard shows tasks, classes, and
calendar side by side. Reading pages (material, quiz, result) keep their line-length
limits. No journey changed.

### D-026 · Dashboards are bento grids
`2026-11-16` · hiro (user request) · scope: student, instructor, shared · confidence: high
Both dashboards are one grid of tiles (`Panel`, stat chips, the greeting) with a single
gutter (12px on phones, 16px from `sm`). Tiles stretch to their row so every row ends on
one line, and the content inside a tile takes the extra height (list rows and class cards
grow; an empty state centers). The greeting is a tile beside the stat chips instead of a
header with empty space to its right. Student tiles read tasks, calendar, classes,
announcements; with two columns the classes and the announcement take full-width rows,
with three the calendar stacks over the announcement. Class card grids use
`auto-fit`, so cards share a row with no empty cell beside them.

### D-027 · Bento mosaic and a wider type scale
`2026-11-16` · hiro (user request) · scope: student, instructor, shared · confidence: high
Amends D-026 and the type scale in D-005.
- **Type:** section headings are 20px and card titles 17px (were 18 and 15), so a title
  is visibly larger than its 14px details. Item titles inside tiles use `text-card-title`.
- **Mosaic:** each dashboard is one 12-column grid. Tiles differ in size and weight: a
  filled green greeting tile (with the next deadline, or the review queue for
  instructors), stat tiles, white panels, and flat tinted class tiles (`tile` on the
  class cards). Student: tasks 7 | calendar 5, classes 7 | announcements 5; wide:
  tasks 5 | calendar 3 | classes 4, then announcements across in three columns.
- **Filling tiles with content:** announcements show up to three items; the instructor
  calendar tile lists the month's upcoming dates under the grid.
- `StatCard` lays itself out by its own width (container query), not the viewport.

### D-028 · Card titles are 16px
`2026-11-16` · hiro (user request) · scope: shared · confidence: high
17px card titles (D-027) read as too big. Card and item titles are 16px semibold over
14px details; section headings stay 20px. The greeting tiles' second line is 14px.

### D-029 · The sidebar toggle is in the sidebar
`2026-11-16` · hiro (user request) · scope: shared · confidence: high
The collapse/expand button moved from the top bar into the sidebar, as its last row
under Help & Support (a labelled row when expanded, an icon when collapsed). Beside the
brand it forced the college name onto two lines. Name, `aria-expanded`, and
`aria-controls` are unchanged (amends D-024).

### D-030 · First server-backed feature: ISMS data, read-only, at /isms-link
`2026-11-16` · hiro (ISMS integration, phase 1) · scope: shared, isms-link · confidence: medium
The school's student information system (ISMS) owns subjects, instructors, and class
schedules; the LMS reads them through the LMS API (`../server`, `VITE_LMS_API_URL`,
default `http://localhost:5200`) and never edits them. `/isms-link` is the first screen
that reads a server: a lazily loaded, standalone route (like `/ui-kit`), reached by URL
only, outside the Student, Instructor, and Admin navigation. Those flows still use
browser-local data and are unchanged for now, including "Create class"; no spec changed.
Server reads go through `shared/api/http.ts` (`getJson`, typed `ApiError`: network,
timeout, 502 ISMS sign-in, 503 ISMS down, other) and TanStack Query hooks in the feature.
Every server section has a skeleton, an empty state, and an error state with a retry that
says plainly when the API is not running. ISMS queries use `networkMode: "always"` so an
offline device gets an error instead of a paused skeleton (L-044).

### D-031 · Instructor classes come from ISMS; the LMS no longer creates them
`2026-11-16` · hiro (ISMS integration) · scope: instructor, isms-link, e2e · confidence: medium
The school decided subjects, instructors, schedules, and class lists are ISMS's, so
"Create class" is removed from the Instructor UI (sidebar, Classes page, Overview empty
state) and flow connector **K** changes: `instructor-flow` K, `class-view`, and
`instructor-new` were edited for this reason, and `instructor-isms` covers the new journey.
Until the LMS has its own database (phase 2), the Instructor screens still read the
browser role store, so `useIsmsClassSync` copies the current term's ISMS classes into it
through the pure, idempotent `mergeIsmsClasses`: records get an `isms-` id and
`source: "isms"`, demo and local records are never touched, a class ISMS drops is set
inactive with its content kept, and class lists are loaded only for the instructor being
viewed. Modules, coursework, announcements, and grades remain LMS-owned. Without the API
the workspace keeps working on what the browser already has and the Classes page says so.
Admin can still create demo subjects and classrooms (Admin is out of scope). `e2e/fixtures.ts`
refuses the LMS API origin by default so a developer's running API cannot change a journey;
specs that need ISMS data mock it. A class link now opens under the instructor who teaches it.

### D-032 · Student and Instructor read and write through the LMS API
`2026-11-17` · hiro (Phase 2, steps 5–6) · scope: student, instructor, shared/api, e2e · confidence: medium
Both workspaces now load one overview per person (`GET /api/me/overview`) and send every
change to the LMS API, which checks who may do what, validates, scores exams, and audits.
The screens kept their shapes: `features/instructor/api/store.ts` and
`features/student/api/catalog.ts` map the overview into the store and catalog the screens
already used. Browser storage is no longer a source for these roles (the progress key and the
browser-side ISMS copy of D-031 are gone); Admin keeps its browser-local demo data.
Until sign-in (Phase 4) the person is a **demo identity**, not authentication: the client sends
`X-Demo-User-Id`/`X-Demo-Role` (`shared/api/viewer.ts`), chosen with "Choose demo instructor"
(Overview) or "Choose demo student" (Today) and remembered for the tab; the API accepts it only
in Development and Demo mode. Journeys that changed, with their specs: P (Reset demo data is
gone; the profile names the viewed student and Today switches student, `shell`); multiple-choice
exams are graded on submit, so the review queue holds handed-in assignments and attempts with
essays (`instructor-more`, `instructor-new`); gradebook weights save only once they add up to 100
and show Saving…/Saved; review links and assessment/material URLs carry database ids; the exam
grade region is "Your grade" (D-015). Work with no due date reads "No due date" instead of an
invented date. The browser tests run against the API in Demo mode (`playwright.config.ts`): a
fictional seed exported from `data.js`, one database per test (`X-Demo-Sandbox`), Asia/Manila,
and the API clock pinned to the fixtures' date; `e2e/fixtures.ts` turns old demo keys into ids.
**Known regression:** a student can no longer take a quiz offline; the cached app opens and says
it needs a connection (`resilience`). Offline work returns with the persisted cache and outbox (D-020).
Admin now loads lazily like the other workspaces (L-047).

### D-033 · Submodules on screen: a Modules tab for both roles
`2026-11-17` · hiro (Phase 3a, PR A) · scope: student, instructor, shared, server · confidence: medium
Modules may have submodules, one level deep (the LMS API refuses deeper nesting). Both class
pages gain a **Modules** tab after Classwork: each module is a section (`h3`) with its content,
and its submodules are an ordered list of sections (`h4`) with theirs. The Instructor UI had no
module controls before, so the tab is where they live: **Add submodule**, **Rename**, and **Move
up/down** act on submodules; a **Move** button on each material, assignment, or assessment moves it
to another module or submodule (`PATCH` with `moduleId`; materials gained this, coursework had it).
Adding, renaming, or reordering top-level modules is not in this PR. The module pickers (Create
content, Materials filter, Move) list each module followed by its submodules as "Unit › Sub", and the
Materials filter on a module includes its submodules' materials. Ordering and labels come from
`shared/lib/moduleTree.ts` so both roles agree. Journeys added, none changed: instructor
connector MODULES and student node MODS, both in `submodules`; the new tab does not change any
existing spec.

### D-034 · Exams can reuse a question set; a locked set is changed by copying it
`2026-11-17` · hiro (Phase 3a, PR B) · scope: instructor, server, e2e · confidence: medium
(D-033 is taken by the submodules branch.) A question set (the API's questionnaire) belongs to
one instructor and one subject they teach, and can back exams in any of their classes for that
subject; the server refuses another instructor's set, a subject they do not teach, and a set for
another subject. The assessment form adds **Questions**: "Write new questions" (the previous
journey, now saving the set under the class's subject) or "Use an existing question set", which
hides Points because the exam is worth the set's points. Each exam keeps its own dates, attempts
("Attempts allowed", default 1, the server's previous default) and time limit. A new **Question
sets** page in the Instructor navigation lists each set's questions, points, the exams that use it,
and a Locked badge. Once a student has started any exam that uses a set it is read-only, because
recorded answers point at its questions; **Make a copy** (`POST /api/questionnaires/{id}/copy`)
makes an unlocked deep copy to edit instead. The editor sends the whole question list at once and
can add multiple-choice questions only; other types are edited in place. Existing specs are
unchanged; `question-sets` covers the new journeys.

### D-035 · Monthly attendance is recorded per class, not counted in grades
`2026-11-17` · hiro (Phase 3a) · scope: instructor, student, shared/api, server, e2e · confidence: medium
Attendance is monthly totals, not a daily roll call: for each class and month the instructor
enters the school days and each student's days present, and attendance % = days present ÷
school days × 100 (`shared/lib/attendance.ts`, one decimal). Both class views gain an
**Attendance** tab (new journeys AT and CL-AT, `e2e/attendance.spec.ts`; the existing tab
journeys are unchanged). The server owns the rules (`PUT /api/classes/{id}/attendance/{y}/{m}`):
school days 1 to the days in the month, days present 0 to the school days, students active on
the class list, the class's instructor only and only while ISMS offers the class; lowering the
school days below a saved entry is refused rather than clamped, naming the students. A save
upserts the whole month in one transaction with a metadata-only audit row; students left out
keep their days, and an entry cannot be deleted yet. Students receive only their own entries.
Attendance is **not** part of the gradebook; a later phase decides how it counts.

### D-036 · An activity closes only once every student is graded; a non-submitter can be graded
`2026-11-17` · hiro (Phase 3a, PR C) · scope: instructor, student, shared/api, server, e2e · confidence: medium
Closing is its own server action (`POST …/coursework/{id}/close`, `…/reopen`), not the plain update,
which can no longer set or leave `closed`. Close works on published work only and is refused (409)
with `ungraded: [{ studentId, name }]` until every student active on the class list is graded:
for an assignment their latest submission has a grade; for an exam at least one attempt is graded
(an attempt whose essays still wait is not). Closed work stays visible to students but refuses
hand-ins and starting, saving or submitting attempts; grades can still be corrected (audited as
before). Close and reopen write metadata-only audit rows. Coursework DTOs carry `gradedCount` and
`rosterCount` for instructors, shown as "N of M graded" on each Classwork row with **Close** /
**Reopen**; a refused close lists who is left. **Students who never handed in** can be graded:
the server creates a "not handed in" record (status graded, no text or file, `submittedAt` null,
`notHandedIn: true`) per student (`PUT …/students/{studentId}/grade`, which also corrects it) or for
everyone with no submission at all (`POST …/grade-missing`, one transaction, one audit row with the
count, never overwriting and never touching started or ungraded work). Screens say "Not handed in".
**Rule chosen for attempts:** a not-handed-in grade is allowed only when the student has no
submission or attempt at all, and once it exists the student can no longer hand in or start an
attempt for that coursework (409), so it never consumes or races a real attempt. Because it
locks the student out, it is refused (409) while the work is published and its due date has not
passed; work with no due date, or already closed, can be graded at any time. It counts in the
gradebook like any graded work (a 0 lowers the average). To let that student hand in, there is no
undo yet; the instructor corrects the grade instead. Journeys added, none changed: instructor
CLOSE and NHI, student CLOSED, all in `close-activities`.
### D-037 · UI revamp v2: no decoration, Admin joins the shared system
`2026-11-17` · hiro (user request) · scope: all · confidence: high
Supersedes D-001 (Admin out of scope) and amends D-005 (12px uppercase labels) and D-024.
The user asked for one simple, modern UI across every role with **no gradients, no
eyebrows, no pulse animations, no status dots, and no vertical side lines on cards**, without
breaking working code. Plan: [`../UI_REVAMP_V2_PLAN.md`](../UI_REVAMP_V2_PLAN.md); rules: C-019.
Also gone: uppercase letter-spaced labels, `backdrop-blur`, and shadows on flat cards (only
overlays cast one). Kept: `·` metadata separators, round number badges in quizzes and
results, avatars, count pills, and the functional button spinner. Admin is rebuilt in
`features/admin` on `AppShell` and `shared/ui` with its journeys unchanged; then the legacy
shell and CSS are deleted and preflight is turned on (closes D-003, D-010, D-022).
`npm run style:check` enforces the rules. Dark mode is out of scope.

### D-038 · Admin rebuilt on the shared system
`2026-11-17` · hiro (revamp v2, phase 3) · scope: admin, shared/layout, e2e · confidence: high
Admin now lives in `src/features/admin` on `AppShell` and `shared/ui`; the classic Admin screens,
`RoleWorkspace`, and their CSS are deleted. Its browser-local data modules moved unchanged to
`features/admin/data` (same keys and shapes, C-007). Journeys are unchanged and proven by
`e2e/admin-flow.spec.ts`, written against the classic Admin first. What changed:
- **URLs.** Every page has one (`/admin/users`, `/admin/courses?tab=classrooms`, …) and create
  forms open from `?create=1`, so the back button and links work. The users filter is `?type=`,
  never `?role=` (the role router reads that as a workspace switch, L-056).
- **Navigation.** One click to every page under plain section labels (`NavItem.group` in
  `AppShell`) instead of expanding categories; Settings moved from the sidebar footer to System.
- **Dialogs.** Create forms open in a dialog (a bottom sheet on phones). Deleting a subject and
  resetting the demo confirm in a dialog that names the item instead of `window.confirm`; the two
  spec steps changed only for that (D-013). Record names are buttons that open details, so the
  details are reachable by keyboard (they were clickable text before).
- **Dashboard.** Plain bars with the number on each bar replace the animated SVG charts and their
  fake 450 ms loading state; the sample preview stays and stays labelled. The illustrative
  female/male breakdown (sex is not stored) became real active/inactive student counts. Reset
  demo data lives only in Settings.
- **New checks.** Every Admin page passes axe, the 14px text check, and the 320px sweep.

### D-039 · No legacy UI left: preflight on, one stylesheet
`2026-11-17` · hiro (revamp v2, phase 4) · scope: styles, app/router · confidence: high
Closes D-003, D-010, and D-022, and supersedes C-005's manual resets. With Admin rebuilt
(D-038), `src/index.css`, `src/icons.jsx`, `src/components/`, and `src/roles/` are gone:
- `tailwind.css` imports all of Tailwind with **preflight on**, utilities are ordinary layered
  CSS (no `!important`), and the scan covers all of `src` except tests. The page defaults the
  old `index.css` held (canvas background, scrollbar gutter, focus ring, button cursor,
  selection color) moved into its `@layer base`.
- The role parser moved to `app/router/roleRouter.js`; the unknown-path page is
  `app/router/UnknownRolePage.tsx`, loaded lazily. Its button reads "Return to Student
  workspace" (sentence case), so `routing` matches that name case-insensitively (D-013).
- Poppins 700 is no longer shipped; the heaviest weight in use is 600.
- `npm run style:check` now covers all of `src`.
One 9.1 KB (gzip) stylesheet serves every role; the entry script is 76.6 KB (was 78.5).

### D-040 · Question types, sections, and assessment settings
`2026-11-17` · hiro (assessments) · scope: instructor, student, server, e2e · confidence: medium
Plan: `docs/QUESTION_TYPES_PLAN.md`; shapes: `docs/ASSESSMENTS_API_CONTRACT.md`.
- **New question types:** `identification` (any accepted answer is correct) and
  `modified_true_false` (an underlined phrase; False needs an accepted correction; all or
  nothing). The underline is drawn from its own field, so no HTML is ever stored.
- **Sections:** sets gain sections with directions and default points.
- **Incomplete sets:** a set can be saved with incomplete questions (`allowIncomplete`), but an
  exam using it can't be published until every question is complete.
- **New settings on each exam:**
  - `answerReview`: score only, which were right (the default, as before), or correct answers
    after the due date or right after submitting. The server leaves the keys out until then.
  - `spellingMode`: strict (the default, and every existing exam), small typos accepted but
    flagged, or near misses held for the instructor. A question can be marked always strict and
    case-sensitive.
  - Shuffle questions within each section, and shuffle choices.
- **The assessment builder page:** assessments get their own builder page (details, questions,
  settings, summary with Preview, Save draft, and Publish). It replaces the one-question form,
  so journey E changes, and its spec moves with it (D-013). The Question sets page uses the
  same editor.

### D-041 · Exams can be imported from Word, Excel, CSV, or pasted text; AI import waits
`2026-11-17` · hiro (assessments) · scope: instructor, server · confidence: medium
`POST /api/questionnaires/import` reads a `.docx`, `.xlsx`, `.csv`, or `.txt` file (≤ 5 MB) or
pasted text, using the format in the contract. It returns draft questions with the original
text and warnings (numbering gaps, points mismatches, a missing key). **Nothing is saved**, the
file is discarded, and the audit row holds only the file name, format, and count. Drafts open in
the builder's editor, and a person saves them. Macro-enabled files are refused, and size, zip
entries, and parse time are capped. The server adds `DocumentFormat.OpenXml` (Microsoft, MIT).
Reading any document with AI is **not built** until the school approves sending exam content to
an outside service.

### D-042 · A locked set's answer key can be fixed, and attempts are re-scored; attempts are anonymized after 2 terms
`2026-11-17` · hiro (assessments) · scope: instructor, student, server · confidence: medium
**Fixing the key: a narrow exception to D-034.**
- `PUT /api/questionnaires/{id}/answer-key` changes answer keys only, even on a locked set.
  Prompts, choices, types, points, and order stay as they are.
- Every submitted attempt of the exams using the set is re-scored, with one audit row.
- An attempt whose score changed records `scoreUpdatedAt`, and the student sees "Your score was
  updated".
- Changing an exam's spelling mode re-scores it the same way.

**Retention.** Attempts are anonymized 2 terms after their term ends (`Lms:Retention:AttemptTerms`,
to be confirmed by the registrar or data protection officer under RA 10173). Answer and essay
text is cleared; scores and grades stay.
