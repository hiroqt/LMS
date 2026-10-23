# Codebase map

- `src/App.jsx` — student workspace shell, collapsible sidebar and My Classes workspace group, dashboard overview/news switch with teacher updates, school announcements, automatically rotating three-slide featured announcement carousel, local navigation and academic calendar, dashboard month review of academic events and assessment deadlines, weekly academic-event summary and focused calendar agenda, search, task category filter, class tabs, classwork filters, material detail, timed question flow, submission, and result review.
- `src/icons.jsx` — small local SVG icon set used by navigation and action controls (no icon package dependency).
- `src/data.js` — fictional classes, student roster, assessment due dates, mock academic calendar events, materials, and course question banks.
- `src/App.css` — dashboard and academic calendar with event-type and class-colored month markers, aligned dashboard news heading, responsive featured announcement carousel, mobile notification popover gutters, collapsible sidebar with class-card cover colors and symbol badges, task/classwork lists, class stream, material list, and roster styles.
- `src/Details.css` — responsive workspace shell, mobile navigation drawer, narrow-screen class/resource layouts, full-width mobile Tasks status filter, compact calendar event markers, assessment/material detail, quiz, result, and submit dialog styles.
- `public/*-banner.jpg` — generated announcement artwork for featured exam, school event, and campus break slides.
- `src/index.css` — global tokens, reset, Poppins/system sans typography, visible focus, and minimum control hit areas.
- Typography in `src/App.css` and `src/Details.css` keeps text at 12px or larger; class tiles emphasize course symbols as large visual shortcuts. This is an implementation floor, not a claim of WCAG conformance.
- `docs/PROJECT_BRIEF.md` — goals, scope, boundaries, and acceptance.
- `docs/ARCHITECTURE.md` — state/data flow and privacy limits.
