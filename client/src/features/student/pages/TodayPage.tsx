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
import { STUDENT } from "../api/catalog";
import { calendarEntries, DAY, dueSoon, dueThisWeek, greeting } from "../api/selectors";
import type { Assessment, StudentCatalog } from "../api/types";
import { ClassList } from "../components/ClassList";
import { AssessmentTypeIcon } from "../components/visuals";
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

function CalendarPanel({ catalog, completed, now }: { catalog: StudentCatalog; completed: string[]; now: number }) {
  const navigate = useNavigate();
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entries = calendarEntries(catalog.assessments, catalog.academicEvents)
    .filter((entry) => entry.date.getTime() >= startOfToday && !(entry.assessment && completed.includes(entry.assessment.id)))
    .slice(0, 4);
  const courseName = (id: string) => catalog.courses.find((entry) => entry.id === id)?.name ?? "Class";
  return (
    <Panel id="calendar-panel" icon={<CalendarDays />} title="Academic Calendar" action={<ViewAll label="View calendar" onClick={() => navigate(studentPaths.calendar())} />}>
      {entries.length ? (
        <ol className="m-0 flex flex-1 list-none flex-col justify-between p-0">
          {entries.map((entry, position) => {
            const body = (
              <>
                <span className="flex w-14 shrink-0 flex-col items-center rounded-control bg-canvas py-1.5 leading-tight">
                  <span className="text-label font-semibold tracking-label text-muted uppercase">{new Intl.DateTimeFormat("en-US", { month: "short" }).format(entry.date)}</span>
                  <span className="text-section font-bold tabular-nums">{entry.date.getDate()}</span>
                </span>
                <span aria-hidden className="relative flex w-3 shrink-0 items-center justify-center self-stretch">
                  <span className={cn("absolute left-1/2 w-px -translate-x-1/2 bg-line", position === 0 ? "top-1/2" : "top-0", position === entries.length - 1 ? "bottom-1/2" : "bottom-0")} />
                  <span className={cn("relative size-2.5 rounded-full ring-2 ring-surface", entry.assessment ? "bg-primary-600" : "bg-accent-400")} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-body font-semibold">{entry.title}</strong>
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
  const latest = catalog.announcements[0];
  const featured = featuredSlides(catalog.featured, catalog.academicEvents, now)[0];
  const courseName = (id: string) => catalog.courses.find((entry) => entry.id === id)?.name ?? "Class";
  return (
    <Panel id="announcements-panel" className={className} icon={<Megaphone />} title="Announcements" action={<ViewAll onClick={() => navigate(studentPaths.news)} />}>
      {latest || featured ? (
        <article className="flex items-start gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-100 text-primary-700"><Newspaper className="size-5" /></span>
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="m-0 text-card-title font-semibold">{latest ? latest.title : featured?.title}</h3>
            <p className="m-0 line-clamp-3 text-body">{latest ? latest.message : featured?.summary}</p>
            <p className="m-0 text-body text-muted">
              {latest ? `${latest.author} · ${courseName(latest.classroomId)} · ${formatDue(latest.createdAt)}` : `School announcement · ${featured?.category}`}
            </p>
          </div>
        </article>
      ) : (
        <p className="m-0 text-body text-muted">No announcements yet.</p>
      )}
    </Panel>
  );
}

/** The student dashboard: greeting, summary chips, then tasks, classes, calendar, and news. */
export default function TodayPage() {
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const term = termStatus(catalog.academicEvents, now);
  const { courses, assessments } = catalog;
  const [classView, setClassView] = useClassView();

  return (
    // A bento grid: every tile shares one gutter and stretches to its row, so
    // rows end on the same line at every width (D-026).
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
        <header className="flex flex-col justify-center gap-1 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
          <p className="m-0 text-body text-muted">
            {formatFullDate(now)}
            {term?.phase === "in" && <> · {term.name}, Week {term.week}</>}
          </p>
          <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-bold tracking-tight text-ink outline-none sm:text-page">
            {greeting(now)}, {STUDENT.firstName}
          </h1>
        </header>
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:gap-4">
          <li><StatCard icon={<BookOpen />} tone="bg-primary-100 text-primary-700" value={courses.length} label="Active classes" shortLabel="Classes" /></li>
          <li><StatCard icon={<AlarmClock />} tone="bg-accent-100 text-accent-700" value={dueThisWeek(assessments, completed, now).length} label="Due this week" shortLabel="Due soon" onOpen={() => navigate(studentPaths.tasks("Due this week"))} /></li>
          <li><StatCard icon={<ClipboardCheck />} tone="bg-success-soft text-success" value={completed.length} label="Assessments done" shortLabel="Done" onOpen={() => navigate(studentPaths.tasks("Done"))} /></li>
        </ul>
      </div>

      <NewDesignIntro />

      {/* Reading order: tasks, calendar, classes, announcements. Two columns put the
          class cards and the announcement in full-width rows; three columns stack the
          calendar over the announcement between tasks and classes. */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @7xl:grid-cols-3 @7xl:grid-rows-[1fr_auto]">
        <TasksPanel className="@7xl:row-span-2" catalog={catalog} completed={completed} now={now} />
        <CalendarPanel catalog={catalog} completed={completed} now={now} />
        <Panel
          id="my-classes"
          className="@4xl:col-span-2 @7xl:col-span-1 @7xl:row-span-2"
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
        <AnnouncementsPanel className="@4xl:col-span-2 @7xl:col-span-1" catalog={catalog} now={now} />
      </div>
    </div>
  );
}
