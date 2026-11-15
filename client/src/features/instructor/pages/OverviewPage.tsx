import { ArrowRight, BookOpen, ClipboardCheck, Inbox, Megaphone, School, UsersRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { academicEvents, featuredAnnouncements } from "../../../data.js";
import { FeaturedNewsCarousel } from "../../../shared/components/FeaturedNewsCarousel";
import { MonthGrid } from "../../../shared/components/MonthGrid";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { StatCard } from "../../../shared/components/StatCard";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { inMonth, type CalendarMark } from "../../../shared/lib/calendar";
import { cn } from "../../../shared/lib/cn";
import { formatDay, formatDue, formatMonth } from "../../../shared/lib/format";
import { featuredSlides, upcomingSchoolEvents, type SchoolEvent } from "../../../shared/lib/schoolNews";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { classContent, classMark, enrolledCount, subjectOf, yearLevels, yearOf } from "../api/selectors";
import type { RoleStore } from "../api/types";
import { InstructorClassCard } from "../components/InstructorClassCard";
import { YearFilter } from "../components/YearFilter";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

const events = academicEvents as SchoolEvent[];

function greetingFor(now: number) {
  const hour = new Date(now).getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** School dates plus this instructor's deadlines for the month review. */
function monthMarks(store: RoleStore, roomIds: Set<string>): CalendarMark[] {
  const moduleRoom = new Map(store.modules.map((module) => [module.id, module.classroomId]));
  return [
    ...events.map((item) => ({ id: item.id, title: item.title, date: new Date(`${item.date}T12:00:00`), kind: "event" as const })),
    ...store.exams.filter((item) => item.dueAt && item.status !== "inactive" && roomIds.has(item.classroomId)).map((item) => ({ id: item.id, title: item.title, date: new Date(item.dueAt ?? ""), kind: "deadline" as const })),
    ...store.activities.filter((item) => item.dueAt && roomIds.has(moduleRoom.get(item.moduleId) ?? "")).map((item) => ({ id: item.id, title: item.title, date: new Date(item.dueAt ?? ""), kind: "deadline" as const })),
  ];
}

function Overview({ onNews }: { onNews: () => void }) {
  const navigate = useNavigate();
  const { store, instructor, rooms, queue } = useInstructorWorkspace();
  const [year, setYear] = useState<number | "all">("all");
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

  return (
    <>
      <section aria-labelledby="teaching-greeting" className="flex flex-col gap-4 rounded-card bg-primary-700 p-5 font-sans text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex flex-col gap-2">
          <p className="m-0 text-label font-semibold tracking-wide text-primary-100 uppercase">Your teaching space</p>
          <h2 id="teaching-greeting" className="m-0 text-section font-bold sm:text-page-mobile">{greetingFor(now)}, {instructor.firstName}.</h2>
          <p className="m-0 max-w-prose text-body text-primary-100">Your classrooms are ready. Keep feedback moving and help students stay on track.</p>
        </div>
        <Button variant="secondary" size="lg" className="self-start sm:self-center" onClick={() => openReview()}>Review student work<ArrowRight aria-hidden className="size-4" /></Button>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<School />} tone="bg-primary-100 text-primary-700" value={rooms.length} label="Assigned classrooms" note="Ready for your next lesson" />
        <StatCard icon={<Inbox />} tone="bg-accent-100 text-accent-700" value={queue.length} label="Awaiting review" note="Student assessment submissions" onOpen={queue.length ? () => openReview() : undefined} />
        <StatCard icon={<ClipboardCheck />} tone="bg-info-soft text-info" value={activeAssessments} label="Active assessments" note="Across your classrooms" />
        <StatCard icon={<UsersRound />} tone="bg-success-soft text-success" value={reached} label="Students reached" note="Active enrollments" />
      </div>

      <section aria-labelledby="classes-in-progress" className="flex flex-col gap-4">
        <SectionHeading
          id="classes-in-progress"
          eyebrow="Your course rooms"
          title="Classes in progress"
          action={<Button variant="ghost" onClick={() => navigate(instructorPaths.classes(year))}>All classrooms<ArrowRight aria-hidden className="size-4" /></Button>}
        />
        <p className="m-0 -mt-2 text-body text-muted">Choose a classroom to prepare materials and coursework.</p>
        <YearFilter levels={yearLevels(rooms)} selected={year} onSelect={setYear} />
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((room, index) => {
            const subject = subjectOf(store, room);
            const content = classContent(store, room.id);
            return (
              <li key={room.id}>
                <InstructorClassCard
                  title={subject?.title ?? "Classroom"}
                  section={room.section}
                  mark={classMark(subject)}
                  index={index}
                  students={enrolledCount(store, room.id)}
                  coursework={content.exams.length + content.activities.length}
                  onOpen={() => navigate(instructorPaths.classPage(room.id))}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="needs-review" className="flex flex-col gap-4">
          <SectionHeading
            id="needs-review"
            eyebrow="Teacher inbox"
            title="Needs your review"
            count={queue.length}
            action={<Button variant="ghost" onClick={() => openReview()}>Open review queue<ArrowRight aria-hidden className="size-4" /></Button>}
          />
          {queue.length ? (
            <Card className="p-2">
              <ul className="m-0 flex list-none flex-col p-0">
                {queue.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openReview(item.id)}
                      className="flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent p-3 text-left font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                    >
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">
                        {(item.student?.firstName?.[0] ?? "A") + (item.student?.lastName?.[0] ?? "R")}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className="text-body font-semibold">{item.student?.firstName ?? "Alex"} {item.student?.lastName ?? "Rivera"}</strong>
                        <span className="truncate text-body text-muted">{item.title} · {item.kind === "activity" ? "Assignment" : "Assessment"}</span>
                      </span>
                      <span className="text-body font-medium text-primary-700">Review</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              icon={<ClipboardCheck />}
              title="Your review queue is clear"
              description="New work will appear here after students submit."
            />
          )}
        </section>
        <section aria-labelledby="month-review" className="flex flex-col gap-4">
          <SectionHeading id="month-review" eyebrow={`Month review · ${formatMonth(new Date(now))}`} title="Academic calendar" />
          <Card className="flex flex-col gap-3 p-4">
            <p className="m-0 text-body text-muted">{marks.filter((item) => item.kind === "event").length} academic dates · {marks.filter((item) => item.kind === "deadline").length} class deadlines</p>
            <MonthGrid month={new Date(now)} entries={marks} now={now} label={`${formatMonth(new Date(now))} academic calendar`} />
            <Button variant="secondary" onClick={onNews}><Megaphone aria-hidden className="size-4" />View announcements</Button>
          </Card>
        </section>
      </div>
    </>
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="teacher-news" className="flex flex-col gap-3">
          <SectionHeading id="teacher-news" eyebrow="Your classes" title="Teacher announcements" count={announcements.length} />
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
          <SectionHeading id="school-news" eyebrow="TMCC LMS" title="School announcements" count={upcoming.length} />
          <Card className="p-2">
            <ul className="m-0 flex list-none flex-col p-0">
              {upcoming.map((item) => (
                <li key={item.id} className="flex items-center gap-4 rounded-control p-3">
                  <time dateTime={item.date} className="w-14 shrink-0 rounded-control bg-primary-100 py-1.5 text-center text-body font-semibold text-primary-700">{formatDay(`${item.date}T00:00:00`)}</time>
                  <span className="flex flex-col">
                    <strong className="text-body font-semibold">{item.title}</strong>
                    <span className="text-body text-muted">{item.category} · Academic calendar</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}

export default function OverviewPage({ onNavigateRole }: { onNavigateRole: (role: string) => void }) {
  const { instructors, instructor, rooms } = useInstructorWorkspace();
  const { setInstructorId, openCreateClass } = useInstructorSession();
  const [view, setView] = useState<"overview" | "news">("overview");
  const toggle = "inline-flex min-h-touch items-center gap-2 rounded-control border-0 px-4 font-sans text-body font-medium focus-visible:outline-3 focus-visible:outline-focus";

  return (
    <>
      <PageHeader
        eyebrow="Instructor workspace"
        title="Your teaching day"
        description="Keep coursework moving and give every submission timely attention."
        actions={
          <div className="flex flex-wrap items-end gap-3">
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
            <div role="group" aria-label="Dashboard content" className="inline-flex rounded-card border border-line bg-surface p-1">
              <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")} className={cn(toggle, view === "overview" ? "bg-primary-600 text-white" : "bg-transparent text-ink hover:bg-primary-50")}>Overview</button>
              <button type="button" aria-pressed={view === "news"} onClick={() => setView("news")} className={cn(toggle, view === "news" ? "bg-primary-600 text-white" : "bg-transparent text-ink hover:bg-primary-50")}><Megaphone aria-hidden className="size-4" />News &amp; announcements</button>
            </div>
          </div>
        }
      />
      {!rooms.length ? (
        <EmptyState
          icon={<BookOpen />}
          title="No classrooms assigned yet"
          description="Ask an admin to assign a classroom to this instructor, or create one now."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={openCreateClass}>Create class</Button>
              <Button variant="secondary" onClick={() => onNavigateRole("admin")}>Open Admin workspace</Button>
            </div>
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
