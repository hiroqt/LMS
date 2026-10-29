# Codebase map

## Active three-role prototype

- `src/main.jsx` — routes `/student`, `/instructor`, and `/admin` to each role workspace.
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

- `src/App.jsx`, `src/data.js`, `src/App.css`, `src/Details.css`, and `public/*-banner.jpg` remain from the earlier, richer GClass student prototype. They are not imported by the active `src/main.jsx` entry point. The role prototype reuses its Poppins/soft-green/card visual direction and the local SVG icon set.
