# Codebase map

## Active three-role prototype

- `src/main.tsx` — mounts `src/app/providers/AppProviders.tsx` (TanStack Query client tuned for slow connections) and `src/app/router/AppRouter.tsx` (React Router), which resolves `/student`, `/instructor`, and `/admin` through `app/router/roleRouter.js` so legacy URL forms keep working; unknown paths get `app/router/UnknownRolePage.tsx`.
- `src/shared/styles/` — `tailwind.css` (Tailwind v4 with preflight, the design tokens, and page base styles; D-039), `fonts.css` (self-hosted Poppins 400/500/600).
- `src/shared/ui` — design-system primitives (Button, Field, Dialog, Tabs, Menu, Card, Badge, EmptyState, Skeleton, Toaster); reference page at `/ui-kit` (`src/features/design-system`).
- `src/shared/layout` — `AppShell` (sidebar, Student bottom bar, Instructor drawer, skip link, connection banner, focus on navigation) and `PageHeader`. `src/shared/hooks` — `useNetworkStatus`, `useMediaQuery`.
- `src/features/student/` — the rebuilt Student UI: `api/` (catalog, selectors, progress store, submissions), `hooks/` (catalog query, progress, quiz clock), `pages/` (Today, Tasks, Calendar, Classes, Class, Assessment, Quiz, Result, Material), `paths.ts` (URLs).
- `src/features/instructor/` — the rebuilt Instructor UI: `api/` (store, selectors, actions, `grading.ts` for exams, `assignmentGrading.ts` for assignments), `pages/` (Overview, Classes, Class with tabs in `pages/class/`, Gradebook, the exam grading page with views in `pages/grading/`, and the assignment grading page with its parts in `pages/assignmentGrading/`: class list, student work, file viewer, grade forms, Return; D-061), `components/` (class card, year filter, Create class dialog), `paths.ts`.
- `src/shared/components/` also holds dashboard pieces both roles use (StatCard, SectionHeading, BackLink, MonthGrid, FeaturedNewsCarousel).
- `e2e/` — Playwright flow-parity, routing, platform, and accessibility-baseline specs (`playwright.config.ts`).
- `docs/ui-memory/` — shared revamp memory: decisions, conventions, learnings, flow-parity status, and generated inventories (`scripts/memory-sync.ts`).
- `src/features/admin/` — the Admin workspace (D-038): `AdminApp.tsx` (shell, routes, search, notifications), `pages/`, `components/` (table, toolbar, pagination, dialogs, dashboard bars), and `data/` (the browser-local, ERD-shaped demo records, audit log, backups, and reports in plain JavaScript, with `types.ts`).
- `docs/PROJECT_BRIEF.md` / `docs/ARCHITECTURE.md` — experience requirements, data flow, ERD mapping, and boundaries.
- `docs/lms-erd.png` — supplied LMS database schema reference.

## Seed data

- `src/data.js` and `public/*-banner.jpg` hold the fictional classes, assessments, questions, materials, school calendar, and featured news. The rebuilt UIs read them through their feature `api/` modules; `features/admin/data/lmsData.js` seeds Admin's browser-local store from them.
