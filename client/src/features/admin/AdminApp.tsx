import { BookOpen, CalendarDays, ClipboardCheck, FileText, LayoutDashboard, ListChecks, Search, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { HelpSupport } from "../../shared/components/HelpSupport";
import { LogoutButton } from "../../shared/components/LogoutButton";
import { NotificationsPopover, type NotificationItem } from "../../shared/components/NotificationsPopover";
import { ProfileSummary } from "../../shared/components/ProfileSummary";
import { TopbarSearch, type TopbarSearchResult } from "../../shared/components/TopbarSearch";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { Dialog, DialogContent, DialogTrigger } from "../../shared/ui/Dialog";
import { IconButton } from "../../shared/ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../shared/ui/Skeleton";
import { Toaster } from "../../shared/ui/toast/Toaster";
import { AdminContext } from "./adminContext";
import type { AdminData } from "./data/types";
import { useAdminData } from "./hooks/useAdminData";
import { classroomName, fullName } from "./lib/records";
import { adminPaths } from "./paths";
import OverviewPage from "./pages/OverviewPage";

const UsersPage = lazy(() => import("./pages/UsersPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const EnrollmentsPage = lazy(() => import("./pages/EnrollmentsPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

// Every destination is one click away under a plain section label (D-038).
// "admin navigation" keeps the classic landmark name (D-013).
const nav: (NavItem & { path: string })[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard />, path: adminPaths.overview },
  { id: "courses", label: "Course management", icon: <BookOpen />, group: "Courses", path: adminPaths.courses() },
  { id: "enrollments", label: "Enrollments", icon: <ListChecks />, group: "Courses", path: adminPaths.enrollments() },
  { id: "users", label: "User management", icon: <UsersRound />, group: "People and access", path: adminPaths.users() },
  { id: "roles", label: "Role management", icon: <ShieldCheck />, group: "People and access", path: adminPaths.roles },
  { id: "audit", label: "Audit logs", icon: <ClipboardCheck />, group: "Oversight", path: adminPaths.audit },
  { id: "reports", label: "System reports", icon: <FileText />, group: "Oversight", path: adminPaths.reports },
  { id: "terms", label: "Academic terms", icon: <CalendarDays />, group: "System", path: adminPaths.terms },
  { id: "settings", label: "Settings", icon: <Settings />, group: "System", path: adminPaths.settings },
];

function sectionOf(pathname: string): string {
  const [, , section] = pathname.split("/");
  return nav.some((item) => item.id === section) ? (section as string) : "overview";
}

interface SearchResult extends TopbarSearchResult {
  path: string;
}

function searchAdmin(data: AdminData, query: string): SearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const results: SearchResult[] = [
    ...data.users.map((user) => ({ id: user.id, kind: "Person", title: `${fullName(user)} (${user.role})`, path: adminPaths.users() })),
    ...data.subjects.map((subject) => ({ id: subject.id, kind: "Subject", title: `${subject.code} · ${subject.title}`, path: adminPaths.courses("subjects") })),
    ...data.classrooms.map((room) => ({ id: room.id, kind: "Classroom", title: classroomName(data, room.id), path: adminPaths.courses("classrooms") })),
  ];
  return results.filter((item) => `${item.kind} ${item.title}`.toLowerCase().includes(term)).slice(0, 6);
}

/** Setup issues and recent changes, as chosen under Settings → In-app alerts. */
function notificationsFor(data: AdminData): (NotificationItem & { path: string })[] {
  const alerts = data.systemAdministration.settings.notifications;
  const logs = data.systemAdministration.auditLogs;
  const unmatched = data.classrooms.filter((room) => room.status === "active" && !data.enrollments.some((item) => item.classroomId === room.id && item.status === "active")).length;
  const recent = (category: string, path: string) =>
    logs.filter((event) => event.category === category).slice(0, 2).map((event) => ({ id: event.id, title: `${event.action} · ${event.target}`, meta: `${event.actorName} · ${new Date(event.timestamp).toLocaleString()}`, path }));
  return [
    ...(unmatched && alerts.setupIssues ? [{ id: "unmatched-classes", title: `${unmatched} classroom${unmatched === 1 ? "" : "s"} need student enrollment`, meta: "Open Enrollments to add students", path: adminPaths.enrollments() }] : []),
    ...(alerts.userChanges ? recent("users", adminPaths.users()) : []),
    ...(alerts.courseworkActivity ? recent("activity", adminPaths.audit) : []),
  ];
}

function ScreenLoading() {
  return (
    <SkeletonGroup label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-28 w-full" />
    </SkeletonGroup>
  );
}

function Workspace() {
  const navigate = useNavigate();
  const handleLogout = () => navigate("/login");
  const location = useLocation();
  const [data, update] = useAdminData();
  const session = useMemo(() => ({ data, update }), [data, update]);
  const [mobileSearch, setMobileSearch] = useState(false);
  const section = sectionOf(location.pathname);
  const notifications = notificationsFor(data);

  const searchField = (autoFocus = false) => (
    <TopbarSearch
      label="Search admin workspace"
      placeholder="Search people, subjects, classrooms"
      autoFocus={autoFocus}
      search={(query) => searchAdmin(data, query)}
      onSelect={(result) => {
        setMobileSearch(false);
        navigate(result.path);
      }}
    />
  );

  return (
    <AdminContext.Provider value={session}>
      <AppShell
        roleLabel="Admin"
        navLabel="admin navigation"
        nav={nav}
        activeId={section}
        onNavigate={(id) => navigate(nav.find((item) => item.id === id)?.path ?? adminPaths.overview)}
        mobileNav="drawer"
        pageKey={location.pathname}
        sidebarFooter={(collapsed) => (
          <>
            <HelpSupport collapsed={collapsed} />
            <LogoutButton collapsed={collapsed} onLogout={handleLogout} />
          </>
        )}
        topbarStart={
          <nav aria-label="Breadcrumb" className="hidden md:block">
            <ol className="m-0 flex list-none items-center gap-1 p-0 font-sans text-body">
              <li><button type="button" onClick={() => navigate(adminPaths.overview)} className="min-h-touch rounded-control border-0 bg-transparent px-2 text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus">Workspace</button></li>
              <li aria-hidden className="text-muted">›</li>
              <li aria-current="page" className="font-semibold text-ink">{nav.find((item) => item.id === section)?.label}</li>
            </ol>
          </nav>
        }
        topbarActions={
          <>
            <div className="hidden w-80 md:block">{searchField()}</div>
            <Dialog open={mobileSearch} onOpenChange={setMobileSearch}>
              <DialogTrigger asChild>
                <IconButton label="Search" className="md:hidden"><Search /></IconButton>
              </DialogTrigger>
              <DialogContent title="Search">{searchField(true)}</DialogContent>
            </Dialog>
            <NotificationsPopover
              heading="Setup updates"
              emptyText="You’re all caught up."
              items={notifications}
              onSelect={(item) => navigate(notifications.find((entry) => entry.id === item.id)?.path ?? adminPaths.overview)}
            />
            <ProfileSummary name="Taylor Morgan" subtitle="Administrator · Demo" />
          </>
        }
      >
        <Suspense fallback={<ScreenLoading />}>
          <Routes>
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/courses" element={<CoursesPage />} />
            <Route path="admin/enrollments" element={<EnrollmentsPage />} />
            <Route path="admin/roles" element={<RolesPage />} />
            <Route path="admin/audit" element={<AuditPage />} />
            <Route path="admin/reports" element={<ReportsPage />} />
            <Route path="admin/terms" element={<TermsPage />} />
            <Route path="admin/settings" element={<SettingsPage />} />
            {/* /admin, ?role=admin, #/admin, /admin.html … land on Overview. */}
            <Route path="*" element={<OverviewPage />} />
          </Routes>
        </Suspense>
      </AppShell>
    </AdminContext.Provider>
  );
}

/** Root of the Admin UI. Its data is fictional and browser-local (AGENTS.md). */
export default function AdminApp() {
  return (
    <Toaster>
      <Workspace />
    </Toaster>
  );
}
