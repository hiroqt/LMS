import { BookOpen, CalendarDays, House, ListChecks, Megaphone, RotateCcw, Search } from "lucide-react";
import { HelpSupport } from "../../shared/components/HelpSupport";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { NotificationsPopover } from "../../shared/components/NotificationsPopover";
import { ProfileMenu } from "../../shared/components/ProfileMenu";
import { TopbarSearch } from "../../shared/components/TopbarSearch";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { SidebarGroup } from "../../shared/layout/SidebarGroup";
import { formatDue } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";
import { Dialog, DialogContent, DialogTrigger } from "../../shared/ui/Dialog";
import { IconButton } from "../../shared/ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../shared/ui/Skeleton";
import { Toaster } from "../../shared/ui/toast/Toaster";
import { courseCode, STUDENT } from "./api/catalog";
import { resetProgress } from "./api/progressStore";
import { dueSoon, searchWorkspace } from "./api/selectors";
import { toneFor } from "../../shared/lib/tones";
import { useSharedDataSync } from "./hooks/useStudentCatalog";
import { useWorkspace } from "./hooks/useWorkspace";
import TodayPage from "./pages/TodayPage";
import { studentPaths } from "./paths";
import { StudentSessionContext, type StudentSession } from "./studentContext";

// Today loads with the app; other screens load on first visit (smaller first download).
const TasksPage = lazy(() => import("./pages/TasksPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const ClassPage = lazy(() => import("./pages/ClassPage"));
const AssessmentPage = lazy(() => import("./pages/AssessmentPage"));
const QuizPage = lazy(() => import("./pages/QuizPage"));
const ResultPage = lazy(() => import("./pages/ResultPage"));
const MaterialPage = lazy(() => import("./pages/MaterialPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));

export interface RoleAppProps {
  onNavigateRole: (role: string) => void;
}

// "Main navigation" and "My classes" keep the classic landmark names (D-013).
const nav: NavItem[] = [
  { id: "today", label: "Dashboard", icon: <House /> },
  { id: "classes", label: "My Classes", shortLabel: "Classes", icon: <BookOpen /> },
  { id: "tasks", label: "Tasks & Assessments", shortLabel: "Tasks", icon: <ListChecks /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays /> },
  { id: "news", label: "News & Announcements", shortLabel: "News", icon: <Megaphone /> },
];

function sectionOf(pathname: string): string {
  const [, , section] = pathname.split("/");
  if (section === "tasks" || section === "calendar" || section === "news") return section;
  if (section === "classes" || section === "materials") return "classes";
  if (section === "assessments") return "tasks";
  return "today";
}

function ScreenLoading() {
  return (
    <SkeletonGroup label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </SkeletonGroup>
  );
}

/** Root of the rebuilt Student UI (Phase 2). */
export default function StudentApp({ onNavigateRole }: RoleAppProps) {
  useSharedDataSync();
  const navigate = useNavigate();
  const location = useLocation();
  const { catalog, completed, now } = useWorkspace();
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());

  const resetDemo = useCallback(() => {
    resetProgress();
    setReviewed(new Set());
    navigate(studentPaths.today);
  }, [navigate]);

  const session = useMemo<StudentSession>(
    () => ({
      reviewed,
      toggleReviewed: (id) => setReviewed((current) => new Set(current.has(id) ? [...current].filter((item) => item !== id) : [...current, id])),
      resetDemo,
    }),
    [reviewed, resetDemo],
  );

  const active = sectionOf(location.pathname);
  const go = (id: string) =>
    navigate(id === "today" ? studentPaths.today : id === "tasks" ? studentPaths.tasks() : id === "classes" ? studentPaths.classes : id === "news" ? studentPaths.news : studentPaths.calendar());
  const currentClass = location.pathname.startsWith("/student/classes/") ? decodeURIComponent(location.pathname.split("/")[3] ?? "") : "";

  const [mobileSearch, setMobileSearch] = useState(false);
  const searchField = (autoFocus = false) => (
    <TopbarSearch
      label="Search student workspace"
      autoFocus={autoFocus}
      search={(query) => searchWorkspace(query, catalog)}
      onSelect={(result) => {
        setMobileSearch(false);
        if (result.target === "class") navigate(studentPaths.classPage(result.id));
        else if (result.target === "material") navigate(studentPaths.material(result.id));
        else navigate(studentPaths.assessment(result.id));
      }}
    />
  );
  const search = searchField();

  const myClasses = (collapsed: boolean) => (
    <nav aria-label="My classes">
      <SidebarGroup label="My classes" icon={<BookOpen />} count={catalog.courses.length} collapsed={collapsed} storageKey="tmcc-sidebar-classes-open:student">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {catalog.courses.map((course, index) => (
          <li key={course.id}>
            <button
              type="button"
              aria-label={course.name}
              title={collapsed ? course.name : undefined}
              aria-current={currentClass === course.id ? "page" : undefined}
              onClick={() => navigate(studentPaths.classPage(course.id))}
              className={cn(
                "flex min-h-touch w-full items-center gap-3 rounded-control border-0 py-1.5 text-left font-sans focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                collapsed ? "justify-center px-0" : "px-3",
                currentClass === course.id ? "bg-primary-100" : "bg-transparent hover:bg-primary-50",
              )}
            >
              <span aria-hidden className={cn("w-14 shrink-0 rounded-chip py-0.5 text-center text-body font-semibold tracking-code tabular-nums", toneFor(index))}>{courseCode(course)}</span>
              <span className={collapsed ? "sr-only" : "flex min-w-0 flex-col"}>
                <span className="truncate text-body font-medium text-ink">{course.name}</span>
                <span className="truncate text-body text-muted">{course.section}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      </SidebarGroup>
    </nav>
  );

  return (
    <Toaster>
      <StudentSessionContext.Provider value={session}>
        <AppShell
          roleLabel="Student"
          navLabel="Main navigation"
          nav={nav}
          activeId={active}
          onNavigate={go}
          mobileNav="bottom"
          pageKey={location.pathname}
          sidebarExtra={myClasses}
          sidebarFooter={(collapsed) => <HelpSupport collapsed={collapsed} />}
          topbarActions={
            <>
              <div className="hidden w-80 md:block">{search}</div>
              <Dialog open={mobileSearch} onOpenChange={setMobileSearch}>
                <DialogTrigger asChild>
                  <IconButton label="Search" className="md:hidden"><Search /></IconButton>
                </DialogTrigger>
                <DialogContent title="Search">{searchField(true)}</DialogContent>
              </Dialog>
              {/* Phones reach the calendar from the bottom bar; this keeps the top bar within 320px. */}
              <IconButton label="Academic calendar" className="hidden md:inline-flex" onClick={() => navigate(studentPaths.calendar())}><CalendarDays /></IconButton>
              <NotificationsPopover
                heading="Coming up"
                emptyText="You’re all caught up."
                items={dueSoon(catalog.assessments, completed, now).map((item) => ({ id: item.id, title: item.title, meta: `Due ${formatDue(item.dueAt)}` }))}
                onSelect={(item) => navigate(studentPaths.assessment(item.id))}
              />
              <ProfileMenu
                name={STUDENT.name}
                subtitle={`${STUDENT.program} · Student`}
                currentRole="student"
                onSwitchRole={onNavigateRole}
                actions={[{ label: "Reset demo data", icon: <RotateCcw />, onSelect: resetDemo }]}
              />
            </>
          }
        >
          <Suspense fallback={<ScreenLoading />}>
            <Routes>
              <Route path="student/tasks" element={<TasksPage />} />
              <Route path="student/calendar" element={<CalendarPage />} />
              <Route path="student/classes" element={<ClassesPage />} />
              <Route path="student/classes/:classId" element={<ClassPage />} />
              <Route path="student/assessments/:assessmentId" element={<AssessmentPage />} />
              <Route path="student/assessments/:assessmentId/quiz" element={<QuizPage />} />
              <Route path="student/assessments/:assessmentId/result" element={<ResultPage />} />
              <Route path="student/materials/:materialId" element={<MaterialPage />} />
              <Route path="student/news" element={<NewsPage />} />
              {/* /student, /, /student.html, ?role=student, #/student, … all land on Today. */}
              <Route path="*" element={<TodayPage />} />
            </Routes>
          </Suspense>
        </AppShell>
      </StudentSessionContext.Provider>
    </Toaster>
  );
}
