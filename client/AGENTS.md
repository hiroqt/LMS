# Repository Guidelines

## UI revamp and shared memory (read first)

The Student and Instructor UIs were rebuilt in phases (`docs/UI_REVAMP_PLAN.md`) and cut over on 2026-11-17 (D-021): they are the only Student and Instructor UIs. Admin is out of scope and keeps its current UI.

- **Before UI work**, read `docs/ui-memory/CONVENTIONS.md`, skim `docs/ui-memory/DECISIONS.md` and `LEARNINGS.md`, and check `docs/ui-memory/generated/components.md` for something to reuse. The checklist is `.agents/skills/ui-memory/SKILL.md`.
- **In the same PR**, record what you learned (`LEARNINGS.md`) and any choice others must follow (`DECISIONS.md`), update `FLOW_PARITY.md`, and run `npm run memory:sync`. CI fails when generated memory is stale.
- Every spec in `e2e/` must keep passing. They encode the journeys in the role flow documents; change one only with a DECISIONS entry explaining why the journey changed.
- Browse the design system at `/ui-kit`. Run `docs/ui-memory/SCREEN_READER_CHECKLIST.md` with a person after big UI changes.

## Project Structure & Module Organization

This is a React 19 + Vite frontend in TypeScript (adopted file by file; legacy files are `.jsx`). The backend is ASP.NET Core in `../server` and is not wired to the UI yet; data is fictional and browser-local.

- `src/main.tsx` mounts `src/app/providers` (TanStack Query) and `src/app/router` (React Router). The router resolves `/student`, `/instructor`, and `/admin` with the legacy `roles/shared/roleRouter.js` parser.
- New code goes in `src/features/<role>/<feature>` and `src/shared/{ui,layout,components,hooks,lib,api,styles}`. See `docs/ui-memory/CONVENTIONS.md` (C-001).
- Admin (legacy, unchanged): `src/roles/admin`, its shell `src/roles/shared/RoleWorkspace.jsx` (+ `shellCompat.css`), `src/components/shared`, `src/icons.jsx`, and `src/index.css`. Shared data modules live in `src/roles/shared/*.js` and `src/data.js`.
- Styles: `src/shared/styles/tailwind.css` (Tailwind v4 tokens, no preflight yet) and `fonts.css` (self-hosted Poppins), then the legacy `src/index.css`, `App.css`, and `Details.css`.
- `e2e/`: Playwright flow-parity specs. `public/`: static assets. Project scope and data flow: `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/CODEBASE_MAP.md`, and the role flow docs.

## Build, Test, and Development Commands

- `npm install` installs dependencies from the lockfile.
- `npm run dev` starts the local Vite development server.
- `npm run build` creates the static production build in `dist/`.
- `npm run preview` serves the built output locally.
- `npm run lint` runs Oxlint with the repository's React rules.
- `npm run typecheck` runs `tsc --noEmit` (strict).
- `npm test` runs `test:unit` (legacy `node:test` files and Vitest) and then `test:e2e` (Playwright: desktop Chromium, iPhone WebKit, Pixel Chromium). Run `npx playwright install chromium webkit` once. Set `E2E_PREVIEW=1` to test the production build.
- `npm run memory:sync` regenerates `docs/ui-memory/generated/`; `npm run memory:check` verifies it.
- `npm run budget` (after `build`) checks gzip sizes against the performance budget. Offline and Slow 3G specs run only with `E2E_PREVIEW=1` (production build with the service worker).

Before opening a PR, run lint, typecheck, test, build, budget, and memory:check.

## Coding Style & Naming Conventions

Use React function components and hooks. New files are TypeScript and follow `docs/ui-memory/CONVENTIONS.md`: feature folders, Tailwind utilities over design tokens (no hex values or pixel font sizes in components), and hooks in their own files. In legacy files, match the surrounding quote and semicolon style. Use two-space indentation, PascalCase for components, and camelCase for functions and variables.

## Dashboard Design and Typography

- Keep one visual system across all roles: Poppins, warm white canvas, soft green surfaces, rounded cards, restrained accent colors, and consistent spacing, type scale, focus rings, and button heights. For rebuilt Student and Instructor screens, the design tokens in `src/shared/styles/tailwind.css` are the source of truth.
- For Admin dashboard layout, follow `.agents/skills/admin-dashboard-design/SKILL.md` and the user-provided Ember dashboard screenshot from 2026-10-29: brand and search at the top of the left sidebar, grouped navigation below, large reporting heading, metric-specific illustrated cards, and a wide primary chart with supporting charts. Match each card illustration to its metric. Copy the information hierarchy and layout only. Keep the LMS palette and TMCC identity; never copy the reference's dark palette, brand, or financial imagery.
- Admin navigation stays in the legacy `RoleWorkspace` shell (Student and Instructor use `src/shared/layout/AppShell`). Preserve its active state, brand, navigation height, collapse behavior, and mobile drawer. Admin may place the existing GlobalSearch inside the sidebar beneath the brand; keep Instructor search in the top bar.
- Type scale by purpose (rebuilt screens, decision D-005): page headings 28px on desktop and 24px on phones, section headings 18px, card titles 15px, body and metadata at least 14px, and 12px only for brief uppercase labels. Inputs use 16px. Admin keeps its current scale until it is revamped.
- Keep dashboards calm and scannable: one clear page heading, a focused hero, simple metric cards with one useful supporting line, and consistent panel spacing. Remove duplicate headings and decorative status badges that repeat nearby information.
- Keep management screens on one directory pattern: page heading and prominent primary action first; search and clearly labeled filters together in a standalone toolbar; records in a padded, rounded card; pagination directly below the records. Use filters that correspond to real record fields and reset to page one when the search or filters change.
- Use the same sidebar group, navigation row height, active state, collapse behavior, and mobile drawer across Instructor and Admin. Admin navigation prioritizes Overview, Courses, People & Access, then Oversight; place Academic Terms after those groups and Settings below the Admin workspace footer. Expand a category only when it has multiple destinations; show a single destination directly. Open the selected multi-page category automatically and allow multiple categories to stay open. Keep navigation text readable; use tabs when a destination combines related directories.
- Make primary actions and filter controls at least 42px high (44px, `min-h-touch`, on rebuilt screens). On narrow screens, stack actions and filters, keep tables horizontally scrollable, preserve row/action spacing, and verify the navigation drawer and all controls remain usable.
- Do not shrink text to fit dense role screens. Adjust wrapping, spacing, or responsive layout first. The Student and Instructor UIs are being rebuilt by the revamp plan; keep their flows identical (proven by `e2e/`) while the visuals change.
- The Admin dashboard search must use real workspace records; dashboard summaries and charts must retain their existing browser-local sources, scope controls, sample-data labels, accessibility, and reduced-motion behavior.
- Keep the wide primary Admin chart distinct from its supporting analytics row. At desktop sizes, System Activity, Student Activity, and student breakdown cards share equal columns, aligned heights, and similarly sized chart areas. On narrow screens, stack them at full width and keep the chart areas similarly sized.

## Admin System Administration boundaries

- Keep system settings, academic terms, the demo role matrix, and audit records in the shared browser-local LMS data. These are prototype controls, not institution-wide services.
- The role matrix is display-only and must not be presented as enforced authorization. The scheduled-backup card is a mock; only an explicit Create backup or Reset Demo action writes a snapshot.
- Keep audit records metadata-only: actor, role, category, action, target, timestamp, and short summary. Never copy answers, submission text, comments, or feedback into logs. Do not invent timestamps or historical actors.
- Before Reset Demo clears active LMS data, persist a full snapshot in the separate backup key. Abort reset if storing the snapshot fails.
- Keep audit pagination visible at all result counts, including an empty or single-page result. Keep filters together above the table and make the table horizontally scrollable on narrow screens.

## Testing Guidelines

- `e2e/*-flow.spec.ts` encode the Student and Instructor flow charts. Rebuilt screens must pass them unchanged. Select by role and accessible name only; the clock is pinned to the seed's "today" (`e2e/fixtures.ts`); an uncaught page error fails a test.
- Tag phone-only journeys `@mobile` and every-device checks `@all`.
- Write Vitest tests beside new code (`*.test.ts(x)`). Legacy `*.test.js` use `node:test`.
- Make sure every new test can fail: check it once against a broken version.
- Also verify interaction changes in the browser at phone and desktop widths. Do not describe a manual check as an automated test.

## Commits & Pull Requests

Use Conventional Commit subjects with a scope (`feat(student): …`, `fix(instructor): …`, `test: …`, `docs(ui-memory): …`), one logical change per commit. Pull requests follow `.github/pull_request_template.md`: the user-visible change, validation commands and results, screenshots for visual changes, and the Memory section.

## Scope & Configuration

Keep demo data fictional and browser-local. The prototype has no authentication or server persistence; do not add real student records or credentials. Quiz state uses localStorage, so changes to its key or shape can affect saved browser progress.
