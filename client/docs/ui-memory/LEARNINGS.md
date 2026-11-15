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

