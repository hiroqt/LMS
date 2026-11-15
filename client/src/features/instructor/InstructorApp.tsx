import { BookOpen, GraduationCap, LayoutDashboard, Plus, Search } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { HelpSupport } from "../../shared/components/HelpSupport";
import { NotificationsPopover } from "../../shared/components/NotificationsPopover";
import { ProfileMenu } from "../../shared/components/ProfileMenu";
import { TopbarSearch } from "../../shared/components/TopbarSearch";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { SidebarGroup } from "../../shared/layout/SidebarGroup";
import { cn } from "../../shared/lib/cn";
import { toneFor } from "../../shared/lib/tones";
import { Dialog, DialogContent, DialogTrigger } from "../../shared/ui/Dialog";
import { IconButton } from "../../shared/ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../shared/ui/Skeleton";
import { Toaster } from "../../shared/ui/toast/Toaster";
import { createClassroom } from "./api/actions";
import { activeInstructors, classMark, searchInstructor, subjectOf } from "./api/selectors";
import { useRoleStore, useRoleStoreSync } from "./api/store";
import { CreateClassDialog } from "./components/CreateClassDialog";
import { useInstructorWorkspace } from "./hooks/useInstructorWorkspace";
import { InstructorSessionContext, type InstructorSession } from "./instructorContext";
import { instructorPaths } from "./paths";
import OverviewPage from "./pages/OverviewPage";

const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const ClassPage = lazy(() => import("./pages/ClassPage"));
const GradebookPage = lazy(() => import("./pages/GradebookPage"));

export interface RoleAppProps {
  onNavigateRole: (role: string) => void;
}

// "instructor navigation" keeps the classic landmark name (D-013).
const nav: NavItem[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
  { id: "gradebook", label: "Gradebook", icon: <GraduationCap /> },
];

const pageNames: Record<string, string> = { overview: "Overview", classes: "Classes", gradebook: "Gradebook" };

function sectionOf(pathname: string): string {
  const [, , section] = pathname.split("/");
  return section === "classes" || section === "gradebook" ? section : "overview";
}

function ScreenLoading() {
  return (
    <SkeletonGroup label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-28 w-full" />
    </SkeletonGroup>
  );
}

function Workspace({ onNavigateRole, onCreateClass }: RoleAppProps & { onCreateClass: () => void }) {
  const navigate = useNavigate();
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
                  <span className={cn("w-14 shrink-0 rounded-chip py-0.5 text-center text-body font-semibold tracking-code tabular-nums", toneFor(index))}>{classMark(subject)}</span>{" "}
                  <span className={collapsed ? "sr-only" : "flex min-w-0 flex-col"}>
                    <span className="truncate text-body font-medium text-ink">{subject?.title ?? "Classroom"}</span>{" "}
                    <span className="truncate text-body text-muted">{room.section}</span>
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              title={collapsed ? "Create class" : undefined}
              onClick={onCreateClass}
              className={cn(
                "flex min-h-touch w-full items-center gap-2 rounded-control border border-dashed border-line-strong bg-transparent text-left font-sans text-body font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus",
                collapsed ? "justify-center px-0" : "px-3",
              )}
            >
              {collapsed ? <><Plus aria-hidden className="size-5" /><span className="sr-only">+ Create class</span></> : "+ Create class"}
            </button>
          </li>
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
      onNavigate={(id) => navigate(id === "gradebook" ? instructorPaths.gradebook() : instructorPaths.overview)}
      mobileNav="drawer"
      pageKey={location.pathname}
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
          <ProfileMenu name={`${instructor.firstName} ${instructor.lastName}`} subtitle="Faculty · Instructor" currentRole="instructor" onSwitchRole={onNavigateRole} />
        </>
      }
    >
      <Suspense fallback={<ScreenLoading />}>
        <Routes>
          <Route path="instructor/classes" element={<ClassesPage />} />
          <Route path="instructor/classes/:classId" element={<ClassPage />} />
          <Route path="instructor/gradebook" element={<GradebookPage />} />
          {/* /instructor, ?role=instructor, #/instructor, /instructor.html … land on Overview. */}
          <Route path="*" element={<OverviewPage onNavigateRole={onNavigateRole} />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

/** Root of the rebuilt Instructor UI (Phase 3). */
export default function InstructorApp(props: RoleAppProps) {
  useRoleStoreSync();
  const navigate = useNavigate();
  const store = useRoleStore();
  const [instructorId, setInstructorId] = useState(() => activeInstructors(store)[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const session = useMemo<InstructorSession>(
    () => ({
      instructorId,
      setInstructorId: (id) => {
        setInstructorId(id);
        navigate(instructorPaths.overview);
      },
      openCreateClass: () => setCreating(true),
    }),
    [instructorId, navigate],
  );
  const instructor = activeInstructors(store).find((item) => item.id === instructorId) ?? activeInstructors(store)[0];
  const term = store.systemAdministration?.terms.find((item) => item.id === store.systemAdministration?.settings.currentTermId)?.name ?? "Fall 2026";

  return (
    <Toaster>
      <InstructorSessionContext.Provider value={session}>
        <Workspace {...props} onCreateClass={() => setCreating(true)} />
        <CreateClassDialog
          open={creating}
          onOpenChange={setCreating}
          subjects={store.subjects}
          onCreate={(input) => {
            if (!instructor) return null;
            const id = createClassroom(instructor, input, term);
            if (id) {
              setCreating(false);
              navigate(instructorPaths.classPage(id));
            }
            return id;
          }}
        />
      </InstructorSessionContext.Provider>
    </Toaster>
  );
}
