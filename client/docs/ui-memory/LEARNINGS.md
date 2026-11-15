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
assignment. Decide in Phase 2 whether the rebuilt detail shows exam grades.

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
