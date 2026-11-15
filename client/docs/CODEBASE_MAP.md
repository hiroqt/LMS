# Codebase map

## Active three-role prototype

- `src/main.tsx` — mounts `src/app/providers/AppProviders.tsx` (TanStack Query client tuned for slow connections) and `src/app/router/AppRouter.tsx` (React Router), which resolves `/student`, `/instructor`, and `/admin` through `roles/shared/roleRouter.js` so legacy URL forms keep working.
- `src/shared/styles/` — `tailwind.css` (Tailwind v4 design tokens, no preflight yet, scanning only `app/`, `shared/`, `features/`), `fonts.css` (self-hosted Poppins), and `tokens.test.ts` (WCAG contrast checks).
- `src/shared/ui` — design-system primitives (Button, Field, Dialog, Tabs, Menu, Card, Badge, EmptyState, Skeleton, Toaster); reference page at `/ui-kit` (`src/features/design-system`).
- `src/shared/layout` — `AppShell` (sidebar, Student bottom bar, Instructor drawer, skip link, connection banner, focus on navigation) and `PageHeader`. `src/shared/hooks` — `useNetworkStatus`, `useMediaQuery`.
- `src/features/student/StudentApp.tsx`, `src/features/instructor/InstructorApp.tsx` — roots of the rebuilt UIs, shown with `?ui=new` (`src/app/router/useUiVersion.ts`, `src/shared/lib/uiVersion.ts`). Screens not rebuilt yet show `src/app/migration/RebuildNotice.tsx`.
- `e2e/` — Playwright flow-parity, routing, platform, and accessibility-baseline specs (`playwright.config.ts`).
- `docs/ui-memory/` — shared revamp memory: decisions, conventions, learnings, flow-parity status, and generated inventories (`scripts/memory-sync.ts`).
- `src/roles/student/StudentWorkspace.jsx` — mounts the existing student dashboard without changing its layout or navigation.
- `src/roles/shared/RoleWorkspace.jsx` / `.css` — shared responsive Instructor/Admin shell, collapsible sidebar, mobile drawer, and role switching.
- `src/components/shared/` — reusable avatar, breadcrumbs, global search, and notifications used by Student, Instructor, and Admin.
- `src/roles/shared/lmsData.js` / `storage.js` — ERD-shaped fictional records and browser-local shared state.
- `src/roles/admin/Admin.jsx`, `AdminDirectory.jsx`, `AdminOverview.jsx`, `AdminSystemConfiguration.jsx`, `AdminAcademicTerms.jsx`, `AdminRoleManagement.jsx`, `AdminAuditLogs.jsx`, `AdminReports.jsx`, `adminDashboardData.js`, `pagination.js`, and admin CSS — shared-shell System Administration group, local settings and backups, academic terms, demo permission matrix, metadata-only paginated audit history, CSV exports, and the Admin overview with sidebar search, illustrated KPI cards, one wide chart, and aligned supporting charts. Its layout reference is documented in `.agents/skills/admin-dashboard-design/SKILL.md`.
- `src/roles/instructor/Instructor.jsx` / `InstructorClassroom.jsx` — assigned-class sidebar dropdown, year filters, Student-style classroom tabs, per-class grading, and category settings; `InstructorAcademicCalendar.jsx` and `InstructorDashboardNews.jsx` provide the Overview calendar and announcements views.
- `src/App.jsx`, `src/App.css`, `src/Details.css`, `src/data.js` — existing Student dashboard and its assessment/material flows; role-created classrooms, exams, materials, and instructor announcements appear in Student class streams.
- `docs/PROJECT_BRIEF.md` / `docs/ARCHITECTURE.md` — experience requirements, data flow, ERD mapping, and boundaries.
- `docs/lms-erd.png` — supplied LMS database schema reference.

## Earlier student-only prototype

- `src/App.jsx`, `src/data.js`, `src/App.css`, `src/Details.css`, and `public/*-banner.jpg` come from the earlier GClass student prototype. `StudentWorkspace.jsx` still mounts `App.jsx`, so this is the live Student UI until the revamp replaces it. The role prototype reuses its Poppins/soft-green/card visual direction and the local SVG icon set.
