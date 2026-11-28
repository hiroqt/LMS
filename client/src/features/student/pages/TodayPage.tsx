import { AlarmClock, ArrowRight, BookOpen, CalendarDays, Clock, Layers, ListChecks, Megaphone, Newspaper } from "lucide-react";
import { useNavigate } from "react-router";
import { DateTile } from "../../../shared/components/DateTile";
import { FocusTile } from "../../../shared/components/FocusTile";
import { IconTile, ListRow, RowList } from "../../../shared/components/ListRow";
import { Panel } from "../../../shared/components/Panel";
import { PanelLink } from "../../../shared/components/PanelLink";
import { DashboardHeader } from "../../../shared/layout/DashboardHeader";
import { cn } from "../../../shared/lib/cn";
import { formatDue, formatFullDate } from "../../../shared/lib/format";
import { featuredSlides } from "../../../shared/lib/schoolNews";
import { termStatus } from "../../../shared/lib/term";
import { classTones, onFillFocus } from "../../../shared/lib/tones";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { calendarEntries, DAY, dueSoon, greeting, needsWork, taskGroups, type TaskStatus } from "../api/selectors";
import type { Assessment, StudentCatalog } from "../api/types";
import { ClassList } from "../components/ClassList";
import { AssessmentTypeIcon } from "../components/visuals";
import { useStudentPeople } from "../hooks/useStudentCatalog";
import { useStudentSession } from "../hooks/useStudentSession";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

const courseIndex = (catalog: StudentCatalog, id: string) => Math.max(catalog.courses.findIndex((entry) => entry.id === id), 0);
const courseName = (catalog: StudentCatalog, id: string) => catalog.courses.find((entry) => entry.id === id)?.name ?? "Class";

/** Due-date badge, warmer as the deadline gets closer. Always says the date (C-015). */
function DuePill({ item, now }: { item: Assessment; now: number }) {
  if (!item.dueAt) return <span className="shrink-0 rounded-full bg-info-soft px-3 py-1 text-body font-medium whitespace-nowrap text-info">No due date</span>;
  const days = (new Date(item.dueAt).getTime() - now) / DAY;
  const tone = days <= 1 ? "bg-danger-soft text-danger" : days <= 3 ? "bg-warning-soft text-warning" : "bg-info-soft text-info";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(item.dueAt));
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-body font-medium whitespace-nowrap", tone)}>Due {date}</span>;
}

/** The filled tile: the one assessment due next, opened from here (D-066). */
function NextDueTile({ catalog, item, className }: { catalog: StudentCatalog; item?: Assessment; className?: string }) {
  const navigate = useNavigate();
  return (
    <FocusTile id="next-due" icon={<AlarmClock />} title="Next due" className={className}>
      {item ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-card-title font-semibold break-words">{item.title}</p>
            <p className="m-0 text-body text-primary-100">{courseName(catalog, item.courseId)} · {item.type}</p>
          </div>
          <p className="m-0 inline-flex items-center gap-1.5 self-start rounded-full bg-primary-800 px-3 py-0.5 text-body font-medium">
            <Clock aria-hidden className="size-4 shrink-0" />
            {item.dueAt ? `Due ${formatDue(item.dueAt)}` : "No due date"}
          </p>
          <Button variant="secondary" className={cn("mt-auto self-start", onFillFocus)} onClick={() => navigate(studentPaths.assessment(item.id))}>
            Open {item.type.toLowerCase()}<ArrowRight aria-hidden className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <p className="m-0 text-body text-primary-100">Nothing is due. New work appears here when your teachers post it.</p>
          <Button variant="secondary" className={cn("mt-auto self-start", onFillFocus)} onClick={() => navigate(studentPaths.tasks())}>
            View all tasks<ArrowRight aria-hidden className="size-4" />
          </Button>
        </>
      )}
    </FocusTile>
  );
}

/**
 * A tile stretches to its row so the row ends on one line (C-018). A list too short to use
 * that height is sized to its content instead of holding blank space (D-071).
 */
const FIT_CONTENT = "@4xl:self-start";

/**
 * The Tasks statuses counted on the dashboard (D-071), each in its own color: yellow for what
 * is coming, red for what is late, green for what is finished. "Due soon" is the list under
 * them and "View all". The name is always written out, so the color only supports it (C-004).
 */
const STATUS_BUTTONS: { status: TaskStatus; box: string; number: string }[] = [
  { status: "Due this week", box: "border-accent-400 bg-accent-100 hover:bg-accent-200", number: "text-warning" },
  { status: "Missing", box: "border-danger/40 bg-danger-soft hover:bg-danger/15", number: "text-danger" },
  { status: "Done", box: "border-success/40 bg-success-soft hover:bg-success-200", number: "text-success" },
];

/**
 * A status inside Tasks & Assessments: a button with how much work is in it, which opens
 * Tasks on that status. Its name starts with the number, e.g. "2 Missing".
 *
 * The three share the tile's width. Beside a full list each is one line, number then name,
 * and the name drops under the number when the button is too narrow for both. With `fill`
 * (a list too short to use the tile's height) the buttons take that height instead: a
 * larger number over the name, centered.
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

/**
 * The status counts, then what is due after the next item. The next one opens from its own
 * tile, so each assessment has one control here (C-015).
 */
function TasksPanel({ catalog, completed, items, hasNext, now, className }: { catalog: StudentCatalog; completed: string[]; items: Assessment[]; hasNext: boolean; now: number; className?: string }) {
  const navigate = useNavigate();
  // Each count is the size of the Tasks page's own group, so the number on a button is the
  // number of rows it opens.
  const groups = taskGroups(catalog.assessments, completed, now);
  // Three rows or more use the tile's height themselves; with fewer the status buttons grow
  // into it, so the tile never holds blank space or leaves a gap beside the calendar.
  const fill = items.length < 3;
  return (
    <Panel id="tasks-panel" className={className} icon={<ListChecks />} title="Tasks & Assessments" action={<PanelLink onClick={() => navigate(studentPaths.tasks())}>View all</PanelLink>}>
      <div role="group" aria-label="Work by status" className={cn("grid shrink-0 grid-cols-3 gap-2", fill && "flex-1")}>
        {STATUS_BUTTONS.map(({ status, box, number }) => (
          <StatusButton key={status} value={groups.find((group) => group.status === status)?.items.length ?? 0} label={status} box={box} number={number} fill={fill} onOpen={() => navigate(studentPaths.tasks(status))} />
        ))}
      </div>
      {items.length ? (
        <RowList>
          {items.map((item) => (
            <ListRow
              key={item.id}
              onOpen={() => navigate(studentPaths.assessment(item.id))}
              lead={<IconTile tone={classTones[courseIndex(catalog, item.courseId) % classTones.length]}><AssessmentTypeIcon type={item.type} /></IconTile>}
              title={item.title}
              meta={`${courseName(catalog, item.courseId)} · ${item.type}`}
              // On phones the badge sits under the title so the title keeps the full width.
              below={<span className="mt-1.5 sm:hidden"><DuePill item={item} now={now} /></span>}
              trail={<span className="hidden sm:inline"><DuePill item={item} now={now} /></span>}
            />
          ))}
        </RowList>
      ) : (
        <p className="m-0 text-body text-muted">{hasNext ? "Nothing else is due." : "Nothing is due."}</p>
      )}
    </Panel>
  );
}

function CalendarPanel({ catalog, completed, shown, now, className }: { catalog: StudentCatalog; completed: string[]; /** Deadlines the Next due tile and Tasks already list. */ shown: Assessment[]; now: number; className?: string }) {
  const navigate = useNavigate();
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // The next deadlines are in the tiles beside it, so the calendar shows what comes after
  // them and the school's own dates, instead of the same work twice (D-071).
  const listed = new Set(shown.map((item) => item.id));
  const entries = calendarEntries(catalog.assessments, catalog.academicEvents)
    .filter((entry) => entry.date.getTime() >= startOfToday && !(entry.assessment && (!needsWork(entry.assessment, completed) || listed.has(entry.assessment.id))))
    .slice(0, 4);
  return (
    <Panel id="calendar-panel" className={cn(className, entries.length < 3 && FIT_CONTENT)} icon={<CalendarDays />} title="Academic Calendar" action={<PanelLink onClick={() => navigate(studentPaths.calendar())}>View calendar</PanelLink>}>
      {entries.length ? (
        // Read-only timeline: deadlines open from Tasks, so each has one control (C-015).
        <RowList>
          {entries.map((entry) => (
            <ListRow
              key={entry.id}
              lead={<DateTile date={entry.date} />}
              title={entry.title}
              meta={entry.assessment ? `${courseName(catalog, entry.assessment.courseId)} · Deadline` : `${entry.category} · School calendar`}
            />
          ))}
        </RowList>
      ) : (
        <p className="m-0 text-body text-muted">No dates ahead this term.</p>
      )}
    </Panel>
  );
}

function AnnouncementsPanel({ catalog, now, className }: { catalog: StudentCatalog; now: number; className?: string }) {
  const navigate = useNavigate();
  // Teacher posts first, then school news, so the tile is never a single short line.
  const items = [
    ...catalog.announcements.map((item) => ({ id: item.id, title: item.title, meta: `${item.author} · ${courseName(catalog, item.classroomId)} · ${formatDue(item.createdAt)}` })),
    ...featuredSlides(catalog.featured, catalog.academicEvents, now).map((item) => ({ id: item.id, title: item.title, meta: `School announcement · ${item.category}` })),
  ].slice(0, 3);
  return (
    <Panel id="announcements-panel" className={cn(className, items.length < 2 && FIT_CONTENT)} icon={<Megaphone />} title="Announcements" action={<PanelLink onClick={() => navigate(studentPaths.news)}>View all</PanelLink>}>
      {items.length ? (
        /* Always stacked: beside the Next due tile the rows fill the tile's height (D-071).
           Two lines each, the title and who posted it, so three fit beside that tile; the
           message itself is one click away in News & Announcements. */
        <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <li key={item.id} className="flex flex-1 items-center gap-3 rounded-control bg-canvas p-3">
              <IconTile tone="bg-surface text-primary-700"><Newspaper /></IconTile>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="m-0 text-card-title font-semibold">{item.title}</h3>
                <p className="m-0 text-body text-muted">{item.meta}</p>
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

/** Demo identity, not a sign-in (D-032): which student the workspace shows. */
function ViewingAs() {
  const people = useStudentPeople();
  const { studentId, setStudentId } = useStudentSession();
  const students = people.data?.students ?? [];
  if (students.length < 2) return null;
  return (
    <label className="flex flex-col gap-1 font-sans text-body text-muted">
      Viewing as student
      <select
        aria-label="Choose demo student"
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
        className="min-h-touch rounded-control border border-line-strong bg-surface px-3 text-body-lg text-ink focus-visible:outline-3 focus-visible:outline-focus"
      >
        {students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  );
}

/**
 * The student dashboard (D-066, D-071): heading, then what is due next beside the
 * announcements, then tasks (with the status counts) beside the calendar, then the classes.
 */
export default function TodayPage() {
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const term = termStatus(catalog.academicEvents, now);
  const { courses, assessments } = catalog;

  const soon = dueSoon(assessments, completed, now, 5);
  const [next, ...later] = soon;

  return (
    <>
      <DashboardHeader
        meta={<>{formatFullDate(now)}{term?.phase === "in" && <> · {term.name}, Week {term.week}</>}</>}
        title={`${greeting(now)}, ${catalog.me.firstName}`}
        controls={<ViewingAs />}
      />
      {/* One 12-column bento grid: every tile shares the gutter and stretches to its
          row, and tiles differ in size by importance (D-026, D-027, D-066).
          Reading order (D-071): next due, announcements, tasks, calendar, classes.
          12 columns: next due 5 | announcements 7, then tasks 7 | calendar 5, then classes across. */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12">
        <NextDueTile className="@4xl:col-span-5" catalog={catalog} item={next} />
        <AnnouncementsPanel className="@4xl:col-span-7" catalog={catalog} now={now} />
        <TasksPanel className="@4xl:col-span-7" catalog={catalog} completed={completed} items={later} hasNext={Boolean(next)} now={now} />
        <CalendarPanel className="@4xl:col-span-5" catalog={catalog} completed={completed} shown={soon} now={now} />
        <Panel id="my-classes" className="@4xl:col-span-12" icon={<Layers />} title="My Classes" action={<PanelLink onClick={() => navigate(studentPaths.classes)}>View all classes</PanelLink>}>
          {courses.length ? (
            <ClassList fill courses={courses} onOpen={(course) => navigate(studentPaths.classPage(course.id))} />
          ) : (
            <EmptyState className="flex-1 justify-center" icon={<BookOpen />} title="You are not enrolled in any classes yet" description="Classes appear here once your enrollment is active." />
          )}
        </Panel>
      </div>
    </>
  );
}
