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

