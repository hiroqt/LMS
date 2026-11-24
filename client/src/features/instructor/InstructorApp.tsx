import { BookOpen, CloudOff, GraduationCap, LayoutDashboard, ListChecks, Search } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { HelpSupport } from "../../shared/components/HelpSupport";
import { NotificationsPopover } from "../../shared/components/NotificationsPopover";
import { ProfileMenu } from "../../shared/components/ProfileMenu";
import { TopbarSearch } from "../../shared/components/TopbarSearch";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { SidebarGroup } from "../../shared/layout/SidebarGroup";
import { cn } from "../../shared/lib/cn";
import { toneFor } from "../../shared/lib/tones";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../../shared/ui/Dialog";
import { describeApiError } from "../../shared/api/http";
import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../shared/ui/Skeleton";
import { Toaster } from "../../shared/ui/toast/Toaster";
import { classMark, searchInstructor, subjectOf } from "./api/selectors";
import { useOverview, usePeople } from "./api/store";
import { useInstructorWorkspace } from "./hooks/useInstructorWorkspace";
import { InstructorSessionContext, type InstructorSession } from "./instructorContext";
import { NavigationGuardContext, type NavigationGuard } from "./navigationGuard";
import { instructorPaths } from "./paths";
import OverviewPage from "./pages/OverviewPage";

const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const ClassPage = lazy(() => import("./pages/ClassPage"));
const GradebookPage = lazy(() => import("./pages/GradebookPage"));
const QuestionSetsPage = lazy(() => import("./pages/QuestionSetsPage"));
const QuestionSetPage = lazy(() => import("./pages/QuestionSetPage"));
const ExamGradingPage = lazy(() => import("./pages/ExamGradingPage"));
const AssessmentPreviewPage = lazy(() => import("./pages/AssessmentPreviewPage"));
const AssessmentBuilderPage = lazy(() => import("./pages/AssessmentBuilderPage"));
const AssignmentBuilderPage = lazy(() => import("./pages/AssignmentBuilderPage"));
const AssignmentGradingPage = lazy(() => import("./pages/AssignmentGradingPage"));
const AssignmentPreviewPage = lazy(() => import("./pages/AssignmentPreviewPage"));
const RubricsPage = lazy(() => import("./pages/RubricsPage"));
const RubricPage = lazy(() => import("./pages/RubricPage"));

export interface RoleAppProps {
  onNavigateRole: (role: string) => void;
}

// "instructor navigation" keeps the classic landmark name (D-013).
const nav: NavItem[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
  { id: "gradebook", label: "Gradebook", icon: <GraduationCap /> },
  { id: "question-sets", label: "Question sets", icon: <ListChecks /> },
];

const pageNames: Record<string, string> = { overview: "Overview", classes: "Classes", gradebook: "Gradebook", "question-sets": "Question sets" };

function sectionOf(pathname: string): string {
  const [, , section] = pathname.split("/");
  return section === "classes" || section === "gradebook" || section === "question-sets" ? section : "overview";
}

const navTarget: Record<string, string> = { gradebook: instructorPaths.gradebook(), "question-sets": instructorPaths.questionSets };

function ScreenLoading() {
  return (
    <SkeletonGroup label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-28 w-full" />
    </SkeletonGroup>
  );
}

/** Asks before leaving a page with unsaved changes (the assessment builder, a question set). */
function useNavigationGuard() {
  const routerNavigate = useNavigate();
  const dirtyOwners = useRef(new Set<string>());
  const [pending, setPending] = useState<string | (() => void) | null>(null);
  const go = useCallback((to: string | (() => void)) => (typeof to === "string" ? routerNavigate(to) : to()), [routerNavigate]);
  const guard = useMemo<NavigationGuard>(
    () => ({
      setDirty: (owner, dirty) => {
        if (dirty) dirtyOwners.current.add(owner);
        else dirtyOwners.current.delete(owner);
      },
      navigate: (to) => (dirtyOwners.current.size ? setPending(() => to) : go(to)),
    }),
    [go],
  );
  const leave = () => {
    const to = pending;
    dirtyOwners.current.clear();
    setPending(null);
    if (to !== null) go(to);
  };
  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent
        title="Leave without saving?"
        description="Your changes on this page are not saved. If you leave, they are lost."
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Keep editing</Button></DialogClose>
            <Button variant="danger" onClick={leave}>Leave without saving</Button>
          </>
        }
      />
    </Dialog>
  );
  return { guard, dialog };
}

function Workspace({ onNavigateRole }: RoleAppProps) {
  const { guard, dialog: leaveDialog } = useNavigationGuard();
  const navigate = guard.navigate;
  const location = useLocation();
  const { store, instructor, rooms, queue } = useInstructorWorkspace();
  const [mobileSearch, setMobileSearch] = useState(false);
  const section = sectionOf(location.pathname);
  const currentClass = section === "classes" ? decodeURIComponent(location.pathname.split("/")[3] ?? "") : "";

  const searchField = (autoFocus = false) => (
    <TopbarSearch
      label="Search instructor workspace"
      autoFocus={autoFocus}
      search={(query) => searchInstructor(store, rooms, query)}
      onSelect={(result) => {
        setMobileSearch(false);
        const tab = result.target === "material" ? "Materials" : result.target === "assessment" ? "Classwork" : "Stream";
        navigate(instructorPaths.classPage(result.classroomId, tab));
      }}
    />
  );

  const myClasses = (collapsed: boolean) => (
    <section aria-label="My classes">
      <SidebarGroup label="My classes" icon={<BookOpen />} count={rooms.length} collapsed={collapsed} storageKey="tmcc-sidebar-classes-open:instructor">
        <ul className={cn("m-0 flex list-none flex-col gap-1 p-0", !collapsed && "pl-2")}>
          {rooms.map((room, index) => {
            const subject = subjectOf(store, room);
            return (
              <li key={room.id}>
                <button
                  type="button"
                  aria-current={currentClass === room.id ? "page" : undefined}
                  title={collapsed ? subject?.title : undefined}
                  onClick={() => navigate(instructorPaths.classPage(room.id))}
                  className={cn(
                    "flex min-h-touch w-full items-center gap-3 rounded-control border-0 py-1.5 text-left font-sans focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                    collapsed ? "justify-center px-0" : "px-2",
                    currentClass === room.id ? "bg-primary-100" : "bg-transparent hover:bg-primary-50",
                  )}
                >
                  <span className={cn("w-14 shrink-0 rounded-chip py-0.5 text-center text-body font-semibold tabular-nums", toneFor(index))}>{classMark(subject)}</span>{" "}
                  <span className={collapsed ? "sr-only" : "flex min-w-0 flex-col"}>
                    <span className="truncate text-body font-medium text-ink">{subject?.title ?? "Classroom"}</span>{" "}
                    <span className="truncate text-body text-muted">{room.section}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </SidebarGroup>
    </section>
  );

  return (
    <AppShell
      roleLabel="Instructor"
      navLabel="instructor navigation"
      nav={nav}
      activeId={section}
      onNavigate={(id) => navigate(navTarget[id] ?? instructorPaths.overview)}
      mobileNav="drawer"
      pageKey={instructorPaths.pageKey(location.pathname)}
      sidebarExtra={myClasses}
      sidebarFooter={(collapsed) => <HelpSupport collapsed={collapsed} />}
      topbarStart={
        <nav aria-label="Breadcrumb" className="hidden md:block">
          <ol className="m-0 flex list-none items-center gap-1 p-0 font-sans text-body">
            <li><button type="button" onClick={() => navigate(instructorPaths.overview)} className="min-h-touch rounded-control border-0 bg-transparent px-2 text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus">Workspace</button></li>
            <li aria-hidden className="text-muted">›</li>
            <li aria-current="page" className="font-semibold text-ink">{pageNames[section]}</li>
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
            heading="Needs your attention"
            emptyText="You’re all caught up."
            items={queue.slice(0, 5).map((item) => ({ id: item.id, title: item.title, meta: `${item.student?.firstName ?? "Student"} ${item.student?.lastName ?? ""} · awaiting review` }))}
            onSelect={(item) => {
              const entry = queue.find((candidate) => candidate.id === item.id);
              if (entry) navigate(instructorPaths.classPage(entry.classroomId, "Submissions", { review: entry.id }));
            }}
          />
          <ProfileMenu name={`${instructor.firstName} ${instructor.lastName}`} subtitle="Faculty · Instructor" currentRole="instructor" onSwitchRole={(role) => navigate(() => onNavigateRole(role))} />
        </>
      }
    >
      <NavigationGuardContext.Provider value={guard}>
      {leaveDialog}
      <Suspense fallback={<ScreenLoading />}>
        <Routes>
          <Route path="instructor/classes" element={<ClassesPage />} />
          <Route path="instructor/classes/:classId" element={<ClassPage />} />
          <Route path="instructor/classes/:classId/assessments/:examId/grading" element={<ExamGradingPage />} />
          <Route path="instructor/classes/:classId/assessments/:id/preview" element={<AssessmentPreviewPage />} />
          <Route path="instructor/gradebook" element={<GradebookPage />} />
          <Route path="instructor/question-sets" element={<QuestionSetsPage />} />
          <Route path="instructor/question-sets/:setId" element={<QuestionSetPage />} />
          {/* Both render the same page, so the first save (new → edit) keeps its state. */}
          <Route path="instructor/classes/:classId/assessments/new" element={<AssessmentBuilderPage />} />
          <Route path="instructor/classes/:classId/assessments/:assessmentId/edit" element={<AssessmentBuilderPage />} />
          <Route path="instructor/classes/:classId/assignments/new" element={<AssignmentBuilderPage />} />
          <Route path="instructor/classes/:classId/assignments/:assignmentId/edit" element={<AssignmentBuilderPage />} />
          <Route path="instructor/classes/:classId/assignments/:assignmentId/preview" element={<AssignmentPreviewPage />} />
          <Route path="instructor/classes/:classId/assignments/:assignmentId/grading" element={<AssignmentGradingPage />} />
          <Route path="instructor/classes/:classId/rubrics" element={<RubricsPage />} />
          <Route path="instructor/classes/:classId/rubrics/new" element={<RubricPage />} />
          <Route path="instructor/classes/:classId/rubrics/:rubricId" element={<RubricPage />} />
          {/* /instructor, ?role=instructor, #/instructor, /instructor.html … land on Overview. */}
          <Route path="*" element={<OverviewPage onNavigateRole={onNavigateRole} />} />
        </Routes>
      </Suspense>
      </NavigationGuardContext.Provider>
    </AppShell>
  );
}

const VIEWING_KEY = "tmcc-viewing-instructor";

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
        <SkeletonGroup label={label} className="flex flex-col gap-4"><Skeleton className="h-9 w-1/2" /><Skeleton className="h-28 w-full" /></SkeletonGroup>
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

/** Root of the Instructor UI. Data comes from the LMS API (D-032). */
export default function InstructorApp(props: RoleAppProps) {
  const navigate = useNavigate();
  const people = usePeople();
  const [chosen, setChosen] = useState(remembered);
  const instructors = people.data?.instructors ?? [];
  const instructorId = instructors.some((item) => item.id === chosen) ? chosen : instructors[0]?.id ?? "";
  const overview = useOverview(instructorId);
  const session = useMemo<InstructorSession>(
    () => ({
      instructorId,
      setInstructorId: (id) => {
        setChosen(id);
        try {
          sessionStorage.setItem(VIEWING_KEY, id);
        } catch {
          // Remembering the choice is a convenience only.
        }
        navigate(instructorPaths.overview);
      },
    }),
    [instructorId, navigate],
  );

  if (!people.data) return <Gate query={people} label="Loading the instructor workspace" />;
  if (!overview.data) return <Gate query={overview} label="Loading your classes" />;

  return (
    <Toaster>
      <InstructorSessionContext.Provider value={session}>
        <Workspace {...props} />
      </InstructorSessionContext.Provider>
    </Toaster>
  );
}
