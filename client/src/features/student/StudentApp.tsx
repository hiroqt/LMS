import { BookOpen, CalendarDays, CloudOff, House, ListChecks, Megaphone, Search } from "lucide-react";
import { HelpSupport } from "../../shared/components/HelpSupport";
import { lazy, Suspense, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { NotificationsPopover } from "../../shared/components/NotificationsPopover";
import { ProfileMenu } from "../../shared/components/ProfileMenu";
import { TopbarSearch } from "../../shared/components/TopbarSearch";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { SidebarGroup } from "../../shared/layout/SidebarGroup";
import { formatDue } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";
import { Dialog, DialogContent, DialogTrigger } from "../../shared/ui/Dialog";
import { describeApiError } from "../../shared/api/http";
import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../shared/ui/Skeleton";
import { Toaster } from "../../shared/ui/toast/Toaster";
import { courseCode, STUDENT_SUBTITLE } from "./api/catalog";
import { dueSoon, searchWorkspace } from "./api/selectors";
import { toneFor } from "../../shared/lib/tones";
import { useStudentOverview, useStudentPeople } from "./hooks/useStudentCatalog";
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

function ScreenLoading({ label = "Loading" }: { label?: string }) {
  return (
    <SkeletonGroup label={label} className="flex flex-col gap-4">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </SkeletonGroup>
  );
}

function Workspace({ onNavigateRole }: RoleAppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { catalog, completed, now } = useWorkspace();

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
              <span aria-hidden className={cn("w-14 shrink-0 rounded-chip py-0.5 text-center text-body font-semibold tabular-nums", toneFor(index))}>{courseCode(course)}</span>
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
    <>
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
              <ProfileMenu name={catalog.me.name} subtitle={STUDENT_SUBTITLE} currentRole="student" onSwitchRole={onNavigateRole} />
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
    </>
  );
}

const VIEWING_KEY = "tmcc-viewing-student";

function remembered(): string {
  try {
    return sessionStorage.getItem(VIEWING_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Loading and error states before the workspace can render. */
function Gate({ query, label }: { query: { isError: boolean; error: unknown; refetch: () => unknown }; label: string }) {
  if (!query.isError) {
    return (
      // Not a <main> landmark: the page is not ready yet (tests and screen readers wait for main).
      <div aria-busy="true" className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <ScreenLoading label={label} />
      </div>
    );
  }
  const { title, detail } = describeApiError(query.error);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      {/* A whole-page error: its title is the page's heading. */}
      <section aria-labelledby="workspace-error" className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong p-6 text-center">
        <CloudOff aria-hidden className="size-8 text-muted" />
        <h1 id="workspace-error" className="m-0 font-sans text-section font-semibold text-ink">{title}</h1>
        <p className="m-0 max-w-prose text-body text-muted">{detail}</p>
        <Button onClick={() => void query.refetch()}>Try again</Button>
      </section>
    </main>
  );
}

/** Root of the Student UI. Data comes from the LMS API (D-032). */
export default function StudentApp(props: RoleAppProps) {
  const people = useStudentPeople();
  const [chosen, setChosen] = useState(remembered);
  const students = people.data?.students ?? [];
  const studentId = students.some((item) => item.id === chosen) ? chosen : students[0]?.id ?? "";
  const overview = useStudentOverview(studentId);

  const session = useMemo<StudentSession>(
    () => ({
      studentId,
      setStudentId: (id) => {
        setChosen(id);
        try {
          sessionStorage.setItem(VIEWING_KEY, id);
        } catch {
          // Remembering the choice is a convenience only.
        }
      },
    }),
    [studentId],
  );

  if (!people.data) return <Gate query={people} label="Loading the student workspace" />;
  if (!overview.data) return <Gate query={overview} label="Loading your classes" />;

  return (
    <Toaster>
      <StudentSessionContext.Provider value={session}>
        <Workspace {...props} />
      </StudentSessionContext.Provider>
    </Toaster>
  );
}
