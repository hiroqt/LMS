import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Inbox, Layers, Megaphone, School, UsersRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { academicEvents, featuredAnnouncements } from "../../../data.js";
import { DateTile } from "../../../shared/components/DateTile";
import { FeaturedNewsCarousel } from "../../../shared/components/FeaturedNewsCarousel";
import { FocusTile } from "../../../shared/components/FocusTile";
import { InitialsAvatar, ListRow, RowList } from "../../../shared/components/ListRow";
import { MonthGrid } from "../../../shared/components/MonthGrid";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { Panel } from "../../../shared/components/Panel";
import { PanelLink } from "../../../shared/components/PanelLink";
import { SummaryStrip } from "../../../shared/components/SummaryStrip";
import { ViewToggle } from "../../../shared/components/ViewToggle";
import { useClassView } from "../../../shared/hooks/useClassView";
import { DashboardHeader } from "../../../shared/layout/DashboardHeader";
import { inMonth, type CalendarMark } from "../../../shared/lib/calendar";
import { cn } from "../../../shared/lib/cn";
import { formatDue, formatFullDate, formatMonth } from "../../../shared/lib/format";
import { greeting } from "../../../shared/lib/greeting";
import { featuredSlides, upcomingSchoolEvents, type SchoolEvent } from "../../../shared/lib/schoolNews";
import { termStatus } from "../../../shared/lib/term";
import { classTones, onFillFocus } from "../../../shared/lib/tones";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import { subjectOf, yearLevels, yearOf } from "../api/selectors";
import type { RoleStore } from "../api/types";
import { InstructorClassList } from "../components/InstructorClassList";
import { YearFilter } from "../components/YearFilter";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

const events = academicEvents as SchoolEvent[];

/** School dates plus this instructor's deadlines for the month review. */
function monthMarks(store: RoleStore, roomIds: Set<string>): CalendarMark[] {
  const moduleRoom = new Map(store.modules.map((module) => [module.id, module.classroomId]));
  return [
    ...events.map((item) => ({ id: item.id, title: item.title, date: new Date(`${item.date}T12:00:00`), kind: "event" as const })),
    ...store.exams.filter((item) => item.dueAt && !item.draft && item.status !== "inactive" && roomIds.has(item.classroomId)).map((item) => ({ id: item.id, title: item.title, date: new Date(item.dueAt ?? ""), kind: "deadline" as const })),
    ...store.activities.filter((item) => item.dueAt && !item.draft && roomIds.has(moduleRoom.get(item.moduleId) ?? "")).map((item) => ({ id: item.id, title: item.title, date: new Date(item.dueAt ?? ""), kind: "deadline" as const })),
  ];
}

function Overview({ onNews }: { onNews: () => void }) {
  const navigate = useNavigate();
  const { store, rooms, queue, term } = useInstructorWorkspace();
  const [year, setYear] = useState<number | "all">("all");
  const [classView, setClassView] = useClassView();
  const [now] = useState(Date.now);
  const visible = year === "all" ? rooms : rooms.filter((room) => yearOf(room) === year);
  const marks = inMonth(monthMarks(store, new Set(rooms.map((room) => room.id))), new Date(now));
  const activeAssessments = store.exams.filter((item) => item.status !== "inactive" && rooms.some((room) => room.id === item.classroomId)).length;
  const reached = store.enrollments.filter((item) => item.status === "active" && rooms.some((room) => room.id === item.classroomId)).length;
  const openReview = (id?: string) => {
    const item = id ? queue.find((entry) => entry.id === id) : queue[0];
    const room = item?.classroomId ?? rooms[0]?.id;
    if (room) navigate(instructorPaths.classPage(room, "Submissions", { review: item?.id }));
  };

  const next = queue[0];
  const upcoming = marks.filter((item) => item.date.getTime() >= now - 24 * 60 * 60 * 1000).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);

  return (
    // A bento grid: tiles share one gutter and stretch to their row (D-026, D-066).
    <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12">
      <FocusTile id="review-queue" icon={<Inbox />} title="Review queue" className="@4xl:col-span-5">
        <div className="flex flex-col gap-1">
          {queue.length ? (
            <>
              <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                <strong className="text-display font-semibold tabular-nums">{queue.length}</strong>
                <span className="text-card-title font-semibold">{queue.length === 1 ? "submission is waiting for a grade" : "submissions are waiting for a grade"}</span>
              </p>
              {next && <p className="m-0 text-body text-primary-100">Next: {next.student?.firstName ?? "Student"} {next.student?.lastName ?? ""} · {next.title}</p>}
            </>
          ) : (
            <p className="m-0 text-card-title font-semibold">Your review queue is clear.</p>
          )}
        </div>
        <Button variant="secondary" className={cn("mt-auto self-start", onFillFocus)} onClick={() => openReview()}>Review student work<ArrowRight aria-hidden className="size-4" /></Button>
      </FocusTile>
      <SummaryStrip
        className="@4xl:col-span-7"
        label="Summary"
        items={[
          { icon: <School />, tone: classTones[0], value: rooms.length, label: "Assigned classrooms", note: term },
          { icon: <Inbox />, tone: classTones[1], value: queue.length, label: "Awaiting review", note: queue.length ? "Handed-in work without a grade" : "Nothing to grade", onOpen: queue.length ? () => openReview() : undefined },
          { icon: <ClipboardCheck />, tone: classTones[2], value: activeAssessments, label: "Active assessments", note: `Across ${rooms.length} ${rooms.length === 1 ? "classroom" : "classrooms"}` },
          { icon: <UsersRound />, tone: classTones[3], value: reached, label: "Students reached", note: "Active enrollments" },
        ]}
      />

      {/* 12 columns: classes 7 | calendar 5 (two rows), then review 7. */}
      <Panel
        id="classes-in-progress"
        className="@4xl:col-span-7"
        icon={<Layers />}
        title="Classes in progress"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={classView} onChange={setClassView} />
            <PanelLink onClick={() => navigate(instructorPaths.classes(year))}>All classrooms</PanelLink>
          </div>
        }
      >
        <YearFilter levels={yearLevels(rooms)} selected={year} onSelect={setYear} />
        <InstructorClassList tile store={store} rooms={visible} view={classView} onOpen={(room) => navigate(instructorPaths.classPage(room.id))} />
      </Panel>
      <Panel
        id="month-review"
        className="@4xl:col-span-5 @4xl:row-span-2"
        icon={<CalendarDays />}
        title="Academic calendar"
        description={`${formatMonth(new Date(now))} · ${marks.filter((item) => item.kind === "event").length} academic dates · ${marks.filter((item) => item.kind === "deadline").length} class deadlines`}
        action={<PanelLink onClick={onNews}>Announcements</PanelLink>}
      >
        <MonthGrid month={new Date(now)} entries={marks} now={now} label={`${formatMonth(new Date(now))} academic calendar`} />
        {/* Read-only: deadlines open from their class (C-015). */}
        <RowList>
          {upcoming.map((item) => (
            <ListRow key={item.id} lead={<DateTile date={item.date} />} title={item.title} meta={item.kind === "deadline" ? "Class deadline" : "Academic date"} />
          ))}
        </RowList>
      </Panel>
      <Panel
        id="needs-review"
        className="@4xl:col-span-7"
        icon={<Inbox />}
        title="Needs your review"
        count={queue.length}
      >
        {queue.length ? (
          <RowList className="flex-1">
            {queue.slice(0, 3).map((item) => (
              <ListRow
                key={item.id}
                onOpen={() => openReview(item.id)}
                chevron={false}
                lead={<InitialsAvatar firstName={item.student?.firstName} lastName={item.student?.lastName} />}
                title={`${item.student?.firstName ?? "Student"} ${item.student?.lastName ?? ""}`.trim()}
                meta={`${item.title} · ${item.kind === "activity" ? "Assignment" : "Assessment"}`}
                trail={<span className="shrink-0 text-body font-semibold text-primary-700">Review</span>}
              />
            ))}
          </RowList>
        ) : (
          <EmptyState className="flex-1 justify-center" icon={<ClipboardCheck />} title="Your review queue is clear" description="New work will appear here after students submit." />
        )}
      </Panel>
    </div>
  );
}

function News({ onCalendar }: { onCalendar: () => void }) {
  const navigate = useNavigate();
  const { store, rooms } = useInstructorWorkspace();
  const [now] = useState(Date.now);
  const roomIds = new Set(rooms.map((room) => room.id));
  const announcements = (store.announcements ?? []).filter((item) => roomIds.has(item.classroomId) && item.status !== "inactive").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = upcomingSchoolEvents(events, now).slice(0, 6);
  const classLabel = (classroomId: string) => {
    const room = store.classrooms.find((item) => item.id === classroomId);
    return `${subjectOf(store, room)?.title ?? "Class"} · ${room?.section ?? ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <FeaturedNewsCarousel slides={featuredSlides(featuredAnnouncements, events, now)} onViewCalendar={onCalendar} />
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
        <section aria-labelledby="teacher-news" className="flex flex-col gap-3">
          <SectionHeading id="teacher-news" icon={<Megaphone />} title="Teacher announcements" count={announcements.length} />
          {announcements.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {announcements.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(instructorPaths.classPage(item.classroomId, "Announcements"))}
                    className="flex w-full flex-col items-start gap-1 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
                  >
                    <span className="text-body text-muted">{classLabel(item.classroomId)} · {formatDue(item.createdAt)}</span>
                    <strong className="text-card-title font-semibold">{item.title}</strong>
                    <span className="line-clamp-2 text-body">{item.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No class announcements yet. Post one from a class’s Announcements tab.</p>
          )}
        </section>
        <section aria-labelledby="school-news" className="flex flex-col gap-3">
          <SectionHeading id="school-news" icon={<School />} title="School announcements" count={upcoming.length} />
          <Card className="px-4 sm:px-5">
            <RowList>
              {upcoming.map((item) => (
                <ListRow key={item.id} lead={<DateTile date={new Date(`${item.date}T00:00:00`)} />} title={item.title} meta={`${item.category} · Academic calendar`} />
              ))}
            </RowList>
          </Card>
        </section>
      </div>
    </div>
  );
}

export default function OverviewPage({ onNavigateRole }: { onNavigateRole: (role: string) => void }) {
  const [now] = useState(Date.now);
  const term = termStatus(events, now);
  const { instructors, instructor, rooms } = useInstructorWorkspace();
  const { setInstructorId } = useInstructorSession();
  const [view, setView] = useState<"overview" | "news">("overview");

  return (
    <>
      <DashboardHeader
        meta={<>{formatFullDate(now)}{term?.phase === "in" && <> · {term.name}, Week {term.week}</>}</>}
        title={`${greeting(now)}, ${instructor.firstName}`}
        controls={
          <>
            {instructors.length > 1 && (
              <label className="flex flex-col gap-1 font-sans text-body text-muted">
                Viewing instructor
                <select
                  aria-label="Choose demo instructor"
                  value={instructor.id}
                  onChange={(event) => setInstructorId(event.target.value)}
                  className="min-h-touch rounded-control border border-line-strong bg-surface px-3 text-body-lg text-ink focus-visible:outline-3 focus-visible:outline-focus"
                >
                  {instructors.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
                </select>
              </label>
            )}
            <SegmentedControl
              label="Dashboard content"
              value={view}
              onChange={setView}
              options={[
                { value: "overview", label: "Overview" },
                { value: "news", label: "News & announcements", icon: <Megaphone aria-hidden /> },
              ]}
            />
          </>
        }
      />
      {!rooms.length ? (
        <EmptyState
          icon={<BookOpen />}
          title="No classrooms assigned yet"
          description="Classes are assigned in ISMS. Once the registrar schedules a class for this instructor, it appears here."
          action={
            <Button variant="secondary" onClick={() => onNavigateRole("admin")}>Open Admin workspace</Button>
          }
        />
      ) : view === "overview" ? (
        <Overview onNews={() => setView("news")} />
      ) : (
        <News onCalendar={() => setView("overview")} />
      )}
    </>
  );
}
