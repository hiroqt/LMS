# Repository Guidelines

## Project Structure & Module Organization

This is a frontend-only React 19 prototype built with Vite. `src/App.jsx` contains the student workspace UI and interactions; `src/data.js` holds fictional classes, students, materials, assessments, and questions. Global styling is in `src/index.css`, with workspace and detail styles in `src/App.css` and `src/Details.css`. `public/` contains static assets. Project scope and data flow are documented in `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, and `docs/CODEBASE_MAP.md`. There is no test directory or backend.

## Build, Test, and Development Commands

- `npm install` installs dependencies from the lockfile.
- `npm run dev` starts the local Vite development server.
- `npm run build` creates the static production build in `dist/`.
- `npm run preview` serves the built output locally.
- `npm run lint` runs Oxlint with the repository's React rules.

No automated test script is configured. Run lint and build when validating a change; check interactive flows in the browser when UI behavior changes.

## Coding Style & Naming Conventions

Use the existing React function-component and hooks patterns. Keep components and data in the current modules unless a feature makes a separate file necessary. Match the surrounding file's JavaScript quote and semicolon style (the source currently has both single- and double-quoted files); use two-space indentation. Use PascalCase for React components, camelCase for functions and variables, and descriptive CSS class names consistent with the existing styles. Run `npm run lint` before submitting.

## Dashboard Design and Typography

- Treat the Student dashboard in `src/App.jsx` and `src/App.css` as the visual source for Instructor. Keep one visual system across all roles: Poppins, warm white canvas, soft green surfaces, rounded cards, restrained accent colors, and consistent spacing, type scale, focus rings, and button heights.
- For Admin dashboard layout, follow `.agents/skills/admin-dashboard-design/SKILL.md` and the user-provided Ember dashboard screenshot from 2026-10-29: brand and search at the top of the left sidebar, grouped navigation below, large reporting heading, metric-specific illustrated cards, and a wide primary chart with supporting charts. Match each card illustration to its metric. Copy the information hierarchy and layout only. Keep the LMS palette and TMCC identity; never copy the reference's dark palette, brand, or financial imagery.
- Keep Instructor and Admin navigation in the shared `RoleWorkspace` shell. Preserve its shared active state, brand, navigation height, collapse behavior, and mobile drawer. Admin may place the existing GlobalSearch inside the sidebar beneath the brand; keep Instructor search in the top bar.
- Match the Student type scale by purpose: page and welcome headings about 28px on desktop, section headings about 17px, card titles about 13px, body copy about 12px, and readable metadata about 10–11px. Reserve smaller type for brief uppercase labels only.
- Keep dashboards calm and scannable: one clear page heading, a focused hero, simple metric cards with one useful supporting line, and consistent panel spacing. Remove duplicate headings and decorative status badges that repeat nearby information.
- Keep management screens on one directory pattern: page heading and prominent primary action first; search and clearly labeled filters together in a standalone toolbar; records in a padded, rounded card; pagination directly below the records. Use filters that correspond to real record fields and reset to page one when the search or filters change.
- Use the same sidebar group, navigation row height, active state, collapse behavior, and mobile drawer across Instructor and Admin. Admin keeps Overview and Academic Term Configuration as main links, with Oversight, People & Access, and Courses as categories; place Settings below the Admin workspace footer. Expand a category only when it has multiple destinations; show a single destination directly. Open the selected multi-page category automatically and allow multiple categories to stay open. Keep navigation text readable; use tabs when a destination combines related directories.
- Make primary actions and filter controls at least 42px high. On narrow screens, stack actions and filters, keep tables horizontally scrollable, preserve row/action spacing, and verify the navigation drawer and all controls remain usable.
- Do not shrink text to fit dense role screens. Adjust wrapping, spacing, or responsive layout first. Keep the Student reference unchanged unless the user explicitly asks to change it.
- The Admin dashboard search must use real workspace records; dashboard summaries and charts must retain their existing browser-local sources, scope controls, sample-data labels, accessibility, and reduced-motion behavior.
- Keep the wide primary Admin chart distinct from its supporting analytics row. At desktop sizes, System Activity, Student Activity, and student breakdown cards share equal columns, aligned heights, and similarly sized chart areas. On narrow screens, stack them at full width and keep the chart areas similarly sized.

## Admin System Administration boundaries

- Keep system settings, academic terms, the demo role matrix, and audit records in the shared browser-local LMS data. These are prototype controls, not institution-wide services.
- The role matrix is display-only and must not be presented as enforced authorization. The scheduled-backup card is a mock; only an explicit Create backup or Reset Demo action writes a snapshot.
- Keep audit records metadata-only: actor, role, category, action, target, timestamp, and short summary. Never copy answers, submission text, comments, or feedback into logs. Do not invent timestamps or historical actors.
- Before Reset Demo clears active LMS data, persist a full snapshot in the separate backup key. Abort reset if storing the snapshot fails.
- Keep audit pagination visible at all result counts, including an empty or single-page result. Keep filters together above the table and make the table horizontally scrollable on narrow screens.

## Testing Guidelines

There is no test framework, test script, or stated coverage requirement. For interaction changes, manually verify the affected path, including refresh persistence if quiz state is involved. Do not describe a manual check as an automated test.

## Commits & Pull Requests

Git history is unavailable in this checkout, so no established commit convention could be confirmed. Use a concise imperative commit subject (for example, `Improve quiz navigation`). Pull requests should explain the user-visible change, list validation commands and results, and include screenshots for visual changes. Link related issues when applicable.

## Scope & Configuration

Keep demo data fictional and browser-local. The prototype has no authentication or server persistence; do not add real student records or credentials. Quiz state uses localStorage, so changes to its key or shape can affect saved browser progress.
