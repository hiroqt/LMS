# Learnings

Discoveries made while building. Newest last. Promote recurring ones to
[`CONVENTIONS.md`](CONVENTIONS.md); delete ones that no longer explain the code.

### L-001 · Poppins was never loaded before the revamp
`2026-11-16` · hiro · scope: styles · confidence: high
`index.css` named Poppins first, but nothing loaded the font, so macOS showed Avenir Next,
Windows Segoe UI, and Android Roboto. Fixed by D-006. `e2e/platform.spec.ts` now checks it
on desktop Chromium, iPhone WebKit, and Pixel Chromium.

### L-002 · Student News & announcements crashed on main
`2026-11-16` · hiro · scope: student/today · confidence: high
Today → News rendered `<Stream>` without `announcements`, and `announcements.length`
threw, blanking the dashboard. The parity suite found it on its first run. Fixed with a
`[]` default in the Phase 0 PR. Lesson: every flow-chart node deserves a spec, including
"read-only" views.

### L-003 · Known gap: exam feedback has no Student entry point
`2026-11-16` · hiro · scope: student/assessment · confidence: high
Instructor feedback for an **exam** appears only on the result screen, which is reachable
only right after submitting. When an instructor grades later, the Student assessment
detail offers "Practice again" but no way to see the grade or feedback. Assignments do
show grade and feedback on the detail page. `INSTRUCTOR_USER_FLOW.md` connector J implies
both work. Not fixed in Phase 0 (it changes the flow). The round-trip spec uses an
assignment. **Resolved in the rebuilt UI by D-015**; the classic UI keeps the gap.

### L-004 · Tailwind's automatic scan generates utilities from legacy prose
`2026-11-16` · hiro · scope: styles · confidence: high
With default scanning, the build emitted `hidden`, `collapse`, `fixed`, `table`, `border`,
and more from ordinary words in legacy JSX and data. Any legacy element with such a class
name would have been restyled. Hence the `@source` restriction (D-003). Even a comment
counts: the word "ring" in a test file generated `.ring`, so test files are excluded too.

### L-005 · `document.fonts.check()` returns true when no font is registered
`2026-11-16` · hiro · scope: tests · confidence: high
The first font test passed even with the Poppins import removed, because `check()` only
reports whether matching faces still need loading. The test now looks for a FontFace with
family `Poppins` and status `loaded`, and was confirmed to fail without the import.
Promoted to C-006 ("a test must be able to fail").

### L-006 · The brand green is not a text color on the canvas
`2026-11-16` · hiro · scope: styles · confidence: high
`#32806d` on `#f7f9f8` is 4.47:1, just under AA. It is fine as a fill (white text on it is
4.73:1). The token test caught this; green text uses `primary-700`. Promoted to D-005 and
C-003.

### L-007 · Accessibility baseline before the revamp
`2026-11-16` · hiro · scope: a11y · confidence: high
axe (WCAG 2.2 AA) on desktop Chromium: Student Today has 54 nodes with serious
`color-contrast` violations, Instructor Overview 39. Admin pages have no `h1`. These are
the numbers Phases 2 and 3 must drive to zero (`e2e/a11y-baseline.spec.ts`).

### L-008 · The demo data lives in October 2026 and the app reads the real clock
`2026-11-16` · hiro · scope: tests · confidence: high
Seed due dates are around Oct 22 – Nov 6, 2026, and Student/Instructor compute "due soon"
or "missing" from `Date.now()`. On the real date most work is already missing. E2E specs
pin the clock to `2026-10-23T09:00` with `page.clock.install`, which also lets them
fast-forward the per-question 60s quiz timer (`clock.runFor`).

### L-009 · Tooling versions are newer than many references
`2026-11-16` · hiro · scope: tooling · confidence: medium
React Router resolved to **v8** (declarative `BrowserRouter`/`Routes`/`useNavigate` are
unchanged from v7) and TypeScript to **v7**. Check the installed package's types or
CHANGELOG rather than older blog posts.

### L-010 · oxlint reads Playwright's fixture `use` as a React hook
`2026-11-16` · hiro · scope: tests · confidence: high
`react-hooks/rules-of-hooks` flags `await use(page)` inside `test.extend`. Name the
fixture callback `run` instead (see `e2e/fixtures.ts`).

### L-011 · The quiz timer is interval-based
`2026-11-16` · hiro · scope: student/quiz · confidence: high
`App.jsx` decrements per-question timers with `setInterval(…, 1000)`. Throttled
background tabs and sleeping phones slow it down or pause it. The rebuilt quiz should
derive time left from an absolute deadline timestamp (plan §6) and keep the spec
"Q1 → Q2 auto-advance" passing.

### L-012 · A navigation spec can pass without navigating
`2026-11-16` · hiro · scope: tests · confidence: high
Found in the Phase 0 self-review: "C → CAL" asserted a heading matching `/calendar/i`, but
the Today dashboard already has an h2 "Academic calendar", so the spec passed with the
button disabled. It now asserts the destination's h1, checks that the h1 is absent before
the click, and browses a month. This is the second vacuous test in Phase 0 (see L-005).
Promoted to C-006.

### L-013 · Importing the shared/ui barrel from eager code bloats the classic bundle
`2026-11-16` · hiro · scope: performance · confidence: high
`AppRouter` imported `Skeleton` from `shared/ui`, which pulled Radix into the bundle every
classic user downloads: 139 → 195 KB gzipped. A direct import still pulled
`tailwind-merge` through `cn()` (+11 KB). The router's loading fallback is now plain markup
(+1.6 KB over Phase 0). Promoted to C-009.

### L-014 · StrictMode breaks "skip the first render" focus logic
`2026-11-16` · hiro · scope: shared/layout · confidence: high
The shell skipped focusing the h1 on first render with a `firstRender` ref. StrictMode runs
mount effects twice, so the second run moved focus to the h1 on page load and the skip
link was no longer the first Tab stop. Compare against the previous `pageKey` instead
(idempotent). The skip-link spec caught it.

### L-015 · Radix Dialog restores focus to its trigger after closing
`2026-11-16` · hiro · scope: shared/layout · confidence: high
Choosing a page in the phone drawer moved focus to the new h1, and then Radix put it back
on "Open menu". `onCloseAutoFocus` with `preventDefault()` keeps focus on the h1 when the
drawer closed because of navigation. Apply the same pattern to any dialog that navigates.

### L-016 · Legacy element CSS outranks Tailwind utilities
`2026-11-16` · hiro · scope: styles · confidence: high
`button, input { font: inherit }` and `button { min-height: 24px }` in `index.css` are
unlayered, so they beat layered utilities. New buttons rendered at 24px with inherited
text size. Fixed by D-010. `new-shell.spec.ts` checks computed heights so it cannot regress.

### L-017 · A CSS-hidden Radix dialog can stay open and lock the page
`2026-11-16` · hiro · scope: shared/layout · confidence: high
Found in the Phase 1 review: with the phone drawer open, widening the viewport past `lg`
hid the drawer with CSS, but Radix still considered it open, so the page kept
`pointer-events: none` and trapped focus in an invisible dialog. Derive `open` from the
breakpoint (`drawerOpen && !isDesktop`) rather than hiding with CSS alone. Any overlay
that exists only at some breakpoints needs the same treatment. Spec: "an open drawer
closes when the viewport grows to desktop".

### L-018 · Classic Instructor crashed publishing work without instructions
`2026-11-16` · hiro · scope: instructor (classic) · confidence: high
`openCreate` did not default `instructions` or `prompt`, and saving called `.trim()` on
`undefined`, so an assignment or assessment without instructions never saved. Found by a
Phase 2 cross-role spec; fixed by adding the two defaults in `Instructor.jsx`. Phase 3
should cover optional fields in its form specs.

### L-019 · Single-column CSS grids overflow at 320px
`2026-11-16` · hiro · scope: layout · confidence: high
`grid lg:grid-cols-[…]` has an implicit `auto` column below `lg`, which grows to its
content's min-content width (the month table: 313px on a 288px screen). Use
`grid-cols-1` (`minmax(0,1fr)`). Promoted to C-011. The 320px sweep in
`student-new.spec.ts` catches it.

### L-020 · Buttons do not wrap or shrink by default
`2026-11-16` · hiro · scope: shared/ui · confidence: high
The button base is `shrink-0 whitespace-nowrap`, so "Open Introduction to Programming"
pushed a 320px page sideways. Long-label buttons need `max-w-full shrink whitespace-normal`.
Promoted to C-011.

### L-021 · Adjacent elements join without a space in accessible names
`2026-11-16` · hiro · scope: a11y · confidence: high
`<span>Class</span><strong>Computer Networking</strong>` is announced as
"ClassComputer Networking". Put a `{" "}` between parts. The parity spec caught it.

### L-022 · position: sticky only works inside a tall parent
`2026-11-16` · hiro · scope: layout · confidence: high
The quiz timer was sticky inside its short header, so it scrolled away on phones. Sticky
elements must be children of the container that spans the scrolling content. Found by
looking at screenshots, not by tests.

### L-023 · Small details that changed roles or contrast
`2026-11-16` · hiro · scope: a11y · confidence: high
`type="search"` exposes the `searchbox` role (classic used `textbox`); use
`type="text" inputMode="search"` where the role matters. White-on-brand chips with
`bg-white/20` failed contrast; use `primary-800`. A toggle whose label changes ("Mark as
reviewed" → "Reviewed") must not also set `aria-pressed`.

### L-024 · Report success only after storage succeeds
`2026-11-16` · hiro · scope: student/api · confidence: high
Found in the Phase 2 review: `submitActivity` marked an assignment completed even when
`saveRoleData` failed (storage full or blocked), so the student saw "Submitted" for work
that was never stored. Completion is now recorded only after a successful save, and the
form shows an error toast otherwise. The Phase 4 outbox must keep this rule.

### L-025 · Classic gradebook showed NaN% for graded assignments
`2026-11-17` · hiro · scope: instructor (classic) · confidence: high
The classic average divided by `submission.maxScore`, which submissions do not have. The
rebuilt selector uses the activity's `maxScore`, pinned by a unit test. Classic is left as
is because it is replaced at cutover.

### L-026 · Radix tab values become element ids
`2026-11-17` · hiro · scope: shared/ui · confidence: high
The value "Create content" produced ids with a space, so `aria-controls` was an invalid
IDREF list (axe: critical). Use slug values and map labels and URLs to them. Promoted to C-013.

### L-027 · Horizontally scrollable regions must be focusable
`2026-11-17` · hiro · scope: a11y · confidence: high
The gradebook table wrapper (`overflow-x-auto`) could not be scrolled by keyboard (axe:
scrollable-region-focusable). Give it `tabIndex={0}`, `role="region"`, and a label. Promoted to C-013.

### L-028 · Router navigations render in a transition
`2026-11-17` · hiro · scope: app/router · confidence: high
A tab bound only to `?tab=` switched a moment after the click, which a spec caught. Keep an
optimistic local value until the URL catches up (`ClassPage` pending tab).

### L-029 · Any navigation from inside a drawer must close it
`2026-11-17` · hiro · scope: shared/layout · confidence: high
Class links inside the phone drawer navigated without closing it, leaving the page hidden
behind the modal. `AppShell` now closes the drawer on every page change, not only on its
own nav items. Spec: "a class link in the drawer also closes it".

### L-030 · Multi-page accessibility sweeps need a longer timeout on CI
`2026-11-17` · hiro · scope: tests · confidence: high
The Instructor "every tab, form, and dialog" sweep (about 13 loads, each with a full axe
scan) hit the 30s limit once on CI's emulated iPhone WebKit and passed on retry. Sweep
specs call `test.slow()`; do not paper over timeouts with more retries.

### L-031 · Forced colors hide states shown only by a fill
`2026-11-17` · hiro · scope: a11y · confidence: high
In Windows high contrast, pressed filters, the current nav item, and the chosen answer
were indicated only by background color, which forced colors removes. A
`@media (forced-colors: active)` rule in `tailwind.css` draws a `Highlight` outline for
`aria-pressed`, `aria-current`, `aria-checked`, and selected tabs. Promoted to C-014.

### L-032 · Accessibility baseline after the rebuild
`2026-11-17` · hiro · scope: a11y · confidence: high
Lighthouse accessibility, mobile: classic Student 89, rebuilt Student and Instructor 100
(L-007 had 54 and 39 serious contrast nodes on classic). Screen-reader passes still need a
person: see `SCREEN_READER_CHECKLIST.md`.

### L-033 · Service-worker updates can strand open tabs
`2026-11-17` · hiro · scope: app · confidence: medium
Found in the Phase 4 review: after a deploy the new service worker deletes old precached
chunks, so a tab still running the previous version fails its next lazy screen load.
`main.tsx` reloads once on `vite:preloadError` (guarded by a sessionStorage flag so it
cannot loop). Verify on the first real deploy.

### L-034 · Deleting global CSS: compare pixels against a fresh baseline from main
`2026-11-17` · hiro · scope: styles · confidence: high
The classic stylesheets were loaded globally, so the Admin shell silently depended on some
of their rules. A first pass that moved only classes defined *exclusively* in the deleted
files missed rules that added properties to shared classes (`.profile-head`, `.popover`,
search), and the profile menu shrank by 5px. What worked: (1) capture Admin screenshots on
`main`, twice, to prove determinism; (2) move every legacy rule whose selector targets only
classes the remaining code uses, in source order with its media queries; (3) compare the
branch against the main baseline until it is pixel-identical (`maxDiffPixels: 0`).

### L-035 · Icon + number chips overflow narrow multi-column rows
`2026-11-17` · hiro · scope: shared/components · confidence: high
At 320px a 3-column chip row leaves ~70px for the label after the icon tile and padding,
and "Assessments" overflowed (19px sideways scroll; found by the 320px sweep, and only
with the pinned demo date, which changes the content). On phones `StatCard` stacks the
icon above the number and lets long words break; from `sm` it is side by side.

### L-036 · Definition lists only allow `div > dt + dd`
`2026-11-17` · hiro · scope: a11y · confidence: high
`CourseHeader` wrapped `dt`/`dd` in an extra element next to the icon (axe: definition-list,
dlitem, serious). Put decorative icons inside the `dt`.

### L-037 · One control per action on a dashboard
`2026-11-17` · hiro · scope: ux · confidence: high
The first dashboard made each deadline a button in both Tasks & Assessments and the
Academic Calendar. Duplicate controls add tab stops, confuse screen-reader users, and made
specs ambiguous. The calendar panel is a read-only timeline; deadlines open from Tasks.
Promoted to C-015.

### L-038 · Measure overflow with the test's exact sequence
`2026-11-17` · hiro · scope: tests · confidence: medium
An overflow that the spec reported did not reproduce in a fresh page because content
depends on the pinned clock. To find the culprit: pin the same clock, repeat the spec's
steps, then hide elements one by one and watch `scrollWidth` (bisecting beats scanning
bounding boxes, which miss content that overflows its own box).


### L-039 · A control added to a heading row needs a phone form
`2026-11-16` · hiro · scope: shared · confidence: high
Adding the cards/table toggle beside "View all classes" overflowed 320px by 29px. The
heading row now wraps (`SectionHeading` uses `flex-wrap`) and the toggle shows icons
only below `sm` (labels stay as `sr-only` text). Budget a heading row at 288px before
adding a second action.

### L-040 · Sidebar slots that depend on shell state take a function
`2026-11-16` · hiro · scope: shared · confidence: medium
The class list and Help link must render differently when the sidebar is collapsed, but
they are built by the role app above `AppShell`. `sidebarExtra` and `sidebarFooter`
accept `(collapsed) => ReactNode`; the phone drawer always passes `false`.

### L-041 · Viewport breakpoints lie once the sidebar can change width
`2026-11-16` · hiro · scope: shared · confidence: high
At a 1024px window the dashboard used its two-column `lg:` grid inside 688px of real
space, and a centered `max-w-6xl` left wide monitors mostly empty. Container queries on
`<main>` fixed both. `container-type` makes an element the containing block for
`position: fixed` children, so keep fixed UI (dialogs, bottom bar) outside `<main>`.

### L-042 · Stretching a tile moves dead space inside it unless a child grows
`2026-11-16` · hiro · scope: shared · confidence: high
Equal-height columns first produced a calendar with 150px between entries: the tile
stretched and `justify-between` spread four rows over it. Fix the grid so neighbors have
similar natural heights (tasks beside calendar; classes on their own row), then let one
child absorb the small remainder. A chip label that cannot fit ~90px gets a `shortLabel`
for phones instead of breaking mid-word; the full label stays the accessible name.

### L-043 · Fill a stretched tile with content, or change its neighbors
`2026-11-16` · hiro · scope: shared · confidence: high
Row-spanning tiles next to a taller stack stretched the task rows to 200px each. What
worked: put tiles with similar natural heights in the same row, move the short tile to
a full-width row with a horizontal layout, and show more real items where a tile is
still short. A heading that cannot shrink below its longest word must be allowed to push
its action to the next line (no `min-w-0` on the heading), or the two overlap.

### L-044 · Server reads: offline pauses, the service worker, and the entry chunk
`2026-11-16` · hiro · scope: shared, isms-link · confidence: high
The app's `networkMode: "offlineFirst"` pauses a failed query's retries while TanStack
thinks the device is offline, so a server-backed section showed its skeleton forever;
`/isms-link` opts out with `networkMode: "always"` and says "You’re offline". The
Workbox service worker does not touch cross-origin API calls (no matching route), so
`page.route` mocks still work on the production build; mocked cross-origin responses need
`Access-Control-Allow-Origin`, and the real API must allow the client's origin. Adding the
lazy route moved `@tanstack/query-core` from the preloaded `storage` chunk into `index`:
total eager JS was unchanged (124.3 → 124.0 KB gz) but `index` grew 99.2 → 103.7 KB gz,
leaving 3.7 KB under its budget.

### L-045 · Copying server data into the role store without a loop
`2026-11-16` · hiro · scope: instructor · confidence: high
Saving the role store fires `tmcc-lms-data`, which refetches every `["instructor"]` query.
A sync that writes on each run would loop, so `mergeIsmsClasses` returns the same object
when nothing changed and the hook writes only when it differs; ISMS query keys start with
`["isms"]`, outside that invalidation. `useQueries` returns a new array every render, so
its JSON is the effect dependency. The instructor being viewed was never persisted, so a
reload of another instructor's class fell back to the first instructor; the initial
instructor is now taken from the class in the URL.

### L-046 · Server-backed tests: ports, time zones, and the main landmark
`2026-11-17` · hiro · scope: e2e, shared · confidence: high
Playwright's `reuseExistingServer` happily reused a stale dev server left on 4173 that pointed
at an old API URL, so every workspace showed "API not running"; the suite now uses port 4317.
`new Date("2026-10-23T09:00:00")` in the Node runner is the runner's local time (UTC in CI),
so the pinned clock carries an offset and the browser zone is pinned (`timezoneId`). A loading
screen inside `<main>` made `openRole` (which waits for `main`) and screen readers treat a
half-loaded page as ready: the loading gate is a `div aria-busy` and only the workspace or its
error state is `main`. An assignment without a due date became `NaN` in every date rule and
silently disappeared from Tasks; treat empty as "no due date" (sorts last, never missing).

### L-047 · Moving code between chunks can push the entry over budget without new code
`2026-11-17` · hiro · scope: shared, build · confidence: high
When Student and Instructor stopped importing the browser role store (D-032), `data.js` and
`storage.js` were left with one eager importer (Admin), so Rollup folded them from their shared,
preloaded chunk into `index` and the entry passed 105 KB with no code added. Comparing the entry's
source-map `sources` between `main` and the branch shows such moves at once. The fix was real,
not a budget change: Admin now loads lazily like the other workspaces, so a student or instructor
no longer downloads Admin code before the first screen.

### L-048 · A client check that mirrors the server hides itself from a journey spec
`2026-11-17` · hiro · scope: instructor, e2e · confidence: high
The Attendance tab checks days present before saving, with the same message the server sends.
Removing the client check left `e2e/attendance.spec.ts` green, because the server's 400 came back
as `entries[i].daysPresent` and the tab mapped it to the same field error. That is the wanted
behavior, but the journey proves the outcome, not which layer caught it; the limits themselves are
pinned by `shared/lib/attendance.test.ts` and the server tests. Map indexed server errors back to
the rows actually sent, not to the class list order.

### L-049 · Reordering with equal sort orders, and phone specs that click the sidebar
`2026-11-17` · hiro · scope: shared, e2e · confidence: high
New modules get the next sort order per parent, but older rows can share one, and swapping two equal
numbers moves nothing. `reorderSiblings` renumbers the siblings 1, 2, 3… in their shown order and
sends only the orders that changed (sometimes just the neighbor's). An `@all` spec that opened the
class from the sidebar timed out on phones, where the class list sits in the closed drawer; open the
page by URL in specs that run on every device.

### L-050 · Editors over server data must not reset on a background refetch
`2026-11-17` · hiro · scope: instructor, e2e · confidence: high
The app's queries refetch on window focus, so keying the question-set editor by `dataUpdatedAt`
(to pick up a save) would have thrown away unsaved edits whenever the instructor switched tabs;
it is keyed by the set id and keeps its own state after a save. The overview's classes had no ISMS
subject id, so nothing on the client could tell which sets belong to a class; `ClassSummary` now
carries `subjectId` and the store keeps it as `ismsSubjectId`. In specs, `getByRole("textbox")`
also finds the top-bar search, so "no editable fields" checks are scoped to `main`.

### L-051 · Closed work was invisible to students, and a 409 body was thrown away
`2026-11-17` · hiro · scope: server, shared/api, instructor · confidence: high
Every student read (coursework list and detail, the overview, and the hand-in lookup) filtered on
`status == published`, so closing an activity would have made it vanish for students and turned
hand-ins into 404s instead of a clear 409; all four now accept `closed` too. On the client,
`ApiError` kept only `title`, `detail` and `errors`, so the close action's `ungraded` list never
reached the screen; it now keeps the whole problem body as `problem`. The instructor store maps
every non-archived status to "active", so `closed` is carried as its own flag rather than a status.

### L-052 · Local Android runs time out on the first workspace load
`2026-11-17` · hiro · scope: e2e · confidence: medium
On a laptop, a full or per-file `--project=android-chromium` run fails two or three specs per
run with "Loading the student workspace" still on screen after 5 s; a different spec each time.
`main` showed the same rate before the v2 revamp, so it is load, not a regression (each test
seeds its own API database). CI is green because it retries once. Rerun the failing spec alone
before suspecting a change.

### L-053 · `@starting-style` gives a delayed skeleton without keyframes
`2026-11-17` · hiro · scope: shared/ui · confidence: high
`transition-opacity delay-300 starting:opacity-0` fades a newly mounted skeleton in after 300 ms,
so fast loads never flash it, with no JavaScript timer and no `@keyframes` (C-019). Browsers
without `@starting-style` and reduced-motion users see it at once. Playwright still counts a
transparent element as visible, so specs that wait for a loading state are unaffected.

### L-054 · A space inside the count pill does not reach the accessible name
`2026-11-17` · hiro · scope: shared/ui · confidence: high
`<span> {count}</span>` after a label gave the name "Missing3": the space inside the span is
trimmed. `FilterChip` puts `{" "}` between the label and the pill, so the name is "Missing 3".
Specs match chip names by prefix (`/^Missing/`), so either form passes them; the primitive test
pins the spaced form.

### L-055 · Local iPhone WebKit runs can stop accepting clicks
`2026-11-17` · hiro · scope: e2e · confidence: medium
Partway through a session, every `iphone-webkit` spec that taps the top bar timed out with
"`<html>` intercepts pointer events", on this branch and on a clean `main` worktree alike, after
the same specs had passed an hour earlier. It is the local headless WebKit, not the UI: compare
against `main` (a worktree with `E2E_PORT`/`E2E_API_PORT`) before chasing it; CI's Linux WebKit
is the reference.

### L-056 · `?role=` in any URL switches the workspace
`2026-11-17` · hiro · scope: admin, app/router · confidence: high
`/admin/users?role=student` opened the Student workspace: `parseRoleFromLocation` honours the
legacy `?role=` form before the path (D-004). Admin's user filter is `?type=` instead, and
`features/admin/paths.ts` says why. Never name a query parameter `role` in any workspace.

### L-057 · `getByLabel` also matches hidden tab panels
`2026-11-17` · hiro · scope: e2e · confidence: high
A Radix tab panel is labelled by its tab, so `getByLabel(/^subject/i)` matched both the hidden
"Subjects" panel and the "Subject" select in the classroom dialog, and `selectOption` hung until
the test timed out with no call log. Use `getByRole("combobox", { name })`: role queries skip
hidden elements. Also, `allTextContents()` does not wait; assert the element is visible first.

### L-058 · An sr-only label inside a scroll frame can widen the page in WebKit
`2026-11-17` · hiro · scope: admin, shared · confidence: high
CI's iPhone WebKit found `/admin/users` 209px too wide at 320px while Chromium was fine: the
visually hidden "Actions" header (`sr-only` is `position: absolute`) had no positioned ancestor
inside the table's `overflow-x-auto` frame, so it escaped the scroll clipping and WebKit counted
its offset in the page width. Give any scroll frame that can hold `sr-only` text `relative`.
Only the 320px sweep caught it; local WebKit could still measure even while clicks failed (L-055).

### L-059 · A dialog opened by its `open` prop never calls `onOpenChange(true)`
`2026-11-17` · hiro · scope: admin, shared · confidence: high
Subjects and Classrooms reset their create form inside `onOpenChange(true)`, but the dialog is
opened by a header button and by `?create=1`, which set the `open` prop. Radix only calls
`onOpenChange` from its own trigger and close controls, so the reset never ran: a saved code
reappeared and failed as a duplicate, and an old error survived Cancel. Reset a controlled form
on close (Save, Cancel, and Esc all pass through it), and give a select with a computed default
`value={form.x || fallback}` so the shown option is the one that is saved.

### L-060 · Removing a decoration can remove the only visible cue
`2026-11-17` · hiro · scope: shared · confidence: high
The calendar dots were decoration by C-019, but they were also the only cue on today's cell and
the only non-color cue elsewhere; a tint alone fails WCAG 1.4.1 and vanishes in forced colors.
Days with items now underline their number. When a rule removes something, ask what it said.

### L-061 · Contract first lets parallel streams build against an API that doesn't exist yet
`2026-11-17` · hiro · scope: process, e2e · confidence: high
Five streams (API, import, builder, grading, student) were built in parallel against
`ASSESSMENTS_API_CONTRACT.md`. Client specs that need the new API fail until it's integrated. To
check a screen early, a local throwaway spec can answer the new endpoints with `page.route`
(calling `route.fetch()` for the real data and changing one field). Committed specs use the real
API. Each stream needs its own `E2E_PORT`/`E2E_API_PORT`, and never two Playwright runs in one
checkout (they rebuild `dist/` under each other). Integration still found gaps the contract had
missed (left ids for matching, overview fields, clearing dates, `Content-Disposition`).

### L-062 · Minimal-API `IFormFile` buffers uploads to disk
`2026-11-17` · hiro · scope: server · confidence: high
Binding an `IFormFile` buffers files over 64 KB to a temp file. Import reads the body with
`MultipartReader` (with `BodyLengthLimit`) into a `MemoryStream`, which keeps the "never on disk"
promise and gives exact size refusals. To guard against zip bombs, count the bytes as you unpack;
don't trust the entry headers. OpenXml 3.x `UnderlineValues`/`CellValues` are structs: compare
them with `==`, not `switch` constants.

### L-063 · EF refuses nested transactions; `HasDefaultValue` covers old rows
`2026-11-17` · hiro · scope: server · confidence: high
`ContentEndpoints.SaveWithAuditAsync` opens its own transaction, so run follow-up work (a
regrade) in a second transaction after it. `AttemptGrading.ScoreAsync` is the one place that
decides `submitted` vs `graded`; reuse it. New settings columns use `HasDefaultValue`, so old rows
get `results`/`strict` from both the migration and `EnsureCreated`.

### L-064 · `BrowserRouter` has no `useBlocker`
`2026-11-17` · hiro · scope: instructor · confidence: high
The router is a plain `BrowserRouter`, so React Router's blocker isn't available. The
Instructor workspace guards unsaved work with `useUnsavedChanges(dirty)` and
`useGuardedNavigate()` (`NavigationGuardContext`) plus `beforeunload`; screens that leave an
editor must navigate through it. Browser Back/Forward isn't intercepted yet. Two `<Route>`s
rendering the same component keep its state when the URL changes between them (new → edit), and
`instructorPaths.pageKey` keeps the shell from refocusing the h1.

### L-065 · A separating space belongs outside an `sr-only` span
`2026-11-17` · hiro · scope: shared, a11y · confidence: high
Chrome inserts a space before an absolutely positioned `sr-only` span, but jsdom drops spaces
at its edges. So `Label<span class="sr-only"> context</span>` reads differently in tests and in
browsers. Write `Label{" "}<span className="sr-only">context</span>`, and inside a flex button
wrap the pair in one span so the gap doesn't double the space.

### L-066 · Layout details on long editor pages
`2026-11-17` · hiro · scope: instructor · confidence: medium
A sticky side panel needs `top-20` to clear the shell's 64px sticky header. Radix menus far
down a long page can render outside the viewport, so cap them with
`max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto`. Specs that need an
exam "after its due date" should `PATCH` `dueAt` into the past, because closing answers 409 until
everyone is graded (D-036).

### L-067 · An editor that stays open while saving needs a revision, not a boolean
`2026-11-17` · hiro · scope: instructor · confidence: high
The assessment builder and the question set editor stay editable during a save, so clearing
`dirty` when the save resolves marks later edits as saved. Use `useEditRevision`: `begin()` at the
start of a save returns `settle()`, which clears `dirty` only if nothing changed since. Results
that come back per question (`applySaved`, field errors) are matched to the sections as they were
sent, by key, never by today's position. A missing date in a coursework patch means "unchanged":
send `clearDueAt`/`clearAvailableFrom` to empty one (contract §8).

### L-068 · A sticky top bar can make axe fail `target-size` on a full-size control
`2026-11-17` · hiro · scope: instructor, a11y · confidence: high
axe counts a control partly covered by the shell's sticky header as too small ("partially
obscured": a 44px select with 11.5px showing). It depends on the scroll position, so content
that grows above a button (results after Check answers) can park a control under the bar through
scroll anchoring. Don't pad the control: start the review from the top, as the preview now does
(score at the top, scroll there, focus it). Log each node's `any[].relatedNodes` to see what
covers the target.

### L-069 · Error toasts stay, so a fixed error must be replaced
`2026-11-17` · hiro · scope: shared · confidence: high
Danger toasts never time out, and the stack sits bottom right, over a table's last column. After
a retry succeeds, a stale "Could not save" stays and blocks the next row's buttons (the grading
SPELL spec timed out on a click). Give retryable actions a toast `group` (per row) so the success
toast replaces the error.

### L-070 · A card header row needs to wrap at 320px
`2026-11-17` · hiro · scope: instructor · confidence: high
A `flex` header with an icon, a `flex-1` title, and a `shrink-0` button can't shrink below the
title's longest word, so the button slides past the card. Local WebKit had 8px to spare; another
run overflowed by 2px. Use `flex-wrap`, `min-w-0` and a `basis-*` on the title, and let the button
drop under it.

### L-071 · Warm both servers before the first test
`2026-11-17` · hiro · scope: e2e · confidence: medium
On CI, whichever spec ran first sometimes failed `openRole` ("main" not visible in 5 s), even on
retry: the LMS API builds its EF model and seeds a sandbox on its first request (about 1 s
locally, 4–5× the next ones), and the Vite dev server compiles each workspace the first time a
browser opens it. On a 2-core runner with parallel workers, the two together passed 5 s.
`e2e/global-setup.ts` now calls the API once per role and opens each workspace once before any
test, instead of loosening the tests' timeouts. It began when the alphabetically first spec
started using the API (`assessment-builder` before `attendance`).

### L-072 · `Field`'s `error` marks the control invalid for any truthy value
`2026-11-18` · saheejuu2 · scope: shared/ui · confidence: high
`Field` sets `aria-invalid` with `Boolean(error)`, so passing `<FieldError message={null} />`
(an element that renders nothing) still marks the input invalid and red. Pass
`error={message && <FieldError message={message} />}` instead.

### L-073 · Fake timers with user-event hang unless the clock also runs in real time
`2026-11-18` · saheejuu2 · scope: tests · confidence: high
With `vi.useFakeTimers()`, every `user.click` in `ProfileBillboard.test.tsx` timed out: Testing
Library waits on a `setTimeout(0)` after each action and only advances Jest's fake clock. Use
`vi.useFakeTimers({ shouldAdvanceTime: true })` with `userEvent.setup({ advanceTimers })`. Also,
`user.unhover(container)` after clicking a child did not fire React's `onMouseLeave` on the
container; `user.hover(document.body)` does.

### L-074 · Coursework settings are columns, not JSON
`2026-11-18` · hiro · scope: server · confidence: high
The LMS API uses Oracle's `MySql.EntityFrameworkCore` in production and SQLite in tests and Demo.
EF Core's JSON-mapped complex types are not dependable on either, so a settings object stored as
JSON would behave differently in tests and production. Add settings as plain columns (as D-040 did)
and keep them maintainable in code: one place reads and checks them, one rules class uses them.

### L-075 · The workspace identity travels in headers, so `src` URLs to the API can't be authorized
`2026-11-18` · hiro · scope: client, server · confidence: high
`shared/api/viewer.ts` sends `X-Demo-User-Id`, `X-Demo-Role` and `X-Demo-Sandbox` on each `fetch`.
An `<img src>`, `<iframe src>` or `<a href>` pointing at the API sends none of them. Fetch the file
with the usual headers (`http.ts` already downloads blobs this way) and show it from an object URL.

### L-076 · A force-mounted Radix tab panel is never hidden
`2026-11-18` · hiro · scope: client · confidence: high
`TabsContent` sets `hidden={!present}`, and `forceMount` makes `present` always true, so every
panel shows at once. Pass `hidden={value !== current}` yourself (it is spread after Radix's), and
keep layout classes like `flex` on an inner element. Also put a space between a tab's label and its
badge: without one the name reads "Questions3" (`AssessmentBuilderPage.tsx`).


### L-077 · An empty state's action can share its name with the page's own button
`2026-11-19` · hiro · scope: e2e, instructor · confidence: high
Instructor Materials has "Add material" in the tab heading and again inside "No materials yet", so
`getByRole("button", { name: "Add material" })` is a strict-mode error once the list is empty. The
seed never shows that state; `e2e/empty-illustrations.spec.ts` reaches it by deleting the class's
materials through the API in the test's sandbox. No seeded student is without classes, so the My
classes picture is covered by the `EmptyState` unit test and a manual check only.

### L-078 · A refused upload must not start a draft
`2026-11-19` · hiro (assignments) · scope: server · confidence: high
`POST …/draft/files` creates the draft when there is none, and a draft changes the student's state
from "assigned" to "draft". Create it only after the file has passed every check (type, settings,
virus scan): a wrong file must leave nothing behind, neither a row nor bytes
(`AssignmentDraftTests.Files_that_are_not_accepted_are_refused_and_nothing_is_kept`). Until then,
count room against the version the draft would be copied from (`Scope.CopySource`).

### L-079 · Server tests and the dev scanner never use the EICAR file
`2026-11-19` · hiro (assignments) · scope: server, e2e · confidence: high
An antivirus on a developer's machine quarantines the EICAR test file the moment a test writes it,
and can flag source that contains it. `NoScanner` (Development and Demo only) refuses a file that
starts with `LMS-VIRUS-SCAN-TEST-FILE` instead, so tests and browser specs can show the refusal.
The ClamAV client is tested against a local listener that speaks `INSTREAM`
(`ClamAvScannerTests`); try the real EICAR file only by hand against a real clamd.

### L-080 · Column names are letters and underscores only
`2026-11-19` · hiro (assignments) · scope: server · confidence: high
`DatabaseTests.Tables_and_columns_are_snake_case` refuses a digit, so a property named `Sha256`
fails it. Name the property for what it holds (`StoredFile.ContentHash`).

### L-081 · `GET …/coursework` answers a page, not an array
`2026-11-19` · hiro (assignments) · scope: e2e, server · confidence: high
The list routes return `{ items, page, pageSize, total }` (`PagedList`). A spec that reads the list
with `callApi` must take `.items` (and pass `pageSize` when the class may hold more than one page).
`.find is not a function` is the symptom.

### L-082 · A builder's cached copy must be dropped after a save
`2026-11-19` · hiro (assignments) · scope: instructor · confidence: high
The builders read their record with `staleTime: Infinity`, so a refetch never replaces what is being
edited. Without more, leaving and reopening the builder in the same tab showed the copy read before
the last save. `useSaveAssignment` invalidates the detail without refetching (`refetchType: "none"`),
and the loader waits only for a fetch started on mount (`isFetching && !isFetchedAfterMount`), so a
later background refetch never swaps the form out.

### L-084 · `getByText("Saved")` finds the autosave status twice
`2026-11-19` · hiro (assignments) · scope: e2e · confidence: high
`SaveStatusNote` shows the state in an `aria-hidden` span and announces it in an `sr-only`
`role="status"`, so a text locator is a strict-mode error. Select the announcement instead:
`getByRole("status").filter({ hasText: /^Saved$/ })` (`e2e/assignment-work.spec.ts`).

### L-085 · A count-of-zero check on a renamed control passes forever
`2026-11-19` · hiro (assignments) · scope: e2e · confidence: high
`close-activities.spec.ts` asserts `getByRole("button", { name: /Submit work/ })` has count 0 on a
closed assignment. The Your work card (D-060) has no "Submit work" at all, so that line can no
longer fail. When a control is renamed, update absence checks to the new names ("Turn in",
"Choose files") or pair them with a check that the page shows the control when it is allowed.

### L-086 · Upload a draft's files one at a time
`2026-11-19` · hiro (assignments) · scope: student · confidence: medium
The first upload (or text save) creates the draft. Two requests at once can both try, and the
server refuses the second ("Another draft was started at the same moment"). `useUploadQueue` sends
one file at a time and flushes the autosave before each, so only one request can start the draft.

### L-087 · `late` is worked out from today's due date, and the two clocks differ
`2026-11-19` · hiro (assignments, PR 2D) · scope: e2e, server · confidence: high
The server computes a version's `late` when it is read (`submittedAt > dueAt`), so moving the due
date changes it for work already handed in. In Demo the API's clock starts at `Lms:Demo:Now` when
the process starts and keeps running, while each test's browser clock starts at that instant when
the test starts, so they disagree by minutes. For on-time and late work in one spec, set `dueAt`
just after an earlier turn-in's `submittedAt` (`assignment-grading` filters test); never compare
the browser's "now" with a due date taken from the API's clock.

### L-088 · Show a stored file from a blob typed by the client, never by the response
`2026-11-19` · hiro (assignments, PR 2D) · scope: instructor · confidence: high
The grading page's viewer re-wraps the fetched bytes as `new Blob([blob], { type })` with a type
from an allowlist (PNG, JPEG, PDF) and reads `.txt` with `blob.text()` into a `<pre>`, so nothing
is ever rendered as HTML. Object URLs are revoked when the file changes or the viewer unmounts
(`useStoredFile`). The client sets no Content-Security-Policy today; one added later must allow
`blob:` in `img-src` and `frame-src`, or the viewer goes blank.

### L-090 · A check at the start of a request is stale by the time a slow request writes
`2026-11-19` · hiro (assignments) · scope: server · confidence: high
An independent review found that an upload still being scanned could add its file to a draft the
student had turned in meanwhile, and that a grade and "take back" could cross. `Submission.Status`
is now a concurrency token, so an update of a row that changed since it was read fails
(`DbUpdateConcurrencyException`, answered as 409 by `ConcurrencyExceptionHandler`). A draft's
files are rows of their own, so routes that add or remove one first lock the draft with
`AssignmentFiles.LockDraftAsync` inside their transaction; that also makes two uploads at once
count each other on MySQL, where neither would see the other's uncommitted row. SQLite runs one
writer at a time, so tests can't show the MySQL case: `FakeScanner.DuringScan` stands in for it.

### L-091 · Until a draft exists, its first save and first upload must not overlap
`2026-11-19` · hiro (assignments) · scope: student · confidence: high
Supersedes the claim in L-086 that waiting for the queued save is enough. Either request creates
the draft, and the server refuses the second one at the same moment (409). An independent review
found the other direction: a save that starts *after* the first upload began. `DraftEditor` now
holds a save back while the first upload is on its way (`firstUpload`), and only then; once the
draft exists, saves and uploads run freely. The same review found that Cancel did nothing on a
file still waiting its turn (there is no request to abort: take it off the list), that a cancel
can land after the server stored the file (read the draft again), and that text typed while a
turn-in is on its way was dropped (the fields are read-only and the dialog stays until it
answers). Tests: `DraftEditor.test.tsx`, `useUploadQueue.test.tsx`.

### L-092 · A toast covers a sticky bottom bar on desktop
`2026-11-19` · hiro (assignments) · scope: instructor, shared/ui · confidence: high
The rubric editor first had its total and Save in a bar stuck to the bottom of the page. On
desktop the toast viewport sits in the bottom-right corner, so the "Could not save" toast lay
over Save and a second click waited until it left (a spec caught it). Put the actions in an
aside stuck to the top beside the form at `@4xl`, as the builders' Summary is; on phones the
toast sits 5rem above the bottom and clears a one-row bar.

### L-093 · `onCloseAutoFocus` runs with the handler the closing content last rendered with
`2026-11-19` · hiro (assignments) · scope: instructor · confidence: medium
When a dialog's content is rendered only while open (`{item && <DialogContent …>}`), closing it
after a success unmounts it in the same render that records the success. A flag kept in state is
still false in the handler Radix calls, so focus would go back to a trigger that no longer exists.
Keep "it worked, move focus elsewhere" in a ref (`DeleteRubricDialog`). This is reasoned from how
Radix keeps the handler, not reproduced with the state version; the rubrics spec checks that focus
lands on the page heading after a delete.

### L-094 · Passing an `id` to a control inside `Field` unlinks its label
`2026-11-20` · hiro (assignments, PR 3D) · scope: instructor · confidence: high
`useFieldProps` keeps a control's own `id` over the Field's, but the `<label htmlFor>` uses the
Field's. Giving the feedback `Textarea` an id (to focus it after a dialog) left it with no
accessible name: `getByRole("textbox", { name: /Feedback/ })` timed out and axe reported `label`.
To reach a control inside a `Field`, keep a ref on a wrapper and `querySelector` it
(`FeedbackField.tsx`).

### L-096 · A disabled TanStack query is `isPending` forever
`2026-11-19` · hiro (assignments, PR 3C) · scope: student · confidence: high
`useAssignmentRubric` is disabled when the assignment has no `rubricId`, and a disabled query with
no data reports `isPending: true`. Rendering a skeleton on `isPending` alone would show "Loading
the rubric" on every assignment without one. Check the reason to fetch first (`rubricId &&
rubric.isPending`, `AssignmentWork`), and treat the endpoint's 404 as `null`, not an error.

### L-097 · Seed Phase 3 dates whole days from the API's "now"
`2026-11-19` · hiro (assignments, PR 3C) · scope: e2e · confidence: high
Days late are calendar days in Manila (contract §10), and the browser and the API clocks differ by
minutes (L-087). The suite's "now" is 09:00 in Manila, so a due date exactly two days before
`serverNow` (rounded to the minute) is 2 days late by both clocks, and the dialog's "2 days late"
matches the grade's `daysLate`. `e2e/assignment-work-more.spec.ts` builds every date that way
(`daysFrom`) and formats expected dates in Asia/Manila like `formatDue`.

### L-098 · Never preview money-like arithmetic in floating point; and a second way to grade must say the same thing
`2026-11-20` · hiro (assignments) · scope: instructor, shared · confidence: high
An independent review of the Phase 3 screens found the late-penalty preview a cent off the server
for thousands of inputs (7.5 less 37% is 4.725: floats give 4.72, the server's decimals 4.73).
`afterPenalty` now works in whole ten-thousandths, and `rubricTotal` rounds its sum to cents. It
also found that the class Submissions tab, a second place to grade, took one score and said
"18 / 20" for late work that scored 14.4: it now sends rubric and penalized-late work to the
assignment's grading page, and the overview carries `exceptions` so excused students are not
listed there as having handed in nothing. When a rule gets a second screen, check the first one.
Also from that review: `fileNameFrom` (`http.ts`) reads `filename*=` first and never URI-decodes a
plain `filename`, since "Lab 100% done" is not an encoding; and `latePenaltyRule` says "loses N%"
when the cap is reached on the first day.

### L-099 · The page's focus ring vanishes on the green tile
`2026-11-24` · hiro (D-066) · scope: shared, a11y · confidence: high
The global ring is `--color-focus` (#1f6e58), which is nearly the same as the `primary-700` fill of the
dashboard's `FocusTile` (under 1.2:1), so a keyboard user could not see focus on "Review student work"
(this was already true of the old green hero). Controls on the fill add `onFillFocus`
(`lib/tones`, a white ring); `tokens.test.ts` asserts the white ring passes 3:1 and the page ring
does not. Any new filled surface needs the same check.

### L-100 · Keep a section heading on one line with `flex-auto`, not a min() of max-content
`2026-11-24` · hiro (D-066) · scope: shared, layout · confidence: high
`SectionHeading` gave its title column `basis-40`, so a panel link squeezed "Academic calendar"
onto two lines (against C-015). `min-w-[min(100%,max-content)]` looks right but is invalid CSS
(`min()` takes lengths only), so Tailwind's rule is dropped silently and the computed value stays
`auto`. `flex-auto` works: in a wrapping row the column's basis is its content width, so the action
wraps under the heading when both do not fit. Check computed styles, not class names, when a layout
fix "does nothing".

### L-101 · A color transition on a toggle fails axe right after the click
`2026-11-24` · hiro (D-066) · scope: shared, a11y, e2e · confidence: high
The new `SegmentedControl` first had `transition-colors duration-150`. A spec that clicks "News &
announcements" and then runs axe measured the white label on a fill still fading from white to
green and reported `color-contrast (serious)` (Pixel project). The old toggles had no transition.
Pressed, selected, and current states now change at once; transitions stay on hover-only surfaces.
The same fade also fooled a manual probe into reading a half-blended focus ring (L-099): wait for
transitions before measuring computed colors.

### L-102 · Draw PDFs with pdf.js on phones; a frame shows them well only on computers
`2026-11-25` · hiro (D-067) · scope: shared, materials · confidence: medium
`navigator.pdfViewerEnabled` says a browser has a PDF viewer, not that it works in a frame: an
iPhone shows a framed PDF as a picture of one page, and Android Chrome has no viewer at all. The
material preview uses the browser's own viewer only where it also has a fine pointer
(`(hover: hover) and (pointer: fine)`), and otherwise draws the pages with pdf.js, loaded on
demand (`PdfPages`, about 500 KB once, outside the install cache). Headless Chromium reports no
viewer, so every e2e project exercises the pdf.js path; the framed path is checked by hand.

### L-103 · pdf.js text over a page needs its scale variables on the page element
`2026-11-25` · hiro (D-067) · scope: shared, materials, e2e · confidence: high
`TextLayer` sizes runs with `--total-scale-factor`, `--scale-round-x`, and `--scale-round-y`, which
pdf.js's own viewer sets on each page; without them the text lands at the wrong size and can't be
selected. `PdfPages` sets them inline, and `tailwind.css` carries the few `.pdf-text-layer` rules the
text needs (the only stylesheet, D-039). The runs are transparent and tiny at phone scale, so the
e2e readable-text check now skips transparent text: it is read aloud, not seen.

### L-104 · Demo mode binds the database and files to the request; do server work inside it
`2026-11-25` · hiro (D-067) · scope: server, demo · confidence: high
Each Demo sandbox's SQLite database and file store are chosen from the request's
`X-Demo-Sandbox` header (`DemoDatabases.SandboxOf`). A background worker has no request, so it
cannot reach them; that is why Office previews are made during the upload, with a time limit,
rather than queued. Work that must happen later needs its own way to name the sandbox.

### L-105 · jsdom checks Label in Name only when a canvas package is installed
`2026-11-25` · hiro (D-067, D-069) · scope: shared, a11y, tests · confidence: high
jsdom 31 lists `@napi-rs/canvas` as an optional peer. Without it, `getContext("2d")` is null and
axe's `label-content-name-mismatch` can't run, so Vitest + axe passed names that don't contain the
visible text. pdfjs-dist installs `@napi-rs/canvas`, and two real problems appeared at once
(D-069). Unit-level axe results depend on what is installed: a passing axe test without a canvas
proves less than it seems, and the browser specs remain the reference.

### L-107 · A sideways scroller needs `relative` and `min-w-0` on its items
`2026-11-27` · saheejuu2 · scope: shared, layout · confidence: high
Two things broke the first `CardRow` (D-071). The class tiles hold `sr-only` text, which is
`position: absolute`: with no positioned ancestor inside the scroller, the text of cards
scrolled out of view was not clipped and widened the whole page by 159px at 1024px. `relative`
on the scrolling element fixes it. And a flex item's minimum width is its content's, so a tile
with a `truncate` title grew to the full title instead of its `15rem` share until the item got
`min-w-0`. `class-view` "stay in one row and scroll sideways" fails on either regression.

### L-106 · Fake-media WebRTC checks: count tracks and measure sound with an analyser
`2026-11-26` · hiro (D-072, Phase 0) · scope: tests, meetings · confidence: medium
Two headless Chromium browsers with `--use-fake-device-for-media-stream` joined the local
LiveKit server. The page that joined first always reported `totalAudioEnergy: 0` for the sound
it received, though its packets arrived and an `AnalyserNode` on the same track measured the fake
beep at a peak of about 1.0. That page also held stale, paused media elements from an earlier
subscription. Swapping who joined first moved the 0 to the other person, so the stat followed the
page, not the sender. For "can they hear each other", measure the received track with Web Audio
(`createMediaStreamSource` → `AnalyserNode`), not the inbound-rtp energy stat. In Docker,
`meet-server/` uses one UDP port (7882) instead of LiveKit's 10,000-port range, and advertises
`NODE_IP=127.0.0.1`. So the `lk` CLI runs inside the server's network
(`--network container:lms-meet-dev`), where `127.0.0.1` reaches the server.

### L-108 · LiveKit's room API and webhooks, as they really behave (1.13.11)
`2026-11-26` · hiro (D-072, Phase 1) · scope: server, meetings · confidence: high
Checked against a running server, and kept true by `LiveKitContractTests` in API CI.
- **Sources:** an empty `canPublishSources` means every source is allowed. A pass without
  `microphone` makes the client's publish fail with "insufficient permissions". Taking a source
  away with `UpdateParticipant` unpublishes that track at once, and the client gets
  `LocalTrackUnpublished`.
- **Muting:** `MutePublishedTrack` mutes. Unmuting someone else answers 412 `failed_precondition`
  while `enable_remote_unmute` is off.
- **Server messages:** `SendData` arrives with no participant, so the page can trust it.
  `destination_identities` reaches only those people.
- **Errors:** Twirp requests use snake_case field names (enums as names, e.g. `MICROPHONE`), and
  errors come back as `{code, msg}`. A pass with a bad signature gets 401 as plain text, not
  Twirp JSON, so a wrong secret has to be told apart from an outage by its status code.
  `GET /rtc/validate?access_token=` checks a join pass over plain HTTP: 200 or 401.
- **Webhooks:** `application/webhook+json` in camelCase, with Unix times as strings (`createdAt`,
  `joinedAtMs`). The `Authorization` header holds a JWT (no `Bearer`) whose `sha256` claim is the
  standard base64 SHA-256 of the body. "Room finished" arrives after the room's
  `departure_timeout`, and the value given to `CreateRoom` overrides `livekit.yaml`.
- **Testing sound:** Chrome feeds a received track to Web Audio only while it is attached to a
  media element (L-106).

### L-109 · A new tab loses the demo identity; Playwright waits on aria-disabled; Demo's clock vs LiveKit's
`2026-11-26` · hiro (D-072, Phase 2a) · scope: shared, tests, meetings · confidence: high
- **New tabs:** the "viewing as" choice lives in `sessionStorage`, and a link with
  `target="_blank"` (noopener by default) opens a tab that doesn't inherit it. Checked in
  Chromium and WebKit. Anything that must stay the same person opens in the same tab until real
  sign-in.
- **aria-disabled in tests:** Playwright counts `aria-disabled="true"` as disabled and waits for
  "enabled" before a click. A control that stays pressable to say why needs `click({ force: true })`.
- **Clocks:** the browser specs start the API's clock on 2026-10-23, but LiveKit checks passes
  by the real clock, so passes signed by the API's clock arrived expired. Anything another
  server checks uses the real clock.
- **WebKit:** Playwright's WebKit has no stand-in camera or mic, so specs that join a meeting
  run on the Chromium projects and skip on iPhone WebKit.

### L-110 · role="log" on a list, sheets hiding the page, and toasts over a control bar
`2026-11-26` · hiro (D-072, Phase 2b) · scope: shared, a11y, tests, meetings · confidence: high
- **role="log" on a list:** `role="log"` on an `<ol>` replaces its list role, so axe reports
  every `<li>` as outside a list (`listitem`). Put the role on a wrapper `div` and keep the `ol`.
- **Sheets:** on phones the chat and people panels are Radix sheets, which hide the rest of the
  page from assistive technology. A spec must close the sheet before it reads anything behind it
  (a status line, the controls).
- **Toasts:** on a phone, toasts sit at the bottom, over a page's own bottom controls. The
  meeting page writes its messages into a line above the stage instead.
- **Starting devices:** `createLocalVideoTrack` takes a moment. A Join pressed meanwhile left
  without the camera, and the camera started afterwards stayed on. Make Join wait for devices
  and stop a device that starts after the screen has gone.

### L-111 · Vite reloads a page the first time a lazily imported package is used; date tests and the machine's zone
`2026-11-26` · hiro (D-072, Phase 3) · scope: tests, build, meetings · confidence: high
- **Vite reloads on new packages:** a package first reached through a dynamic `import()` (here
  `@livekit/track-processors`, when blur is turned on) is discovered by the dev server only then.
  It optimizes it and reloads the page, which ended the pre-join screen's camera and choices.
  The production build is unaffected. List such packages in `optimizeDeps.include`.
- **Time zones:** a unit test that expects "09:05" from a UTC timestamp passes only in Manila.
  Vitest uses the machine's zone, unlike Playwright, which pins Asia/Manila. Build the moment
  from local parts (`new Date(2026, 9, 23, 9, 5)`) and check the test under `TZ=UTC` too.
- **Third-party defaults:** LiveKit's blur fetches MediaPipe from jsdelivr and Google Storage
  unless given `assetPaths`. Check a new browser dependency's default URLs, and test for
  requests outside the LMS.


### L-112 · A LiveKit join pass can't be taken back; a join that finishes after the page is gone
`2026-11-28` · review of D-072 (integration PR) · scope: meetings, server, tests · confidence: high
- **Rooms:** LiveKit opens a room for any valid join pass unless `room.auto_create` is false. With
  it on, a 10-minute pass reopened a meeting the instructor had ended, as a new, empty room. Only
  the LMS API opens rooms now (`meet-server/livekit.yaml`, both CI services, and
  `LiveKitContractTests`, where `rtc/validate` answers 404 for a room that doesn't exist).
- **Joins in flight:** a join is several awaits (pass, then connect). Leaving the page or pressing
  Stop waiting in between must make that attempt stale, or it connects with no page left to show
  it. `useMeetingRoom` counts attempts; `useMeetingRoom.test.tsx` checks both ways out.
- **Check people when they arrive, not only when they get a pass:** connected clients receive
  fresh passes from LiveKit itself, so a short pass alone doesn't keep a removed student out. The
  API re-checks each `participant_joined` webhook (`MeetingPresence`) and removes anyone the
  instructor removed or the class list dropped; the ISMS sync removes dropped students from live
  meetings at once.

### L-113 · Hiding the instructions also means the header's description line
`2026-11-28` · D-073 · scope: student · confidence: high
- The student catalog sets `description` to the instructions when the instructor gave no
  description (`catalog.ts`), so the page header repeats them. Anything that hides the
  instructions must hide that line too, but only when the two are the same text; a real
  description stays.
- The page and the Your work card read the same `useMyWork` query (one cache entry), so both
  agree on "handed in" the moment a write answers. `useMyWork` takes `enabled` so the page can call
  it before its early return without fetching for exams.
