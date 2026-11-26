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
A re-score (key fix, spelling-mode change, or spelling decision) recomputes auto-scored answers
from the key but **keeps the instructor's manual points** (including partial points on a
near miss), essay points, and spelling decisions; anonymized attempts are never re-scored.
Correct answers are shown only once the student can't start another attempt.

### D-043 · An exam's grading tools have their own page; quizzes autosave typed answers
`2026-11-17` · hiro (assessments) · scope: instructor, student · confidence: medium
- **The exam grading page:** `/instructor/classes/:classId/assessments/:examId/grading` holds one
  exam's Submissions, Spelling review, and Item analysis as `?view=` tabs. They aren't path
  tabs, because the shell refocuses the h1 when the path changes. Classwork rows open it with
  **Grading**; the class Submissions tab stays the class-wide queue.
- **Preview as student:** `…/assessments/:id/preview` renders the student quiz from shared
  components (`shared/components/quiz`). Nothing is saved.
- **Quiz autosave:** typed answers save after 1 s idle, on any question change, and on page
  hide, retrying with backoff. Only settled states ("Saved", "Not saved, retrying") are
  announced.
- **Timers:** each question's own time limit applies (60 s when none is set), and the quiz
  submits itself at the attempt deadline.
- **Validation status codes:** the API keeps its existing 400 validation response for every new
  rule; only import refusals are 422. The client treats both as field errors.

### D-044 · `/login` is the sign-in page; it is frontend only until accounts exist
`2026-11-18` · saheejuu2 (user request) · scope: auth, app/router · confidence: medium
`/login` (`src/features/auth`) replaces the sign-in page of the previous system
(trecemartirescitycollege.com) and keeps its contents: email and password, "Forgot password?",
the choice of user type, the college's goal and core values, and the "Connect with us" links.
It is drawn with the dashboard system: a flat sign-in card beside one filled tile, no
`AppShell` (there is nothing to navigate yet), like `UnknownRolePage`.
- **No request is sent.** The form checks only that the email and password are filled in, then
  opens "Choose a workspace" (the previous "Select user type"), which goes to `/student`,
  `/instructor`, or `/admin`. The page says so in an info note. The demo identity (D-032) is
  unchanged, and `/` still opens the Student workspace.
- **Password reset** validates the email and then says no email was sent. The previous page's
  reCAPTCHA is left out until a server can verify it.
- **College statements.** `features/auth/data/collegeProfile.ts` holds the name, goal, core
  values, and links. The full Vision, Mission, Objectives, and Philosophy were not copied from
  the old site; add the approved wording to `statements` and the tile shows its button.
- When sign-in is built, replace the submit handler and the workspace dialog's contents; keep
  the page's accessible names (`e2e/login.spec.ts`).

### D-045 · The sign-in page is a full-height split, still without decoration
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Refines the look and states of D-044. Asked for a frosted-glass card, gradient background, and
floating labels; kept to C-019 instead (Poppins, flat colors, 150 ms color changes only).
- **Layout.** From the `@4xl/page` width, the form column (white) sits beside a full-height
  `primary-800` college panel (`5fr`/`7fr` from `@7xl/page`); on phones the panel follows the
  form. The four TMCC value letters on `accent-400` carry the visual weight. "Connect with us"
  moved into the panel.
- **Fields** (`AuthInput`, `PasswordInput`, `FieldError`) wrap the shared `Field`/`Input`:
  leading icon, 48px height, error icon, a check when the email has been checked and passes,
  and a Caps Lock notice. Labels stay visible above the field; no floating labels.
- **Checking** (`useSignInForm`): a field is checked when left with text in it, or on submit,
  then rechecked as it is typed in.
- **Account service seam.** `LoginPage` takes `signIn` (default `api/demoAccount.ts`, which
  waits 450 ms and returns all three roles). One role opens that workspace directly; several
  open "Choose a workspace" listing only those. A rejected sign-in shows an alert. Replace
  `demoSignIn` and `demoRequestPasswordReset` when accounts exist.

### D-046 · The sign-in page shows the college's vision, mission, and goal as tabs
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Supersedes D-044's "College statements" bullet. The vision, mission, and goal are now in
`collegeProfile.statements`, in the college's wording, and the green panel shows them as tabs
(`CollegeStatements`, on the shared `Tabs`) above the core values; Vision is selected first.
Every tab panel stays mounted in one grid cell and inactive ones are `invisible`, so the panel's
height does not change with the tab. The "Vision, mission, and philosophy" dialog
(`CollegeProfileDialog`) is removed. Objectives and Philosophy are still not on the page.
The form stays on the left in the desktop split: DOM order is reading order (C-018), and the
form comes first on phones.

### D-047 · Core values first; the vision, mission, and goal open from a button
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Supersedes D-046's tabs: the statements were too long to show beside the sign-in form. The
green panel now has the college name and the core values (larger tiles) at the top, and a
"Vision, mission, and goal" button above the "Connect with us" links at the bottom. The button
opens `CollegeProfileDialog`, which lists every entry of `collegeProfile.statements` under its
own heading and icon. `CollegeStatements` (the tabs) is removed.

### D-048 · The college's full statements, word for word, in a tabbed dialog
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Supersedes D-047's dialog contents. `collegeProfile.statements` now holds the college's own
text for Vision, Mission (three paragraphs), Goal (with General and Specific Objectives),
Philosophy, and Core Values, in that order. Keep it word for word, including its headings'
capitalization; add nothing that the college did not supply. The panel button ("Vision, mission,
goal, and philosophy") opens a dialog with one tab per statement; the tab row stays in view while
a long tab scrolls. From `sm` the dialog hangs from near the top, so a taller tab grows it
downward; on phones it is a fixed-height bottom sheet. `CoreValueList` draws the values on the
panel and in the dialog from `collegeProfile.coreValues`, and its letters come from each name.

### D-049 · Sign-in split puts the college on the left; profile dialog; Remember me
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Supersedes D-045's column order and D-047/D-048's dialog layout; the flat green system (C-019)
and the college's exact wording (D-048) stay. From `@4xl/page` the college panel is the left
column (brand, name, goal, core values, then the "Institutional profile" button and icon links)
and the form sits in a white card on the canvas at the right. The DOM keeps the form first so
phones show it first; grid placement (`col-start`) swaps the columns on wide screens, an
exception to C-018 for this page. The submit button reads "Sign in to portal".
- **Institutional profile** is one scrolling dialog with every statement as a section and a
  pinned "Sections" row that scrolls to one and focuses its heading.
- **Remember me** keeps only the email, in `tmcc-remembered-email` (`useRememberedEmail`), and
  only after a successful sign-in; unticking it and signing in clears it.
- **Links** are icon buttons with names (Facebook, website). Add YouTube or a support email only
  with the college's real address.

### D-050 · Sign-in form back on the left, without a card; core values fill the panel
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Supersedes D-049's column order and form card. The form is the left column again, on the white
page with no card, under the brand; the college panel is on the right (`5fr`/`7fr` from
`@7xl/page`). DOM order equals visual order again, so the C-018 exception is gone. To close the
gap between the core values and the "Institutional profile" button, `CoreValueList fill` makes
the grid take the panel's spare height from the panel's `@md` width: equal rows, the letter at
the top of each tile and the name at the bottom. Phones keep compact rows.

### D-051 · The college panel's middle is a rotating billboard
`2026-11-18` · saheejuu2 (user request) · scope: auth, e2e · confidence: medium
Supersedes D-050's growing core value tiles. `ProfileBillboard` cycles Vision, Mission (all three
paragraphs), Goal (its name and the General Objectives), and Core Values, in the college's exact
wording; the Institutional profile dialog still has every statement in full. It follows the
WAI-ARIA carousel pattern: a slide stays up 4 s plus 150 ms a word (5–16 s); rotation pauses
while the pointer is over it or focus is inside; Pause stops it until Play; it starts stopped
under `prefers-reduced-motion`; slide buttons and arrows change slides at once; inactive slides
are `aria-hidden` and `inert`. From the billboard's `@md` width the slides share one grid cell (no
height change) and cross-fade with the 150 ms opacity change; narrower, only the current slide
is laid out, because sharing the mission's height left the short slides mostly empty on phones. Exception to C-019 for this component: the time-left bar animates its
width (a `transform` transition), because it shows a real timer. Glass, glow, and Framer Motion
were asked for and left out (C-019, D-045). `e2e/login.spec.ts` now opens the Core Values slide
before counting the values, since they are no longer always on screen.

### D-052 · No Pause button on the billboard; the college panel gets the larger share
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Supersedes D-051's Pause/Play button, removed at the college's request. Rotation still pauses
while the pointer is over the billboard or focus is inside it (tapping a slide button holds it
on touch screens), and never starts under `prefers-reduced-motion`; known gap against the
WAI-ARIA carousel pattern, which asks for a rotation control. The page split is now
`minmax(26rem,2fr)`/`3fr` from `@4xl/page` and `minmax(32rem,1fr)`/`2fr` from `@7xl/page`; the panel's
content is no longer capped at `max-w-2xl`, its padding is smaller, and the billboard's type steps
up with its width: the goal's name reaches `text-display` at `@3xl`, the vision stays `text-section`
and reaches `text-page` only from `@6xl` (asked twice to be smaller); the mission's
paragraphs and the objectives stay `text-body-lg` until `@5xl` (larger, the mission no longer fit a
900px-high screen). Each paragraph and list caps its own line length with `max-w-prose` (C-017).

### D-053 · The billboard also shows the Philosophy
`2026-11-18` · saheejuu2 (user request) · scope: auth · confidence: medium
Adds a Philosophy slide (both paragraphs, exact wording) between Goal and Core Values, so the
billboard's slide buttons read Vision · Mission · Goal · Philosophy · Core Values. Only the Specific
Objectives are now left to the Institutional profile dialog.

### D-054 · Assignment rules come from the server; late work can have a last day; grades can wait until returned
`2026-11-18` · hiro (assignments) · scope: instructor, student, server · confidence: medium
Plan: [`ASSIGNMENTS_PLAN.md`](../ASSIGNMENTS_PLAN.md); shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §1–§4.
- **One rule set:** `AssignmentRules.Evaluate` decides whether a student can turn work in and why
  not. `POST …/submissions` uses it, and students receive its verdict as `turnIn` on each
  assignment. The student page shows that verdict and no longer works out due dates, late work or
  resubmission itself.
- **New settings are columns** on `coursework`, like D-040's, and each arrives with the phase that
  uses it, so the API never accepts a setting it ignores (L-074).
- **`closeAt` ("accept until")** ends late work; a "not handed in" grade waits for it.
- **`gradeRelease`:** `immediate` (default, today's behavior) or `returned`. Held grades reach
  students only through `POST …/return`; `ToDtoAsync` is the one place that hides them.
- **Drafts are private:** an assignment row `in_progress` is the student's draft. Instructors never
  receive one, and grading progress and the close rule (D-036) count handed-in work only.

### D-055 · Assignment files: disk storage behind interfaces, scanned, served only through the API
`2026-11-18` · hiro (assignments) · scope: server, student, instructor · confidence: medium
Built in Phase 2 of [`ASSIGNMENTS_PLAN.md`](../ASSIGNMENTS_PLAN.md).
- `IFileStore` (disk; one folder per sandbox in Demo) and `IFileScanner` (ClamAV). Outside
  Development and Demo the API refuses to start without a scanner, like a missing connection string.
- Allowlist checked against the bytes: PDF, Word, PowerPoint, Excel, JPEG, PNG, TXT. Up to 5 files of
  25 MB. Macro files refused. Random storage keys; the original name is cleaned and kept as data.
- Files are downloaded only through `GET /api/files/{id}` with the workspace's headers and shown from
  a blob (L-075): `nosniff`, `Content-Disposition: attachment`, `Content-Security-Policy: sandbox`.
  Another person's file is a 404. No signed URLs until sign-in decides how browsers authenticate.
- Retention (D-042) deletes the files and keeps the grades.

### D-056 · The assessment builder shows one part at a time, as tabs
`2026-11-18` · hiro (assessments) · scope: instructor, e2e · confidence: medium
Supersedes the one long page of D-040's builder. **Details · Questions · Settings** are tabs, each
at its own URL (`?tab=details|questions|settings`, replace navigation and an optimistic tab, as
D-043 and L-028). A new assessment opens on Details and a draft on Questions; the first save keeps
the open tab. The Summary (Preview, Save draft, Publish, what needs attention) stays beside every
tab and adds the settings at a glance, so nothing depends on which tab is open.
- **No hidden problems:** tab labels carry tinted badges (fields to fix; the question count, with a
  warning icon when some need attention). Save, Publish, and server errors open the tab of the
  first problem and focus it; the Summary's question links open Questions.
- **Panels stay mounted** (hidden, L-076), so the editor keeps its state and `jumpTo` works.
- Phones: the tabs are three equal columns and a badge wraps under its label. Next buttons move on.
- **Journey change (D-013):** specs open the tab a field is on before using it
  (`assessment-builder`, `instructor-more` E, `question-sets` QS → E). The journeys are the same.


### D-057 · An illustration is allowed in an empty state where nothing exists yet
`2026-11-19` · hiro · scope: student, instructor, shared · confidence: medium
A narrow exception to C-016 and D-024, from [`WORKSPACE_ILLUSTRATIONS_PLAN.md`](../WORKSPACE_ILLUSTRATIONS_PLAN.md).
`EmptyState` takes an `illustration` from `src/shared/assets/illustrations` in place of its icon.
- **Where:** Student My classes with no enrollment (Open Book), Student class Materials with no
  materials (Reading), Instructor class Materials at "No materials yet" (Folder files).
- **Never:** a search or filter miss (those keep the plain line or the icon), a dashboard, Admin,
  an assessment being taken, loading, or an error. The Student dashboard's "not enrolled" tile
  keeps its icon. A new placement needs an entry here.
- **How:** unDraw SVGs with the accent already `primary-600`, loaded as image files (no hex in a
  component), `alt=""`, intrinsic `width` and `height`, 64px tall and 88px from `sm`. Messages,
  controls, and routes are unchanged. Spec: `e2e/empty-illustrations.spec.ts`.

### D-058 · Assignments Phase 2 and 3: the choices made before building
`2026-11-19` · hiro (assignments) · scope: instructor, student, server · confidence: medium
The owner accepted these on 2026-11-19. Plan: [`ASSIGNMENTS_PLAN.md`](../ASSIGNMENTS_PLAN.md); shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §5–§10.
- **The assignment builder uses tabs,** like the assessment builder (D-056), not the collapsing
  sections of the first plan: **Details · Hand-in · Dates and grading**, with the Summary beside
  every tab.
- **Modern Office files only** (`.docx`, `.pptx`, `.xlsx`). The old formats (`.doc`, `.xls`,
  `.ppt`) are refused with "save it as …": a macro inside them can't be ruled out reliably.
- **All of Phase 2's API ships first** (files, drafts, receipt, unsubmit, and the four hand-in
  settings), so the three screens are built against one fixed contract. The settings are enforced
  from that PR on, so the API still never accepts a setting it ignores (D-054).
- **The virus scan runs inside the upload request.** A file is stored only after it passes, so
  there is no "pending" file and no worker. If the scanner can't be reached the upload fails and
  the student tries again.
- **Taking work back keeps it:** the version becomes `withdrawn` (a submission status, not a new
  column) and a draft with the same content takes its place. Instructors never receive withdrawn
  versions. Work that has a grade can't be taken back, held or not; the refusal says only "This
  work can no longer be taken back."
- **A file belongs to versions through a link table,** so a new draft reuses the files of the
  version it was copied from. The bytes are deleted when the last link goes.
- **The submissions list is not paged or filtered on the server.** A class list is small; the
  grading page filters what `GET …/submissions` already returns.
- **Phase 3:** a late penalty is a percent of the *earned* score per calendar day late
  (Asia/Manila), up to a cap; excused work leaves the student's average; the comment bank belongs
  to the instructor, not the class.

### D-059 · Assignments are created in the assignment builder; drafts and edits after publishing
`2026-11-19` · hiro (assignments) · scope: instructor, e2e · confidence: medium
Built in PR 2B of [`ASSIGNMENTS_PLAN.md`](../ASSIGNMENTS_PLAN.md) on D-058's tabs; shapes: contract §1, §5.
- **Journey change (D-013):** "Create assignment" opens `…/assignments/new` instead of the inline
  form, which now holds materials only (the old `?create=activity` link redirects). The journey is the
  same: title, instructions, Publish, and the assignment is in Classwork. `instructor-flow` E and
  `student-new` press **Publish** instead of "Save and publish"; `assignment-builder` covers the rest.
- **Tabs:** Details (module, title, short description, instructions, points) · Hand-in (written
  answer, files, link; file types and 1–5 files only when Files is chosen; the own-work statement) ·
  Dates and grading (available from, due date, late work and "accept until", resubmission, when grades
  show). A choice that makes a field meaningless hides it or disables it with the reason: late work
  needs a due date, and "accept until" shows only with both (a hidden one is sent as `clearCloseAt`).
- **Summary:** the points, the rules as students read them (`handInRules`, the student page's own
  sentences), each field to fix as a link that opens its tab and focuses it, and Preview as student,
  Save draft, Publish. Preview saves first. Server field errors are mapped onto the fields the same way.
- **Presets** only fill the form and never touch the title, text, or module. A due date already
  chosen is kept; otherwise the preset's is set (11:59 PM), and the last day follows it.
  - Homework: 20 points; written answer and files; PDF, Word, photos; up to 3 files; own-work
    statement; due in 7 days; late work until 2 days after; resubmission; grades at once.
  - In-class activity: 10 points; written answer and files; PDF and photos (a photo of paper work);
    up to 2 files; no statement; due today; no late work; no resubmission; grades at once.
  - Project: 100 points; files and a link; every file type; up to 5 files; own-work statement; due
    in 14 days; late work until 3 days after; resubmission; grades when returned.
  - Copy a previous assignment: one of this class's assignments; its points, hand-in, late work,
    resubmission, and grade release. Not its title, text, module, or dates (nor its last day).
- **Editing after publishing** is allowed, unlike exams: the same builder with one **Save changes**
  (the status is not sent, so it stays published), and "N students have handed in; work already
  handed in is not checked again" when some have. A closed assignment is shown read-only with
  "Reopen it to change it". Classwork rows of assignments have **Edit**.
- **Drafts elsewhere** behave like draft assessments: "Draft" on Classwork, Create content (Edit
  draft), Modules ("Assignment · Draft") and the Stream cards; left out of the Stream's Upcoming, the
  Overview calendar, and Submissions' "Didn't hand in" (`publishedWork`).

### D-060 · Students hand in assignments with real files on a "Your work" card
`2026-11-19` · hiro (assignments, PR 2C) · scope: student, e2e · confidence: medium
Plan: [`ASSIGNMENTS_PLAN.md`](../ASSIGNMENTS_PLAN.md) "Students"; shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §2, §5–§8.
- **The journey "hand in an assignment" changed:** the student no longer types a file name and a
  comment and presses Submit work. The assignment page shows the instructions and the rules
  (`shared/components/assignment/AssignmentBrief`, the same sentences as the builder) and a
  **Your work** card: a written answer and a link that save themselves (the quiz autosave, D-043),
  files chosen or photographed and uploaded one at a time with progress, Cancel, Retry and Remove,
  then **Turn in**, confirmed in a dialog that lists exactly what is handed in (and asks "This is my
  own work" when the assignment does). A receipt (time, version, each file's code) stays on the page.
- **Take back** and **Turn in a new version** appear only when the server's `turnIn` allows them;
  earlier versions are listed. When `turnIn.canTurnIn` is false the card shows the reason and
  nothing editable. Opening the page creates nothing: the first save or upload starts the draft.
- **Uploading and turning in need a connection** (C-014): offline, the card says so and disables
  them; typing stays on screen and saves on reconnect.
- The client no longer sends `fileName`; `submitAssignment` is gone. Specs changed with it:
  `instructor-flow` step I and `student-new` "reaches the classic instructor queue" now upload a
  file and turn in; `e2e/assignment-work.spec.ts` covers the card.

### D-061 · An assignment's grading page; the Submissions tab shows files and links to it
`2026-11-19` · hiro (assignments, PR 2D) · scope: instructor, e2e · confidence: medium
Plan: [`ASSIGNMENTS_PLAN.md`](../ASSIGNMENTS_PLAN.md) "Instructor"; shapes: contract §3, §4, §6, §8.
- **The page:** `/instructor/classes/:classId/assignments/:id/grading`, opened from Classwork's
  **Grading** (like the exam's, D-043). One row per student on the class list, from
  `GET …/submissions` (`items` plus `missing`), showing their **latest** version. Filter chips
  with counts: All, Needs grading, Late, Missing, Graded, Returned. They overlap on purpose: late
  work can also need grading, and a "not handed in" grade is both Missing and Graded. Rows are
  ordered by last name. `?filter=&student=` hold the view, with an optimistic value (L-028).
- **One student's work:** the version and when it was turned in (a "Late" badge with text), the
  written answer, the link (opened only when `http(s)`, `noopener noreferrer`, the URL shown), and
  the files (`AttachedFile`, "Same file as another student" in its note). Earlier versions are
  listed and open read-only; the grade always goes on the latest.
- **File viewer:** photos, PDF and `.txt` are shown from a blob fetched with the instructor's
  headers (L-075, L-088); the first one that can be shown opens at once. Word, PowerPoint and
  Excel say "Download only".
- **Grading:** Save, and **Save and next** (the next student needing a grade after this one in
  list order, wrapping to the top; focus moves to their name). Server field errors land on their
  field. Students with nothing handed in: "Give a grade without work" and "Give 0 to everyone who
  didn't hand in" (the D-036 actions); before the last day the server's sentence shows instead.
- **Return** (only with `gradeRelease: "returned"`): the page says students don't see grades until
  returned; **Return to <name>** and **Return all graded** confirm in a dialog with the count, then
  toast how many the server returned. Held grades read "Graded, not returned" (lock icon) and
  returned ones "Returned" (send icon).
- **The class Submissions tab** keeps its queue and form; an assignment's review now shows its
  files (`AttachedFile`) and link, the typed file name only for work from before uploads, and
  **Open the grading page** (`?student=` set).
- **Journey change:** `seedHandedInAssignment` and the `close-activities` setup hand in a real
  file through the draft API, since a typed `fileName` is refused once 2C lands. Spec:
  `e2e/assignment-grading.spec.ts`.
- **Save and next stays in the chosen filter** (added after review): the next student needing a
  grade among those the filter shows, and only when none is left there, the next in the class
  (`nextToGradeIn`). After Return, or after everyone missing is graded, focus goes to the
  student's work, because the button that opened the dialog is gone (L-015).

### D-062 · Assignments Phase 3: penalties are worked out, not stored; exceptions are per student
`2026-11-19` · hiro (assignments) · scope: server, instructor, student · confidence: medium
Shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §10–§13. Builds on D-058.
- **A late penalty is computed whenever a grade is read,** from the assignment's settings, the
  student's own due date, and when the work was turned in. The grade row keeps the instructor's
  raw points and one flag, `penalty_waived`. Nothing has to be recomputed when a due date or the
  penalty changes, and `late` and the penalty can never disagree. The cost: changing the settings
  changes grades already returned, as changing the points always has.
- **Days late are calendar days in the school's time zone** (`Lms:TimeZone`, Asia/Manila), at
  least 1 for any late work, so "10% per day" means what a student expects.
- **One `coursework_exceptions` row per student and assignment** holds their own due date, their
  own last day, and "excused". `AssignmentRules.Evaluate` takes it, so the turn-in verdict, the
  draft routes, taking work back, `late`, the penalty and "not handed in" grades all agree.
- **Excused means out of the count:** not in the gradebook average, the graded progress, or the
  close rule, whether or not work was graded.
- **A rubric locks once a grade uses it,** like a question set (D-034): copy it to change it. An
  assignment with a rubric is worth the rubric's total, as an exam is worth its questions.
- **The zip is built as it is sent** and capped at 250 MB, because the browser has to hold it in
  memory to save it (L-075).

### D-063 · Late penalty and rubric in the assignment builder; a class's rubrics pages
`2026-11-19` · hiro (assignments, PR 3B) · scope: instructor, e2e · confidence: medium
Shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §10, §12. Builds on D-059 and D-062.
- **Late penalty** (Dates and grading, under late work): "Take points off late work", then
  **Percent per day** (whole, 1–100) and **Up to** (whole, 1–100, default 100). It is available only
  with a due date and "Accept late work"; otherwise the box is disabled and its hint says which is
  missing. A stored 0 per day shows as off (10% is ready when it is turned on). When late work or
  the due date is off, or the box is unchecked, the body sends `latePenaltyPercentPerDay: 0` and
  leaves the cap alone. The Summary's "What students will read" gets the sentence from `handInRules`.
- **Rubric** (Dates and grading, in the **Grading** group, renamed from "Grades"): "Grade with a
  rubric" is a native select of the class's rubrics ("Lab report · 15 points") or "No rubric", with
  the chosen one shown read-only by `RubricView` and a **Manage rubrics** button (through the
  unsaved-changes guard). With a rubric, Details' Points is read-only, shows the rubric's total, and
  says "This assignment is worth its rubric's total"; the body sends `rubricId` and no `maxPoints`.
  An update without one sends `clearRubric: true`. The server's refusal once work is graded (400 on
  `rubricId`) lands on the select, whose tab opens and which takes focus. The client does not
  pre-disable the select for graded work: the server's sentence is the one place that rule lives.
- **Presets leave the penalty and the rubric alone**: a preset is about how work is handed in, and
  a rubric belongs to a class. **Copy a previous assignment copies both** (same class, so the
  rubric is valid; they are grading settings, like late work and grade release).
- **Rubrics page** `…/rubrics`: cards with the title, "15 points · 2 criteria · used by 1
  assignment", a warning **Locked** badge with a sentence, and Open, Copy, Delete. Delete confirms in
  a dialog that names the rubric; the server's 409 sentence shows in the dialog (and a toast) and
  the dialog stays. After a delete, focus goes to the page heading. Reached from Create content
  ("Manage rubrics") and from the builder.
- **Rubric editor** `…/rubrics/new`, `…/rubrics/:id`: title; 1–12 criteria (move up/down and remove
  with buttons; focus follows the moved card), each with a title, optional description and 2–6
  levels (title, points, optional description). A new rubric starts with one criterion of
  Complete 10 / Partial 5 / Missing 0. The running total and Save sit in an aside (sticky beside
  the form at `@4xl`, a bottom bar on phones) so a toast never covers Save (L-092). Errors use the
  server's paths (`criteria[1].levels[0].points`) on the client too, so local and server errors
  land on the same inputs (`data-focus="rubric:<path>"`) and the first takes focus. A **locked**
  rubric shows its criteria with `RubricView` and "This rubric has been used to grade. Copy it to
  change its criteria.", lets the title change (only the title is sent), and offers **Copy
  rubric**, which opens the copy. Leaving with unsaved changes asks first.
- Code: `api/rubrics.ts` (calls, keys, form model, checks, error mapping, totals; tested),
  `pages/RubricsPage.tsx`, `pages/RubricPage.tsx`, `pages/rubrics/`. Specs: `assignment-builder`
  (four tests added, no journey changed), `rubrics`.

### D-064 · Phase 3 on the assignment grading page: penalties, rubrics, own dates, excused, saved comments, batch return, the zip
`2026-11-20` · hiro (assignments, PR 3D) · scope: instructor, e2e · confidence: medium
Builds on D-061 and D-062; shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §10–§13.
- **Late penalty:** the Score field edits the **raw** points (`rawScore`); the list, the status and
  the toast show `score`, the score after the penalty. Late work says how many days late, and on an
  assignment with a penalty the grade form shows the rule and the sum ("18 − 20% (2 days late) =
  14.4 of 20"), worked out as the server does only to preview what is typed. "Waive the late
  penalty for this student" sends `waivePenalty`, and only for late work with a penalty.
- **Rubric:** with `rubricId` the Score field is replaced by `RubricView` in choosing mode, filled
  from `rubricScores`. Save is refused on the page until every criterion has a level ("Choose a
  level for …", focus on the first one left); the server's `rubric[<id>]` errors land on their
  criterion. A "not handed in" grade still takes plain points. The class Submissions tab can't
  grade by rubric, so it says so and links here.
- **Own dates and excused:** on a student's work, "Give this student more time" (own due date,
  and own last day only when the assignment has one), "Remove their own dates", and "Excuse from
  this assignment" / "No longer excused", each confirmed; afterwards focus goes to the student's
  name (L-015). The list shows "Own due date: …" and an **Excused** badge, and there is an
  **Excused** filter. Excused students are never in Needs grading or Missing, are never "next to
  grade", and have no grade form (the page says why). A "not handed in" grade waits for the
  student's own last day; "Give 0 to everyone" says how many were skipped for it (`waiting`).
- **Saved comments** (the instructor's, for every class) sit under the feedback: a dialog lists
  them with Add to feedback (appended on its own line; focus returns to the feedback), Edit and
  Delete (asked inside the dialog); "Save this feedback as a comment" saves what is written. The
  500-character limit is checked first; the 200-comment refusal is the server's sentence.
- **Return selected (N):** with `gradeRelease: "returned"`, graded rows not yet returned have a
  checkbox; the button confirms with the count, beside the single Return and Return all graded.
- **Download all work (.zip)** fetches with the instructor's headers (L-075) and saves the blob;
  busy while it downloads, the server's 409 sentence over 250 MB, disabled with the reason when
  nobody has handed in.
- **A refusal shows the server's own sentence** (`writeResult`: a 403, 404 or 409 `title`; a lone
  400 field error). Spec: `e2e/assignment-grading-more.spec.ts`.

### D-065 · The student's assignment page shows their own due date, excused work, the late-penalty sum, and the rubric
`2026-11-19` · hiro (assignments, PR 3C) · scope: student, shared, e2e · confidence: medium
Shapes: [`ASSIGNMENTS_API_CONTRACT.md`](../ASSIGNMENTS_API_CONTRACT.md) §10–§12. Builds on D-060, D-062.
- **Own dates replace the class's for that student, everywhere.** `toStudentCatalog` sets
  `Assessment.dueAt` to `turnIn.dueAt` when `turnIn.extended` (`studentDueAt`), keeps the class's
  as `classDueAt`, and gives `handIn` the student's due date and last day (`ownHandIn`). Tasks,
  Today and Calendar read `dueAt`, so they follow without changes. The rules say "Your due date:
  … (your instructor gave you more time)" instead of "Due …" (`AssignmentBrief` `ownDueDate`),
  and the details card's label becomes "Your due date".
- **Excused is out of every to-do.** `needsWork` (selectors) is the one rule for "still to do":
  not handed in and not excused. Due soon, Due this week, Missing, the Today panels and the
  Calendar's "Past due" use it; excused rows show an **Excused** badge with text. The work card
  says the server's sentence, has no editor and no Turn in, and keeps work already handed in
  read-only.
- **The late penalty is a sum in words and numbers** under **Your grade**: points given, the
  percent and days late, the score after it, and one sentence ("… so 20% came off: 18 − 3.6 =
  14.4."); "Late penalty waived" when waived. The turn-in dialog says what turning in now loses
  ("Turning in now is 2 days late: 20% comes off the score."). Days are counted in the browser
  exactly as contract §10 defines them (calendar days in Asia/Manila, at least 1; `daysLate` in
  `api/work.ts`); the browser's clock can differ from the server's by minutes, so near midnight
  in Manila the number shown before turning in can be one off from the one the grade uses.
- **The rubric is read once per page** (`useAssignmentRubric`, TanStack Query, 404 is "none"):
  read-only in the brief (`AssignmentBrief` optional `rubric`, so the instructor's preview can
  show it too), and with the chosen levels on a visible grade, where the brief leaves it out so
  it is not shown twice. A held grade shows neither the sum nor the levels (the server hides them).
- Spec: `e2e/assignment-work-more.spec.ts`. No existing journey changed.

### D-066 · One dashboard layout for every role
`2026-11-24` · hiro (user request, approved draft) · scope: student, instructor, admin, shared · confidence: high
Amends D-023, D-026, D-027, and D-038. Asked for "a modern, clean dashboard for each user, with
unified components and typography, keeping the theme and palette". The three dashboards had three
heading patterns, two metric-card components, three panel-link styles, three date treatments, and
hand-built list rows. Every dashboard is now the same three layers, built from shared pieces:
- **Heading (`DashboardHeader`):** the date and term line, then the h1, a greeting on every role
  ("Good morning, Alex / Angela / Taylor"), with page-level controls on the right (the demo person
  picker; the Instructor's Overview/News switch; Admin's term and date-range filters, which moved up
  from the analytics section). No fill, no border. The Instructor's 40px "Your teaching day" plus a
  second greeting, and Admin's "Academic overview", are gone.
- **Focus row:** the one filled tile (`FocusTile`, D-027) holds the next thing to do: Student
  **Next due** (the assessment with an Open button; the Tasks panel then lists what comes after it,
  so each assessment has one control, C-015), Instructor **Review queue** (count, next submission,
  "Review student work"), Admin **Quick actions** (the four create actions as tiles). Beside it,
  `SummaryStrip` replaces `StatCard` and Admin's `MetricCard`: one bordered strip, cells split by 1px
  rules, icon · number · label · one fact; three in a row, four as 2×2. Cells that open something keep
  their old accessible names ("5 Due this week", "Total students: 12. View students").
- **Panels:** `Panel` with one `PanelLink` ("View all →") each; lists use `ListRow` (lead · title +
  meta · trail) with `IconTile`, `InitialsAvatar`, or `DateTile` (the one date treatment). Switches
  between views use `SegmentedControl` (`shared/ui`; `ViewToggle` is now a wrapper). Admin's recent
  activity became `ListRow`s in a panel (a dashboard summary; Audit logs keeps the table).
- **Removed:** the Student's one-time "Welcome to the new design" message (cutover was 2026-11-17).
- **Specs changed** for the headings only: "Your teaching day" → `/Good morning, Angela/`, Admin's
  "Academic overview" → `/Good morning, Taylor/`, and the welcome-message test was deleted. No journey
  changed. Draft and before/after images were approved before the build.

### D-067 · Class materials carry a real file that students and instructors preview in the LMS
`2026-11-25` · hiro (user request, approved plan) · scope: student, instructor, shared, server · confidence: high
Asked for "a preview of the uploaded materials" and a more detailed, better organized student view.
Materials kept only a file's name and size; nothing was uploaded. Plan: `docs/MATERIALS_PLAN.md`.
- **A material is a learning guide**, a file students come back to (like a Google Classroom
  material), not a task. On the user's call there is no read time and no "Mark as reviewed". The
  `student-flow` journey "open a material from Stream, mark it reviewed, go back" becomes "open a
  material from Stream, see its file, go back" (Phase 3).
- **Files** are stored like turn-ins (D-055): type from the bytes, virus scan, 25 MB, cleaned
  names. One file per material, in PDF, DOCX, PPTX, XLSX, JPG, PNG, or TXT. A material and its file
  are saved in one request. Only the material's own routes serve the file: to its instructor always,
  and to an enrolled student while the material is active. Files are served as downloads (`nosniff`,
  `sandbox`). The page fetches the bytes with the viewer's headers (L-075) and draws them itself.
- **Previews:** a PDF opens in the browser's own viewer on a computer (`navigator.pdfViewerEnabled`
  and a fine pointer, L-102), and otherwise in pdf.js, loaded only then. That is a recorded budget exception, kept out of the install
  cache. Images and text are drawn by the page. Word, PowerPoint, and Excel files are turned into a
  PDF once by LibreOffice during the upload, after the scan (`ready`, `failed`, or `off` without
  LibreOffice). It doesn't run in a background worker because Demo mode picks each sandbox's
  database and files from the request. A file without a preview
  shows a download card. A preview loads by itself up to 5 MB; bigger files, or data saver on, wait
  for a tap that shows the size.
- **Student view:** the Materials tab is grouped by module, then submodule, with type, file type,
  size, and date, plus search, a type filter, and a sort. The material page shows the preview,
  details, Download, and previous and next materials. The repeated "Learning goal" and the always
  empty "Key ideas" are gone.

### D-069 · A summary cell's accessible name starts with the words it shows
`2026-11-25` · hiro (found while adding D-067) · scope: shared, admin, student · confidence: high
Amends D-066, which kept the Admin totals' old names ("Total students: 12. View students"). The
cell shows "12 Total students", so speech-control users who say what they see did not match the
name (WCAG 2.5.3, Label in Name). The names are now "12 Total students. View students" and the same
for faculty, courses, and users. The Student "Due this week" cell's phone label is "Due" instead of
"Due soon", a word of its full label. `admin-flow`'s OVERVIEW spec selects `/^\d+ Total Students/`;
no journey changed. Found when jsdom gained a canvas (L-105). D-068 is held by the offline plan.

### D-070 · Class meetings: live video in the LMS on our own LiveKit server
`2026-11-26` · hiro (user request, approved plan) · scope: student, instructor, shared, server · confidence: high
The user asked for a separate video-meeting page like Google Meet, used inside the LMS, with no
time limit and real-time delay, plus screen share and chat. Plan: `docs/MEETINGS_PLAN.md`.
- **Media:** a self-hosted LiveKit SFU (`meet-server/`). No vendor and no code sets a time limit.
  Simulcast, adaptive streams, and a Data saver mode serve weak phones. The meeting page is a
  lazy, full-screen route, `/meet/{meetingId}`, outside `AppShell`. `livekit-client` (about 140
  KB gzipped) is a recorded budget exception there only, like pdf.js (D-067).
- **Who:** only the class's instructor starts a meeting. Only that instructor and students on
  the class list can join, and there are no guest links. The LMS API checks this and issues a
  10-minute join pass. Host actions go through the LMS API.
- **Mic:** students join with the mic off by default. The instructor's meeting settings decide
  whether students may turn on their mic and camera, share their screen, and chat, and the media
  server enforces them. The instructor can mute, let speak, and ask to unmute. Nobody can switch
  on someone else's mic (`enable_remote_unmute: false`).
- **Chat** goes through the LMS API. It is saved only while the instructor's "Save the chat" is
  on, and everyone sees that it is on.
- **Recording** isn't in v1. It is designed now and built in Phase 4. It is optional and only the
  instructor controls it. It records the whole meeting until the instructor pauses or stops it, or
  the meeting ends, and a meeting can be set to record from its start. Paused stretches are never
  captured, and the stretches become one video per meeting. Everyone sees a notice and a REC sign.
- **Attendance** from the media server's webhooks is a report for the instructor. It doesn't
  change monthly attendance (D-035).
- **Phase 1 (API, 2026-11-26).** The endpoints are in "Class meetings" in `server/README.md`.
  - A student with no source to publish gets `canPublish: false`, never an empty source list,
    which LiveKit reads as "everything".
  - The page trusts `lms.chat` and `lms.ask-unmute` only as server messages, with no sender.
  - A locked meeting still lets back in anyone who was in it before. A removed student can't
    rejoin that meeting.
  - "Let speak" lasts until the student leaves.
  - Ending works even when the media server can't be reached.
  - One class has one live meeting at a time.
  - The entity is `OnlineMeeting`, because `Classes.ClassMeeting` is an ISMS timetable slot.
  - Join passes and webhook checks use the real clock, which LiveKit checks them by. Webhook
    times are moved onto the API's clock, so Demo mode's shifted clock still lines up.
- **Phase 2a (the page, 2026-11-26).**
  - **The meeting page opens in the same tab, not a new one.** The demo identity is kept in
    `sessionStorage`, which a new tab doesn't inherit (checked in Chromium and WebKit), so a new
    tab would join as the wrong person. Leave goes back to the class's Meetings tab. With real
    sign-in a new tab would work.
  - **Routes:** `/instructor/meet/{classId}/{id}` and `/student/meet/{classId}/{id}`. Each role
    app renders them full screen, outside `AppShell`: an exception to C-010. The page focuses its
    own h1 and has one control per action: Back to class before joining, Leave in the controls,
    and its own way back after.
  - **Entry points:** the instructor's **Start meeting** sits in the class header and is hidden
    while a meeting is on. A **Live now** banner above both roles' tabs holds the one Join. The
    **Meetings** tab lists upcoming and past meetings. The student class page's Discord link is
    gone.
  - **Budget:** `MeetingRoomPage-*` (about 145 KB gzipped, mostly LiveKit's client) has its own
    175 KB limit, leaving room for 2b and 2c. It is kept out of the install cache, like pdf.js.
  - **Mic and camera:** a control the person may not use is `aria-disabled`, not `disabled`, so
    pressing it says why. Students start with the mic off unless the meeting says otherwise. The
    tracks made on the pre-join screen are the ones published.
- **Phase 2b (in the meeting, 2026-11-26).**
  - **Chat** arrives only as data messages from the server (topic `lms.chat`, no sender). A
    person's own message on that topic is ignored. Sending goes through the API. Saved chat
    loads on joining as history, not unread, and the Chat button counts unread messages.
  - **Raised hands** are the `lms.hand` attribute, set by `POST …/hand`. Late joiners see them,
    the order uses the API's clock, and rights are untouched. Hands come first in People, in the
    order they went up.
  - **Reactions** are the person's own data messages (`lms.reaction`). Only the six on the list
    are shown, on the sender's tile for 4 s, with no animation (C-019), and announced once.
  - **The stage:** a shared screen fills it, with everyone in a strip. Otherwise the pinned
    person, or the last speaker in Speaker view, fills it; otherwise everyone is in a grid.
    Share screen shows only where the browser can (not Android or iOS).
  - **Data saver** stops receiving other people's cameras (`setSubscribed(false)`) and keeps
    their sound and shared screens. It is suggested when the connection is 2G or data saver is
    on.
  - **Panels:** Chat and People are a column at 64 rem and wider, and a sheet below that (C-010).
    The meeting page's messages are a line above the stage, not toasts, which on phones cover
    the controls.
  - **Pre-join:** Join waits while a camera or mic is starting. A device that finishes starting
    after the screen has gone is stopped, so the camera light doesn't stay on.
- Safe for demos only until real sign-in exists, like the rest of the LMS.

