# Conventions

Rules for rebuilt UI code. Each is short enough to check in review. New rules are promoted
from [`LEARNINGS.md`](LEARNINGS.md) (see the loop in [`README.md`](README.md)).

### C-001 · Folders and imports
- `src/app`: providers, router, layouts. `src/features/<role>/<feature>`: screens and
  their `components/`, `hooks/`, `api/`, `types.ts`, `index.ts`. `src/shared`: `ui/`
  (design system), `layout/`, `components/`, `hooks/`, `lib/`, `api/`, `styles/`.
- `features` may import `shared`. `shared` never imports `features`. A feature imports
  another feature only through its `index.ts`.
- Do not add to legacy files (`App.jsx`, `roles/**`, `components/shared/**`). Rebuild
  the piece under `features/` or `shared/` instead.

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
- Body text is `text-body` (14px) or larger. `text-label` is only for short uppercase
  eyebrows. Green text is `text-primary-700` or darker.
- Interactive controls are at least `min-h-touch` (44px) tall.

### C-004 · Accessibility is part of done
- Every control has a visible label or an accessible name. Icon-only buttons need
  `aria-label`.
- Use the design-system primitives for dialogs, menus, tabs, and popovers. Do not
  hand-roll focus management.
- Respect `prefers-reduced-motion`. Never rely on color alone for status.
- Each page has one `h1`; focus moves to it on route change.

### C-005 · Base styles while preflight is off
Until cutover (D-003), rebuilt components set their own base styles: `font-sans`, a text
color, `m-0` on headings and paragraphs, `list-none p-0` on lists, and `border-0
bg-transparent` on bare buttons. Do not rely on legacy `index.css` element rules.
Utilities win over those rules because they are `!important` (D-010), so never add
`!important` by hand.

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

