import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Layers, ListChecks, Megaphone, Newspaper, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Panel } from "../../../shared/components/Panel";
import { useOverflows } from "../../../shared/hooks/useOverflows";
import { cn } from "../../../shared/lib/cn";
import { formatDue, formatFullDate } from "../../../shared/lib/format";
import { featuredSlides } from "../../../shared/lib/schoolNews";
import { termStatus } from "../../../shared/lib/term";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Select } from "../../../shared/ui/Field";
import { calendarEntries, DAY, dueSoon, greeting, needsWork, taskGroups, type TaskStatus } from "../api/selectors";
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

/**
 * A tile stretches to its row so the row ends on one line (C-018). A list too short to
 * use that height is sized to its content instead of holding blank space (D-067).
 */
const FIT_CONTENT = "@4xl:self-start";

/*
 * On a desktop window tall enough (`screen-fit`, D-067) the dashboard is exactly one screen:
 * the grid fills the height under the top bar, and a list longer than its tile scrolls inside
 * the tile, never the page. A list with no controls becomes a keyboard stop only while it scrolls.
 */
const FIT_PANEL = "screen-fit:@4xl:min-h-0";
const FIT_LIST = "screen-fit:@4xl:min-h-0 screen-fit:@4xl:overflow-y-auto";
const SCROLL_FOCUS = "rounded-control focus-visible:outline-3 focus-visible:outline-focus";

/** The Tasks statuses counted on the dashboard. "Due soon" is the list under them and "View all". */
// Each has its own color (D-067): yellow for what is coming, red for what is late, green for
// what is finished. The name is always written out, so the color only supports it (C-004).
const STATUS_BUTTONS: { status: TaskStatus; box: string; number: string }[] = [
  { status: "Due this week", box: "border-accent-400 bg-accent-100 hover:bg-accent-200", number: "text-warning" },
  { status: "Missing", box: "border-danger/40 bg-danger-soft hover:bg-danger/15", number: "text-danger" },
  { status: "Done", box: "border-success/40 bg-success-soft hover:bg-success-200", number: "text-success" },
];

/**
 * A status inside Tasks & Assessments: a plain button with how much work is in it, which opens
 * Tasks on that status (D-067; a StatCard tile before that).
 * Its name starts with the number, e.g. "2 Missing".
 *
 * The three share the tile's width (D-067). Beside a full list each is one line, number then
 * name, and the name drops under the number when the button is too narrow for both. With
 * `fill` (a list too short to use the tile's height) the buttons take that height instead:
 * a larger number over the name, centered.
 */
function StatusButton({ value, label, box, number, fill, onOpen }: { value: number; label: string; box: string; number: string; fill: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-h-touch min-w-0 rounded-control border px-3 py-1.5 font-sans text-body font-medium text-ink transition-colors focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none",
        box,
        fill ? "flex-col items-center justify-center gap-0.5 py-3 text-center" : "flex-wrap content-center items-baseline gap-x-2 text-left",
      )}
    >
      <strong className={cn("font-semibold tabular-nums", fill ? "text-page-mobile sm:text-page" : "text-section", number)}>{value}</strong>
      {" "}
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}

const TILES = ["bg-accent-100 text-accent-700", "bg-info-soft text-info", "bg-success-soft text-success", "bg-primary-100 text-primary-700"];

function TasksPanel({ catalog, completed, now, className }: { catalog: StudentCatalog; completed: string[]; now: number; className?: string }) {
  const navigate = useNavigate();
  const items = dueSoon(catalog.assessments, completed, now, TASKS_SHOWN);
  const groups = taskGroups(catalog.assessments, completed, now);
  const index = (id: string) => Math.max(catalog.courses.findIndex((entry) => entry.id === id), 0);
  // The tile always stretches to its row (D-067). Three rows or more
  // use the height themselves; with fewer the status buttons grow into it, so the tile never
  // holds blank space and never leaves a gap beside the calendar.
  const fill = items.length < 3;
  return (
    <Panel id="tasks-panel" className={cn(className, FIT_PANEL)} icon={<ListChecks />} title="Tasks & Assessments" action={<ViewAll onClick={() => navigate(studentPaths.tasks())} />}>
      {/* The counts live with the work they count (D-067). Each is the size of the Tasks page's
          own group, so the number on the button is the number of rows it opens. */}
      <div role="group" aria-label="Work by status" className={cn("grid shrink-0 grid-cols-3 gap-2", fill && "flex-1")}>
        {STATUS_BUTTONS.map(({ status, box, number }) => {
          const count = groups.find((group) => group.status === status)?.items.length ?? 0;
          return <StatusButton key={status} value={count} label={status} box={box} number={number} fill={fill} onOpen={() => navigate(studentPaths.tasks(status))} />;
        })}
      </div>
      {items.length ? (
        <ul className={cn("m-0 flex list-none flex-col divide-y divide-line p-0", !fill && "flex-1", FIT_LIST)}>
          {items.map((item) => (
            <li key={item.id} className={cn("flex", !fill && "flex-1")}>
              <button
                type="button"
                onClick={() => navigate(studentPaths.assessment(item.id))}
                className="flex min-h-touch w-full flex-1 items-center gap-3 rounded-control border-0 bg-transparent px-1 py-2 text-left font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus sm:gap-4"
              >
                <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-control", TILES[index(item.courseId) % TILES.length])}>
                  <AssessmentTypeIcon type={item.type} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-card-title font-semibold @4xl:truncate">{item.title}</strong>
                  <span className="text-body text-muted @4xl:truncate">{catalog.courses[index(item.courseId)]?.name ?? "Class"} · {item.type}</span>
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

/** How many deadlines Tasks & Assessments lists; the calendar starts after them (D-067). */
const TASKS_SHOWN = 4;

function CalendarPanel({ catalog, completed, now, className }: { catalog: StudentCatalog; completed: string[]; now: number; className?: string }) {
  const navigate = useNavigate();
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // The next deadlines are already in Tasks beside it, so the calendar shows what comes after
  // them and the school's own dates, instead of the same four quizzes twice.
  const inTasks = new Set(dueSoon(catalog.assessments, completed, now, TASKS_SHOWN).map((item) => item.id));
  const entries = calendarEntries(catalog.assessments, catalog.academicEvents)
    .filter((entry) => entry.date.getTime() >= startOfToday && !(entry.assessment && (!needsWork(entry.assessment, completed) || inTasks.has(entry.assessment.id))))
    .slice(0, 4);
  const courseName = (id: string) => catalog.courses.find((entry) => entry.id === id)?.name ?? "Class";
  const [listRef, overflows] = useOverflows<HTMLOListElement>();
  return (
    <Panel id="calendar-panel" className={cn(className, FIT_PANEL, entries.length < 3 && FIT_CONTENT)} icon={<CalendarDays />} title="Academic Calendar" action={<ViewAll onClick={() => navigate(studentPaths.calendar())} />}>
      {entries.length ? (
        <ol ref={listRef} tabIndex={overflows ? 0 : undefined} aria-label={overflows ? "Calendar dates" : undefined} className={cn("m-0 flex flex-1 list-none flex-col justify-between p-0", FIT_LIST, SCROLL_FOCUS)}>
          {entries.map((entry) => {
            const body = (
              <>
                <span className="flex w-14 shrink-0 flex-col items-center rounded-control bg-canvas py-1 leading-tight">
                  <span className="text-body text-muted">{new Intl.DateTimeFormat("en-US", { month: "short" }).format(entry.date)}</span>
                  <span className="text-section font-semibold tabular-nums">{entry.date.getDate()}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-card-title font-semibold @4xl:truncate">{entry.title}</strong>
                  <span className="text-body text-muted @4xl:truncate">{entry.assessment ? courseName(entry.assessment.courseId) : `${entry.category} · School calendar`}</span>
                </span>
              </>
            );
            // Read-only timeline: deadlines are opened from Tasks & Assessments, so each
            // assessment has one control on the dashboard, not two.
            return (
              <li key={entry.id} className="flex w-full items-center gap-3 py-1.5 font-sans text-ink">
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
  const [listRef, overflows] = useOverflows<HTMLUListElement>();
  return (
    <Panel id="announcements-panel" className={cn(className, items.length < 2 && FIT_CONTENT)} icon={<Megaphone />} title="Announcements" action={<ViewAll onClick={() => navigate(studentPaths.news)} />}>
      {items.length ? (
        /* Always stacked (D-067). Two lines each, title and who posted it, so three fit beside the
           greeting; the full message is one click away in News & Announcements. */
        <ul ref={listRef} tabIndex={overflows ? 0 : undefined} aria-label={overflows ? "Latest announcements" : undefined} className={cn("m-0 flex flex-1 list-none flex-col gap-2 p-0", FIT_LIST, SCROLL_FOCUS)}>
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-control bg-canvas px-3 py-1">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-surface text-primary-700"><Newspaper className="size-5" /></span>
              <div className="flex min-w-0 flex-col">
                <h3 className="m-0 text-card-title font-semibold @4xl:truncate">{item.title}</h3>
                <p className="m-0 text-body text-muted @4xl:truncate">{item.meta}</p>
              </div>
            </li>
          ))}
        </ul>
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
    // The label stays light on the green hero; the dropdown is the shared Select.
    <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-body font-medium text-primary-100">
      Viewing as student
      <Select className="min-w-48 flex-1" aria-label="Choose demo student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
        {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Select>
    </label>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const term = termStatus(catalog.academicEvents, now);
  const { courses } = catalog;

  return (
    // One 12-column bento grid (D-026, D-027), two columns of tiles over the classes (D-067):
    //   greeting      | announcements
    //   calendar      | tasks & assessments (with the due and done counts)
    //   my classes, across
    // 6 | 6 at @4xl, 5 | 7 from @6xl. The DOM (and a phone's one column) reads greeting,
    // announcements, tasks, calendar, classes, so tasks and calendar are placed explicitly.
    // On a tall enough desktop window (screen-fit) the page is one screen: the grid fills the
    // height under the top bar (64px) and main's padding (2 x 32px), the greeting's row is at
    // least its content and shares the rest 5 : 9 with the lower row, and lists scroll inside.
    // A one-time welcome note, when shown, opens the page above the grid (D-067).
    <div className="flex flex-col gap-3 sm:gap-4 screen-fit:@4xl:h-[calc(100dvh-8rem)]">
      <NewDesignIntro />
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12 screen-fit:@4xl:min-h-0 screen-fit:@4xl:flex-1 screen-fit:@4xl:grid-rows-[minmax(auto,5fr)_minmax(0,9fr)_auto]">
        <header className="flex flex-col justify-center gap-4 rounded-card bg-primary-700 p-5 text-white @4xl:col-span-6 @6xl:col-span-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-body text-primary-100">
              {formatFullDate(now)}
              {term?.phase === "in" && <> · {term.name}, Week {term.week}</>}
            </p>
            {/* No "Next due" line: the next deadline heads Tasks & Assessments (D-067). */}
            <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-semibold tracking-tight outline-none sm:text-page">
              {greeting(now)}, {catalog.me.firstName}
            </h1>
          </div>
          <ViewingAs />
        </header>
        {/* In screen-fit the greeting alone sets the top row's height (contain-size); the
            announcements fill it and scroll inside, even when they would be shorter (self-stretch). */}
        <AnnouncementsPanel className="@4xl:col-span-6 @6xl:col-span-7 screen-fit:@4xl:self-stretch! screen-fit:@4xl:contain-size" catalog={catalog} now={now} />
        <TasksPanel className="@4xl:col-span-6 @4xl:col-start-7 @4xl:row-start-2 @6xl:col-span-7 @6xl:col-start-6" catalog={catalog} completed={completed} now={now} />
        <CalendarPanel className="@4xl:col-span-6 @4xl:col-start-1 @4xl:row-start-2 @6xl:col-span-5" catalog={catalog} completed={completed} now={now} />
        <Panel
          id="my-classes"
          className="@4xl:col-span-12"
          icon={<Layers />}
          title="My Classes"
          action={<ViewAll label="View all classes" onClick={() => navigate(studentPaths.classes)} />}
        >
          {courses.length ? (
            <ClassList fill courses={courses} onOpen={(course) => navigate(studentPaths.classPage(course.id))} />
          ) : (
            <EmptyState className="flex-1 justify-center" icon={<BookOpen />} title="You are not enrolled in any classes yet" description="Classes appear here once your enrollment is active." />
          )}
        </Panel>
      </div>
    </div>
  );
}
