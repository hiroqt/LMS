# Repository Guidelines

## UI revamp and shared memory (read first)

The Student and Instructor UIs were rebuilt in phases (`docs/UI_REVAMP_PLAN.md`) and cut over on 2026-11-17 (D-021): they are the only Student and Instructor UIs. Revamp v2 (`docs/UI_REVAMP_V2_PLAN.md`, D-037) removes decoration everywhere (no gradients, eyebrows, pulse animations, status dots, or side lines on cards; `npm run style:check`) and rebuilds Admin on the same shared system. Admin was rebuilt in `src/features/admin` (D-038).

- **Before UI work**, read `docs/ui-memory/CONVENTIONS.md`, skim `docs/ui-memory/DECISIONS.md` and `LEARNINGS.md`, and check `docs/ui-memory/generated/components.md` for something to reuse. The checklist is `.agents/skills/ui-memory/SKILL.md`.
- **In the same PR**, record what you learned (`LEARNINGS.md`) and any choice others must follow (`DECISIONS.md`), update `FLOW_PARITY.md`, and run `npm run memory:sync`. CI fails when generated memory is stale.
- Every spec in `e2e/` must keep passing. They encode the journeys in the role flow documents; change one only with a DECISIONS entry explaining why the journey changed.
- Browse the design system at `/ui-kit`. Run `docs/ui-memory/SCREEN_READER_CHECKLIST.md` with a person after big UI changes.

## Project Structure & Module Organization

This is a React 19 + Vite frontend in TypeScript (adopted file by file; legacy files are `.jsx`). Two ASP.NET Core services sit beside it: `../isms-api` (read-only ISMS API guarded by API-client keys and permissions) and `../server` (the LMS API, which reads ISMS only through that API and stores LMS data in MySQL). The Student and Instructor workspaces read and write through the LMS API (D-032); Admin keeps fictional, browser-local demo data.

- `src/main.tsx` mounts `src/app/providers` (TanStack Query) and `src/app/router` (React Router). The router resolves `/student`, `/instructor`, and `/admin` with `app/router/roleRouter.js`, which keeps every legacy URL form working (D-004).
- New code goes in `src/features/<role>/<feature>` and `src/shared/{ui,layout,components,hooks,lib,api,styles}`. See `docs/ui-memory/CONVENTIONS.md` (C-001).
- Admin: `src/features/admin` (screens on `AppShell` and `shared/ui`; browser-local data modules in `features/admin/data`).
- Styles: `src/shared/styles/tailwind.css` (Tailwind v4 with preflight, the tokens, and page base styles; D-039) and `fonts.css` (self-hosted Poppins). There is no other stylesheet.
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
- Admin dashboard layout (D-038): a page heading with the quick actions under it, four metric cards that open their directory, then a wide course-activity panel with supporting panels and a recent-activity table. Charts are plain bars with the number on each bar. The no-decoration rules (C-019) win over older references such as `.agents/skills/admin-dashboard-design/SKILL.md`.
- Every role uses `src/shared/layout/AppShell`: the same brand, navigation rows, active state, collapse behavior, top-bar search, and phone drawer (Student uses the bottom bar).
- Type scale by purpose (rebuilt screens, decision D-005): page headings 28px on desktop and 24px on phones, section headings 20px, card titles 16px, body and metadata at least 14px,. Nothing is smaller than 14px and nothing is uppercase (C-019). Inputs use 16px.
- Keep dashboards calm and scannable: one clear page heading, a focused hero, simple metric cards with one useful supporting line, and consistent panel spacing. Remove duplicate headings and decorative status badges that repeat nearby information.
- Keep management screens on one directory pattern: page heading and prominent primary action first; search and clearly labeled filters together in a standalone toolbar; records in a padded, rounded card; pagination directly below the records. Use filters that correspond to real record fields and reset to page one when the search or filters change.
- Admin navigation (D-038): Overview, then plain section labels (`NavItem.group`) for Courses, People and access, Oversight, and System (Academic terms, Settings). Every destination is one click away; there are no expanding categories. Use tabs when a destination combines related directories.
- Make primary actions and filter controls at least 42px high (44px, `min-h-touch`, on rebuilt screens). On narrow screens, stack actions and filters, keep tables horizontally scrollable, preserve row/action spacing, and verify the navigation drawer and all controls remain usable.
- Do not shrink text to fit dense role screens. Adjust wrapping, spacing, or responsive layout first. The Student and Instructor UIs are being rebuilt by the revamp plan; keep their flows identical (proven by `e2e/`) while the visuals change.
- The Admin dashboard search must use real workspace records; dashboard summaries and charts must retain their existing browser-local sources, scope controls, sample-data labels, accessibility, and reduced-motion behavior.
- On the Admin dashboard, System activity, Student activity, and Students share equal columns on wide screens and stack on narrow ones.

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

Keep demo data fictional. There is no sign-in yet: Student and Instructor send a demo identity the LMS API accepts only in Development and Demo mode. Never commit real student or employee records, API keys, or connection strings: keys and passwords live in user-secrets or environment variables, and the stand-in ISMS database in `../isms-api/db` and the Demo-mode seed hold invented people only. Run the browser tests with the .NET SDK installed: Playwright starts the LMS API in Demo mode (`playwright.config.ts`).
