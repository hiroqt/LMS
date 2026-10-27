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

- Treat the existing Student dashboard in `src/App.jsx` and `src/App.css` as the visual reference for other roles. Preserve its Poppins font stack (`src/index.css`), soft green surfaces, rounded cards, and restrained accent colors.
- Match the Student dashboard's type scale by purpose: page and welcome headings about 28px on desktop, section headings about 17px, card titles about 13px, and body copy about 12px. Keep metadata readable at roughly 10–11px; reserve smaller type for brief uppercase labels or decorative details only.
- Do not shrink text to fit denser role dashboards. Adjust wrapping, spacing, or responsive layout first, and check desktop and mobile sizes against the Student reference.
- Keep the same font family, weight, color contrast, and text hierarchy across Student, Instructor, and Admin screens. Change the student reference only when the user explicitly requests it.

## Testing Guidelines

There is no test framework, test script, or stated coverage requirement. For interaction changes, manually verify the affected path, including refresh persistence if quiz state is involved. Do not describe a manual check as an automated test.

## Commits & Pull Requests

Git history is unavailable in this checkout, so no established commit convention could be confirmed. Use a concise imperative commit subject (for example, `Improve quiz navigation`). Pull requests should explain the user-visible change, list validation commands and results, and include screenshots for visual changes. Link related issues when applicable.

## Scope & Configuration

Keep demo data fictional and browser-local. The prototype has no authentication or server persistence; do not add real student records or credentials. Quiz state uses localStorage, so changes to its key or shape can affect saved browser progress.
