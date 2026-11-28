# Conventions

Rules for rebuilt UI code. Each is short enough to check in review. New rules are promoted
from [`LEARNINGS.md`](LEARNINGS.md) (see the loop in [`README.md`](README.md)).

### C-001 · Folders and imports
- `src/app`: providers, router, layouts. `src/features/<role>/<feature>`: screens and
  their `components/`, `hooks/`, `api/`, `types.ts`, `index.ts`. `src/shared`: `ui/`
  (design system), `layout/`, `components/`, `hooks/`, `lib/`, `api/`, `styles/`.
- `features` may import `shared`. `shared` never imports `features`. A feature imports
  another feature only through its `index.ts`.
- There is no legacy UI code left (D-039). Plain-JavaScript data modules live in their
  feature (`features/admin/data`); add a `types.ts` beside them for typed screens.

### C-002 · TypeScript
- New files are `.ts`/`.tsx` and pass `npm run typecheck` (strict,
  `noUncheckedIndexedAccess`).
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Put a React hook in its own file, not next to components (fast refresh needs files
  that export only components).

### C-003 · Styling with tokens
- Style with Tailwind utilities that use the tokens in
  [`generated/tokens.md`](generated/tokens.md). No hex values or pixel font sizes in
  components.
- Body text is `text-body` (14px) or larger. Green text is `text-primary-700` or darker.
  No uppercase labels or eyebrows (C-019).
- Interactive controls are at least `min-h-touch` (44px) tall.

### C-004 · Accessibility is part of done
- Every control has a visible label or an accessible name. Icon-only buttons need
  `aria-label`.
- Use the design-system primitives for dialogs, menus, tabs, and popovers. Do not
  hand-roll focus management.
- Respect `prefers-reduced-motion`. Never rely on color alone for status.
- Each page has one `h1`; focus moves to it on route change.

### C-005 · Base styles come from preflight (D-039)
Tailwind's preflight is on and `tailwind.css` sets the page defaults (canvas background, ink
text, Poppins, pointer cursor on buttons, a focus ring). Components no longer need `m-0`,
`list-none p-0`, or `border-0 bg-transparent` for resets; existing ones are harmless. Never
add `!important` by hand.

### C-006 · Tests
- A new or rebuilt screen keeps every flow spec in `e2e/` passing unchanged (D-007).
- Specs select by role and accessible name (`getByRole`, `getByLabel`), never by CSS
  class. Use `@mobile` for phone-only journeys and `@all` for every-device checks.
- Unit and component tests use Vitest (`*.test.ts(x)` beside the code). Legacy
  `*.test.js` stays on `node:test`.
- A test must be able to fail. Check it against a broken version once (L-005, L-012).
- A navigation spec asserts something only the destination has (its `h1`, a unique
  control) and, when the source page could match too, asserts its absence first.

### C-007 · Data and storage
- Do not change the storage keys `tmcc-lms-roles-v1` or `gclass-student-workspace-v1`,
  or the shape of what they hold (D-008).
- Screens never touch `localStorage` directly. They use feature hooks over the app
  QueryClient.

### C-008 · Design-system primitives
- Use `shared/ui` before writing markup: `Button`/`IconButton` (44px, `loading` sets
  `aria-busy`), `Field` + `Input`/`Textarea`/`Select` (label, hint, and error linked
  automatically), `Dialog` (bottom sheet on phones), `Tabs`, `Menu`, `Card`, `Badge`,
  `EmptyState`, `Skeleton`/`SkeletonGroup`, and `useToast` under `<Toaster>`.
- Buttons default to `type="button"`; pass `type="submit"` explicitly in forms.
- `Select` is the native element on purpose: it gives the best phone pickers and
  screen-reader support.
- Every primitive has a Vitest + axe test in `src/shared/ui/primitives.test.tsx`. Add one
  for a new primitive.

### C-009 · Keep the classic bundle lean
- Code that runs for classic users (`main.tsx`, `app/router`, `app/providers`) must not
  import the `shared/ui` barrel or `cn()`. Import single files, or use plain markup.
- New role UIs and pages load with `React.lazy` from the router.
- Check `npm run build` output for the `index-*.js` gzip size in the PR when touching eager
  code (L-013).

### C-010 · Shell and focus
- Every rebuilt page renders inside `AppShell` with `PageHeader` (its single h1) and passes
  a `pageKey` that changes on navigation; the shell then focuses the h1.
- Dialogs that navigate stop Radix's focus restore (L-015).
- An overlay that exists only at some breakpoints derives `open` from the breakpoint too;
  CSS `hidden` alone leaves Radix's focus trap and pointer lock active (L-017).
- Student phone navigation is the bottom bar (≤5 destinations); Instructor uses the drawer.

### C-011 · Responsive layout rules
- Multi-column page grids start from `grid-cols-1`, never the implicit auto column (L-019).
- Buttons with long or data-driven labels get `max-w-full shrink whitespace-normal` (L-020).
- Sticky bars live directly in the column they should stick within (L-022).
- Every rebuilt page is in a 320px sweep spec with no sideways scroll.

### C-012 · Student data access
- Read through `useStudentCatalog()`, `useProgress()`, or `useWorkspace()`; never
  `localStorage` or `data.js` directly.
- Put counting, grouping, and date rules in `features/student/api/selectors.ts` with a
  unit test; screens only render.
- Write only through `api/submissions.ts` and `api/progressStore.ts` so the classic
  Instructor and Admin UIs keep reading the same records (D-016).

### C-013 · Interactive patterns
- Radix values (tabs, radio, select) never contain spaces; map labels to slugs (L-026).
- Scrollable containers get `tabIndex={0}`, `role="region"`, and an accessible name (L-027).
- Destructive actions confirm in a `Dialog` that names the item, never `window.confirm`.
- Controls bound to the URL keep an optimistic local value so they respond immediately (L-028).
- Every write shows a toast: success when stored, an error toast when storage refuses it.

### C-014 · Resilience and performance
- Never show a state with color or fill alone; the forced-colors rule covers
  `aria-pressed`, `aria-current`, `aria-checked`, and selected tabs. Use those attributes.
- Keep `npm run budget` green. Raising a limit needs a DECISIONS entry.
- New screens must work offline after one visit (precached automatically). Anything that
  needs the network says so in the UI instead of failing silently.
- Run `SCREEN_READER_CHECKLIST.md` with a person before cutover and after big changes.

### C-015 · Dashboard and course patterns (D-023)
- Dashboard panels: an `h2` with a leading icon (`SectionHeading` `icon`) and one
  "View all" link to the full page (`PanelLink`); the heading stays on one line, and the
  link wraps under it when both do not fit.
- One control per action on a page; secondary views of the same item are read-only (L-037).
- Courses are named by title first, with the course code (`CourseCode` or "IT101 · …")
  as metadata; course pages open with `CourseHeader` (code · section · term, title, facts).
- Due dates use pills that warm as the deadline nears (info → warning → danger) and
  always include the date in text.


### C-016 · Preferences and plain copy (D-024)
- A display preference (layout, collapsed state) uses `usePersistentState` with a
  `tmcc-…` key, defaults to the previous behavior, and never hides a control's
  accessible name: collapse the label with `sr-only` and add `title`.
- An alternative view of a list is a real `<table>` with a caption, `scope` on headers,
  the item name as the row header, and a focusable scroll frame (`ClassTable`).
- Copy states facts. No taglines, no encouragement, no eyebrow that repeats the heading,
  no decorative illustration. If a line could sit on any product's page, delete it.
  One exception (D-057): `EmptyState`'s `illustration`, only where nothing exists yet.
- Cards have a uniform border. Do not add colored side or top stripes for identity.

### C-017 · Adaptive layout (D-025)
- Lay out page regions with container variants (`@4xl:grid-cols-…`), not viewport
  ones (`lg:`). `<main>` is the container; a reusable list wraps itself in `@container`.
- Reference widths: `@xl` two cards, `@4xl` two page columns or three cards, `@7xl`
  three page columns or four cards.
- Viewport variants remain right for the shell (sidebar, bottom bar) and for type and spacing.
- Limit line length on prose (`max-w-prose`), never on the page.

### C-018 · Bento tiles (D-026)
- A dashboard section is a `Panel`. Do not place a bare heading and list on the canvas.
- One gutter for the whole grid: `gap-3 sm:gap-4`, between rows and between columns.
- Leave grid items stretched (no `items-start`); give the tile's main child `flex-1` so
  the height is used by content, not by blank space under it.
- Exception (D-071): a list tile with too few rows to use the height adds
  `@4xl:self-start`, so it ends under its content instead of holding blank space.
- A dashboard collection that can outgrow one row is a `CardRow` (D-071): stacked on a
  phone, one row from `@xl` that scrolls sideways instead of wrapping. The full list keeps
  the wrapping grid on its own page.
- Keep DOM order equal to reading order and place tiles with spans, not `order`.
- Card grids: `grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))]`.
- Vary tile size and weight by importance (D-027): one filled tile per dashboard, flat
  tinted tiles for collections, white panels for lists. Titles use `text-card-title`,
  details `text-body`.

### C-019 · No decoration (D-037)
- No gradients, eyebrows, uppercase or letter-spaced labels, status dots, colored side or
  top lines on cards and toasts, `backdrop-blur`, or keyframe animation (pulse, ping,
  bounce, entrances). `npm run style:check` fails on them.
- Cards are flat: `border border-line bg-surface`, no shadow. Only overlays (menus,
  dialogs, popovers, toasts) use `shadow-popover`.
- Status is an icon with text or a tinted `Badge`, never a dot or a stripe alone.
- Text over an image sits on a solid panel. Skeletons are static and appear after 300 ms.
- Motion is limited to 150 ms color and opacity transitions and the button spinner.

### C-020 · One dashboard layout (D-066)
- Every role's dashboard is `DashboardHeader` (date line, greeting h1, page controls), then a
  focus row (`FocusTile` + `SummaryStrip`), then `Panel`s. Do not hand-build a hero, a stat card,
  or a metric card.
- One `FocusTile` per dashboard. Controls on it add `onFillFocus` (L-099); text on it is white or
  `primary-100`.
- Dashboard lists are `RowList` + `ListRow`. The lead is `IconTile`, `InitialsAvatar`, or
  `DateTile`; dates beside items always use `DateTile`. A row with `onOpen` is one button;
  otherwise it is read-only (C-015).
- A switch between views of the same page is `SegmentedControl` (filters stay `FilterChip`).

