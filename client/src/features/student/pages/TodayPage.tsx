import { AlarmClock, ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Clock, Layers, ListChecks, Megaphone, Newspaper } from "lucide-react";
import { useNavigate } from "react-router";
import { DateTile } from "../../../shared/components/DateTile";
import { FocusTile } from "../../../shared/components/FocusTile";
import { IconTile, ListRow, RowList } from "../../../shared/components/ListRow";
import { Panel } from "../../../shared/components/Panel";
import { PanelLink } from "../../../shared/components/PanelLink";
import { SummaryStrip } from "../../../shared/components/SummaryStrip";
import { ViewToggle } from "../../../shared/components/ViewToggle";
import { useClassView } from "../../../shared/hooks/useClassView";
import { DashboardHeader } from "../../../shared/layout/DashboardHeader";
import { cn } from "../../../shared/lib/cn";
import { formatDue, formatFullDate } from "../../../shared/lib/format";
import { featuredSlides } from "../../../shared/lib/schoolNews";
import { termStatus } from "../../../shared/lib/term";
import { classTones, onFillFocus } from "../../../shared/lib/tones";
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
import { MyMeetingsPanel } from "../../meet";

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

/** What is due after the next item. The next one opens from its own tile, so each assessment has one control here (C-015). */
function TasksPanel({ catalog, items, hasNext, now, className }: { catalog: StudentCatalog; items: Assessment[]; hasNext: boolean; now: number; className?: string }) {
  const navigate = useNavigate();
  return (
    <Panel id="tasks-panel" className={className} icon={<ListChecks />} title="Tasks & Assessments" action={<PanelLink onClick={() => navigate(studentPaths.tasks())}>View all</PanelLink>}>
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

function CalendarPanel({ catalog, completed, now, className }: { catalog: StudentCatalog; completed: string[]; now: number; className?: string }) {
  const navigate = useNavigate();
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entries = calendarEntries(catalog.assessments, catalog.academicEvents)
    .filter((entry) => entry.date.getTime() >= startOfToday && !(entry.assessment && !needsWork(entry.assessment, completed)))
    .slice(0, 4);
  return (
    <Panel id="calendar-panel" className={className} icon={<CalendarDays />} title="Academic Calendar" action={<PanelLink onClick={() => navigate(studentPaths.calendar())}>View calendar</PanelLink>}>
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
    ...catalog.announcements.map((item) => ({ id: item.id, title: item.title, body: item.message, meta: `${item.author} · ${courseName(catalog, item.classroomId)} · ${formatDue(item.createdAt)}` })),
    ...featuredSlides(catalog.featured, catalog.academicEvents, now).map((item) => ({ id: item.id, title: item.title, body: item.summary, meta: `School announcement · ${item.category}` })),
  ].slice(0, 3);
  return (
    <Panel id="announcements-panel" className={className} icon={<Megaphone />} title="Announcements" action={<PanelLink onClick={() => navigate(studentPaths.news)}>View all</PanelLink>}>
      {items.length ? (
        /* Side by side when the tile is wide, stacked when it is a narrow column. */
        <div className="@container flex flex-1 flex-col">
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 @3xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-control bg-canvas p-3">
                <IconTile tone="bg-surface text-primary-700"><Newspaper /></IconTile>
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

/** The student dashboard (D-066): heading, next due and the numbers, then tasks, calendar, classes, and news. */
export default function TodayPage() {
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const { studentId } = useStudentSession();
  const term = termStatus(catalog.academicEvents, now);
  const { courses, assessments } = catalog;
  const [classView, setClassView] = useClassView();

  const [next, ...later] = dueSoon(assessments, completed, now, 5);
  const thisWeek = dueThisWeek(assessments, completed, now);
  const withinThreeDays = thisWeek.filter((item) => new Date(item.dueAt).getTime() - now <= 3 * DAY).length;

  return (
    <>
      <DashboardHeader
        meta={<>{formatFullDate(now)}{term?.phase === "in" && <> · {term.name}, Week {term.week}</>}</>}
        title={`${greeting(now)}, ${catalog.me.firstName}`}
        controls={<ViewingAs />}
      />
      {/* One 12-column bento grid: every tile shares the gutter and stretches to its
          row, and tiles differ in size by importance (D-026, D-027, D-066). */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12">
        <NextDueTile className="@4xl:col-span-5" catalog={catalog} item={next} />
        <SummaryStrip
          className="@4xl:col-span-7"
          label="Summary"
          items={[
            { icon: <BookOpen />, tone: classTones[0], value: courses.length, label: "Active classes", shortLabel: "Classes", note: term?.name ?? "This term" },
            { icon: <AlarmClock />, tone: classTones[1], value: thisWeek.length, label: "Due this week", shortLabel: "Due", note: `${withinThreeDays} in the next 3 days`, onOpen: () => navigate(studentPaths.tasks("Due this week")) },
            { icon: <ClipboardCheck />, tone: classTones[3], value: completed.length, label: "Assessments done", shortLabel: "Done", note: `of ${assessments.length} assessments`, onOpen: () => navigate(studentPaths.tasks("Done")) },
          ]}
        />

        <MyMeetingsPanel
          className="@4xl:col-span-12"
          viewer={{ id: studentId, role: "student" }}
          onJoin={(item) => navigate(studentPaths.meeting(item.meeting.classId, item.meeting.id))}
          onOpenClass={(item) => navigate(studentPaths.classPage(item.meeting.classId, "Meetings"))}
        />

        {/* Reading order: tasks, calendar, classes, announcements.
            12 columns:  tasks 7 | calendar 5, then classes 7 | announcements 5.
            Wide (@7xl): tasks 5 | calendar 3 | classes 4, then announcements across. */}
        <TasksPanel className="@4xl:col-span-7 @7xl:col-span-5" catalog={catalog} items={later} hasNext={Boolean(next)} now={now} />
        <CalendarPanel className="@4xl:col-span-5 @7xl:col-span-3" catalog={catalog} completed={completed} now={now} />
        <Panel
          id="my-classes"
          className="@4xl:col-span-7 @7xl:col-span-4"
          icon={<Layers />}
          title="My Classes"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ViewToggle view={classView} onChange={setClassView} />
              <PanelLink onClick={() => navigate(studentPaths.classes)}>View all classes</PanelLink>
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
    </>
  );
}
