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

### D-033 · UI revamp v2: no decoration, Admin joins the shared system
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
