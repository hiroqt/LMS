import { AlarmClock, ArrowRight, BookOpen, CalendarDays, ChevronRight, ClipboardCheck, Layers, ListChecks, Megaphone, Newspaper, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Panel } from "../../../shared/components/Panel";
import { StatCard } from "../../../shared/components/StatCard";
import { ViewToggle } from "../../../shared/components/ViewToggle";
import { useClassView } from "../../../shared/hooks/useClassView";
import { cn } from "../../../shared/lib/cn";
import { formatDue, formatFullDate } from "../../../shared/lib/format";
import { featuredSlides } from "../../../shared/lib/schoolNews";
import { termStatus } from "../../../shared/lib/term";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { calendarEntries, DAY, dueSoon, dueThisWeek, greeting, needsWork } from "../api/selectors";
import type { Assessment, StudentCatalog } from "../api/types";
import { ClassList } from "../components/ClassList";
import { AssessmentTypeIcon } from "../components/visuals";
import { useStudentPeople } from "../hooks/useStudentCatalog";
import { useStudentSession } from "../hooks/useStudentSession";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

const INTRO_KEY = "tmcc-new-ui-intro-dismissed:student";

function readIntroDismissed() {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

/** One-time orientation for people coming from the previous design (plan §7). */
function NewDesignIntro() {
  const [hidden, setHidden] = useState(readIntroDismissed);
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      // Not remembered in private mode; it simply shows again next visit.
    }
  };
  return (
    <section aria-labelledby="new-design-title" className="flex items-start gap-3 rounded-card border border-primary-200 bg-primary-50 p-4 font-sans">
      <div className="flex flex-1 flex-col gap-1">
        <h2 id="new-design-title" className="m-0 text-body font-semibold text-ink">Welcome to the new design</h2>
        <p className="m-0 text-body text-ink">
          Dashboard, classes, tasks, calendar, and news are in the sidebar, or in the bottom bar on a phone. Your saved work carried over.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss welcome message"
        onClick={dismiss}
        className="-m-2 grid size-touch shrink-0 place-items-center rounded-control border-0 bg-transparent text-muted hover:bg-primary-100 hover:text-ink focus-visible:outline-3 focus-visible:outline-focus"
      >
        <X aria-hidden className="size-4" />
      </button>
    </section>
  );
}

function ViewAll({ label = "View all", onClick }: { label?: string; onClick: () => void }) {
  return <Button variant="ghost" className="-mr-2 shrink-0 px-2 text-primary-700" onClick={onClick}>{label}<ArrowRight aria-hidden className="size-4" /></Button>;
}

/** Due-date pill, warmer as the deadline gets closer. */
function DuePill({ item, now }: { item: Assessment; now: number }) {
  if (!item.dueAt) return <span className="shrink-0 rounded-full bg-info-soft px-3 py-1 text-body font-medium whitespace-nowrap text-info">No due date</span>;
  const days = (new Date(item.dueAt).getTime() - now) / DAY;
  const tone = days <= 1 ? "bg-danger-soft text-danger" : days <= 3 ? "bg-warning-soft text-warning" : "bg-info-soft text-info";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(item.dueAt));
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-body font-medium whitespace-nowrap", tone)}>Due {date}</span>;
}

const TILES = ["bg-accent-100 text-accent-700", "bg-info-soft text-info", "bg-success-soft text-success", "bg-primary-100 text-primary-700"];

function TasksPanel({ catalog, completed, now, className }: { catalog: StudentCatalog; completed: string[]; now: number; className?: string }) {
  const navigate = useNavigate();
  const items = dueSoon(catalog.assessments, completed, now, 4);
  const index = (id: string) => Math.max(catalog.courses.findIndex((entry) => entry.id === id), 0);
  return (
    <Panel id="tasks-panel" className={className} icon={<ListChecks />} title="Tasks & Assessments" action={<ViewAll onClick={() => navigate(studentPaths.tasks())} />}>
      {items.length ? (
        <ul className="m-0 flex flex-1 list-none flex-col divide-y divide-line p-0">
          {items.map((item) => (
            <li key={item.id} className="flex flex-1">
              <button
                type="button"
                onClick={() => navigate(studentPaths.assessment(item.id))}
                className="flex min-h-touch w-full flex-1 items-center gap-3 rounded-control border-0 bg-transparent px-1 py-3 text-left font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus sm:gap-4"
              >
                <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-control", TILES[index(item.courseId) % TILES.length])}>
                  <AssessmentTypeIcon type={item.type} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-card-title font-semibold">{item.title}</strong>
                  <span className="text-body text-muted">{catalog.courses[index(item.courseId)]?.name ?? "Class"} · {item.type}</span>
                  {/* On phones the pill sits under the title so the title keeps the full width. */}
                  <span className="mt-1.5 sm:hidden"><DuePill item={item} now={now} /></span>
                </span>
                <span className="hidden sm:inline"><DuePill item={item} now={now} /></span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-body text-muted">Nothing is due in the next few days.</p>
      )}
    </Panel>
  );
}

function CalendarPanel({ catalog, completed, now, className }: { catalog: StudentCatalog; completed: string[]; now: number; className?: string }) {
  const navigate = useNavigate();
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entries = calendarEntries(catalog.assessments, catalog.academicEvents)
    .filter((entry) => entry.date.getTime() >= startOfToday && !(entry.assessment && !needsWork(entry.assessment, completed)))
    .slice(0, 4);
  const courseName = (id: string) => catalog.courses.find((entry) => entry.id === id)?.name ?? "Class";
  return (
    <Panel id="calendar-panel" className={className} icon={<CalendarDays />} title="Academic Calendar" action={<ViewAll label="View calendar" onClick={() => navigate(studentPaths.calendar())} />}>
      {entries.length ? (
        <ol className="m-0 flex flex-1 list-none flex-col justify-between p-0">
          {entries.map((entry) => {
            const body = (
              <>
                <span className="flex w-14 shrink-0 flex-col items-center rounded-control bg-canvas py-1.5 leading-tight">
                  <span className="text-body text-muted">{new Intl.DateTimeFormat("en-US", { month: "short" }).format(entry.date)}</span>
                  <span className="text-section font-semibold tabular-nums">{entry.date.getDate()}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-card-title font-semibold">{entry.title}</strong>
                  <span className="text-body text-muted">{entry.assessment ? courseName(entry.assessment.courseId) : `${entry.category} · School calendar`}</span>
                </span>
              </>
            );
            // Read-only timeline: deadlines are opened from Tasks & Assessments, so each
            // assessment has one control on the dashboard, not two.
            return (
              <li key={entry.id} className="flex w-full items-center gap-3 py-2 font-sans text-ink">
                {body}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 text-body text-muted">No dates ahead this term.</p>
      )}
    </Panel>
  );
}

function AnnouncementsPanel({ catalog, now, className }: { catalog: StudentCatalog; now: number; className?: string }) {
  const navigate = useNavigate();
  const courseName = (id: string) => catalog.courses.find((entry) => entry.id === id)?.name ?? "Class";
  // Teacher posts first, then school news, so the tile is never a single short line.
  const items = [
    ...catalog.announcements.map((item) => ({ id: item.id, title: item.title, body: item.message, meta: `${item.author} · ${courseName(item.classroomId)} · ${formatDue(item.createdAt)}` })),
    ...featuredSlides(catalog.featured, catalog.academicEvents, now).map((item) => ({ id: item.id, title: item.title, body: item.summary, meta: `School announcement · ${item.category}` })),
  ].slice(0, 3);
  return (
    <Panel id="announcements-panel" className={className} icon={<Megaphone />} title="Announcements" action={<ViewAll onClick={() => navigate(studentPaths.news)} />}>
      {items.length ? (
        /* Side by side when the tile is wide, stacked when it is a narrow column. */
        <div className="@container flex flex-1 flex-col">
        <ul className="m-0 grid flex-1 list-none grid-cols-1 gap-3 p-0 @3xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-control bg-canvas p-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-surface text-primary-700"><Newspaper className="size-5" /></span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="m-0 text-card-title font-semibold">{item.title}</h3>
                <p className="m-0 line-clamp-2 text-body">{item.body}</p>
                <p className="m-0 text-body text-muted">{item.meta}</p>
              </div>
            </li>
          ))}
        </ul>
        </div>
      ) : (
        <p className="m-0 text-body text-muted">No announcements yet.</p>
      )}
    </Panel>
  );
}

/** The student dashboard: greeting, summary chips, then tasks, classes, calendar, and news. */
/** Demo identity, not a sign-in (D-032): which student the workspace shows. */
function ViewingAs() {
  const people = useStudentPeople();
  const { studentId, setStudentId } = useStudentSession();
  const students = people.data?.students ?? [];
  if (students.length < 2) return null;
  return (
    <label className="flex flex-col gap-1 font-sans text-body text-primary-100">
      Viewing as student
      <select
        aria-label="Choose demo student"
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
        className="min-h-touch rounded-control border border-primary-300 bg-surface px-3 text-body-lg text-ink focus-visible:outline-3 focus-visible:outline-focus"
      >
        {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const term = termStatus(catalog.academicEvents, now);
  const { courses, assessments } = catalog;
  const [classView, setClassView] = useClassView();

  const next = dueSoon(assessments, completed, now, 1)[0];

  return (
    // One 12-column bento grid: every tile shares the gutter and stretches to its
    // row, and tiles differ in size by importance (D-026, D-027).
    <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12">
      <header className="flex flex-col justify-between gap-4 rounded-card bg-primary-700 p-5 text-white @4xl:col-span-5 sm:p-6">
        <p className="m-0 text-body text-primary-100">
          {formatFullDate(now)}
          {term?.phase === "in" && <> · {term.name}, Week {term.week}</>}
        </p>
        <div className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-semibold tracking-tight outline-none sm:text-page">
            {greeting(now)}, {catalog.me.firstName}
          </h1>
          <p className="m-0 text-body text-primary-100">
            {next ? <>Next due: {next.title}, {formatDue(next.dueAt)}</> : "Nothing is due in the next few days."}
          </p>
        </div>
        <ViewingAs />
      </header>
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 @4xl:col-span-7 sm:gap-4">
        <li><StatCard icon={<BookOpen />} tone="bg-primary-100 text-primary-700" value={courses.length} label="Active classes" shortLabel="Classes" /></li>
        <li><StatCard icon={<AlarmClock />} tone="bg-accent-100 text-accent-700" value={dueThisWeek(assessments, completed, now).length} label="Due this week" shortLabel="Due soon" onOpen={() => navigate(studentPaths.tasks("Due this week"))} /></li>
        <li><StatCard icon={<ClipboardCheck />} tone="bg-success-soft text-success" value={completed.length} label="Assessments done" shortLabel="Done" onOpen={() => navigate(studentPaths.tasks("Done"))} /></li>
      </ul>

      <div className="col-span-full empty:hidden"><NewDesignIntro /></div>

      {/* Reading order: tasks, calendar, classes, announcements.
          12 columns:  tasks 7 | calendar 5, then classes 8 | announcements 4.
          Wide (@7xl): tasks 5 | calendar 3 | classes 4, then announcements across. */}
      <TasksPanel className="@4xl:col-span-7 @7xl:col-span-5" catalog={catalog} completed={completed} now={now} />
      <CalendarPanel className="@4xl:col-span-5 @7xl:col-span-3" catalog={catalog} completed={completed} now={now} />
      <Panel
        id="my-classes"
        className="@4xl:col-span-7 @7xl:col-span-4"
        icon={<Layers />}
        title="My Classes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={classView} onChange={setClassView} />
            <ViewAll label="View all classes" onClick={() => navigate(studentPaths.classes)} />
          </div>
        }
      >
        {courses.length ? (
          <ClassList fill courses={courses} view={classView} onOpen={(course) => navigate(studentPaths.classPage(course.id))} />
        ) : (
          <EmptyState className="flex-1 justify-center" icon={<BookOpen />} title="You are not enrolled in any classes yet" description="Classes appear here once your enrollment is active." />
        )}
      </Panel>
      <AnnouncementsPanel className="@4xl:col-span-5 @7xl:col-span-12" catalog={catalog} now={now} />
    </div>
  );
}
