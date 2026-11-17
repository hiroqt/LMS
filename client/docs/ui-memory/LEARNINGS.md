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
