import { AlarmClock, ArrowRight, BookOpen, CalendarDays, ChevronRight, ClipboardCheck, Megaphone, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { formatDay, formatDue, formatFullDate, formatMonth } from "../../../shared/lib/format";
import { featuredSlides } from "../../../shared/lib/schoolNews";
import { cn } from "../../../shared/lib/cn";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { STUDENT } from "../api/catalog";
import { calendarEntries, dueSoon, dueThisWeek, greeting, inMonth, schoolEventsThisWeek, upcomingSchoolEvents } from "../api/selectors";
import type { StudentCatalog } from "../api/types";
import { ClassCard } from "../components/ClassCard";
import { FeaturedNewsCarousel } from "../../../shared/components/FeaturedNewsCarousel";
import { MonthGrid } from "../../../shared/components/MonthGrid";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { StatCard } from "../../../shared/components/StatCard";
import { toneFor } from "../../../shared/lib/tones";
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

/** One-time orientation for people moving from the classic UI (plan §7). */
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
      <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-700" />
      <div className="flex flex-1 flex-col gap-1">
        <h2 id="new-design-title" className="m-0 text-body font-semibold text-ink">Welcome to the new design</h2>
        <p className="m-0 text-body text-ink">
          Everything is where you expect: Today, Tasks, your classes, and the calendar. On a phone they are in the bar at the bottom. Your saved work carried over.
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

function Overview({ catalog, completed, now }: { catalog: StudentCatalog; completed: string[]; now: number }) {
  const navigate = useNavigate();
  const { courses, assessments, academicEvents } = catalog;
  const coming = dueSoon(assessments, completed, now);
  const weekEvents = schoolEventsThisWeek(academicEvents, now);
  const month = new Date(now);
  const monthEntries = inMonth(calendarEntries(assessments, academicEvents), month);
  const courseIndex = (id: string) => courses.findIndex((course) => course.id === id);
  const first = courses[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<BookOpen />} tone="bg-primary-100 text-primary-700" value={courses.length} label="Active classes" note="This term" />
        <StatCard icon={<AlarmClock />} tone="bg-accent-100 text-accent-700" value={dueThisWeek(assessments, completed, now).length} label="Due this week" note="Keep going" onOpen={() => navigate(studentPaths.tasks("Due this week"))} />
        <StatCard icon={<ClipboardCheck />} tone="bg-success-soft text-success" value={completed.length} label="Assessments done" note="Great progress" onOpen={() => navigate(studentPaths.tasks("Done"))} />
        <StatCard
          icon={<CalendarDays />}
          tone="bg-info-soft text-info"
          value={weekEvents.length}
          label="Academic events"
          note={weekEvents.length ? weekEvents.slice(0, 2).map((item) => `${formatDay(`${item.date}T00:00:00`)} · ${item.title}`).join("; ") : "No school events this week"}
          onOpen={() => navigate(studentPaths.calendar(true))}
        />
      </div>

      <section aria-labelledby="your-classes" className="flex flex-col gap-4">
        <SectionHeading
          id="your-classes"
          eyebrow="Your learning space"
          title="Your classes"
          count={courses.length}
          action={first && <Button variant="ghost" className="max-w-full shrink py-2 text-left whitespace-normal" onClick={() => navigate(studentPaths.classPage(first.id))}>Open {first.name}<ArrowRight aria-hidden className="size-4" /></Button>}
        />
        {courses.length ? (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 2xl:grid-cols-4">
            {courses.map((course, index) => (
              <li key={course.id}><ClassCard course={course} index={index} onOpen={() => navigate(studentPaths.classPage(course.id))} /></li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<BookOpen />} title="You are not enrolled in any classes yet" description="Classes appear here once your enrollment is active." />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="coming-up" className="flex flex-col gap-4">
          <SectionHeading id="coming-up" eyebrow="Stay on track" title="Coming up" count={coming.length} />
          <Card className="flex flex-col p-2">
            {coming.length ? (
              <ul className="m-0 flex list-none flex-col p-0">
                {coming.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(studentPaths.assessment(item.id))}
                      className="flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent p-3 text-left font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                    >
                      <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-control", toneFor(courseIndex(item.courseId)))}>
                        <AssessmentTypeIcon type={item.type} className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate text-body font-semibold">{item.title}</strong>
                        <span className="text-body text-muted">{courses[courseIndex(item.courseId)]?.name} · {item.type}</span>
                      </span>
                      <span className="hidden shrink-0 text-body text-muted sm:inline">{formatDue(item.dueAt)}</span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 p-3 text-body text-muted">Nothing due soon. Enjoy your focus time.</p>
            )}
            {first && (
              <Button variant="ghost" className="self-start" onClick={() => navigate(studentPaths.classPage(first.id))}>
                See all classwork<ArrowRight aria-hidden className="size-4" />
              </Button>
            )}
          </Card>
        </section>

        <section aria-labelledby="month-review" className="flex flex-col gap-4">
          <SectionHeading id="month-review" eyebrow={`Month review · ${formatMonth(month)}`} title="Academic calendar" />
          <Card className="flex flex-col gap-3 p-4">
            <p className="m-0 text-body text-muted">
              {monthEntries.filter((item) => !item.assessment).length} academic dates · {monthEntries.filter((item) => item.assessment).length} assessment deadlines
            </p>
            <MonthGrid month={month} entries={monthEntries} now={now} label={`${formatMonth(month)} academic calendar`} />
            <Button variant="secondary" onClick={() => navigate(studentPaths.calendar())}>Open calendar<ArrowRight aria-hidden className="size-4" /></Button>
          </Card>
        </section>
      </div>
    </>
  );
}

function News({ catalog, now }: { catalog: StudentCatalog; now: number }) {
  const navigate = useNavigate();
  const upcoming = upcomingSchoolEvents(catalog.academicEvents, now);
  const courseName = (id: string) => catalog.courses.find((course) => course.id === id)?.name ?? "Class";
  const first = catalog.courses[0];
  return (
    <div className="flex flex-col gap-6">
      <FeaturedNewsCarousel slides={featuredSlides(catalog.featured, catalog.academicEvents, now)} onViewCalendar={() => navigate(studentPaths.calendar())} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="teacher-news" className="flex flex-col gap-3">
          <SectionHeading id="teacher-news" eyebrow="Your classes" title="Teacher announcements" />
          {catalog.announcements.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {catalog.announcements.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Card className="flex flex-col gap-1 p-4">
                    <p className="m-0 text-body text-muted">{item.author} · {courseName(item.classroomId)} · {formatDue(item.createdAt)}</p>
                    <h3 className="m-0 text-card-title font-semibold">{item.title}</h3>
                    <p className="m-0 text-body whitespace-pre-line">{item.message}</p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="flex flex-col gap-2 p-4">
              <p className="m-0 text-body text-muted">{first ? `${first.teacher} · ${first.name}` : "Your teachers"}</p>
              <h3 className="m-0 text-card-title font-semibold">Welcome to another week of learning!</h3>
              <p className="m-0 text-body">Class announcements from your teachers will appear here. Check your classwork for this week’s activities.</p>
              {first && <Button variant="ghost" className="self-start" onClick={() => navigate(studentPaths.classPage(first.id, "Classwork"))}>Explore this week’s work<ArrowRight aria-hidden className="size-4" /></Button>}
            </Card>
          )}
        </section>
        <section aria-labelledby="school-news" className="flex flex-col gap-3">
          <SectionHeading id="school-news" eyebrow="TMCC LMS" title="School announcements" count={upcoming.length} />
          <Card className="p-2">
            {upcoming.length ? (
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
            ) : (
              <p className="m-0 p-3 text-body text-muted">No upcoming school announcements.</p>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { catalog, completed, now } = useWorkspace();
  const [view, setView] = useState<"overview" | "news">("overview");
  const toggle = "min-h-touch rounded-control border-0 px-4 font-sans text-body font-medium focus-visible:outline-3 focus-visible:outline-focus";

  return (
    <>
      <PageHeader
        eyebrow={formatFullDate(now)}
        title={`${greeting(now)}, ${STUDENT.firstName}`}
        description="Ready to make today a great learning day?"
        actions={
          <div role="group" aria-label="Dashboard content" className="inline-flex rounded-card border border-line bg-surface p-1">
            <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")} className={cn(toggle, view === "overview" ? "bg-primary-600 text-white" : "bg-transparent text-ink hover:bg-primary-50")}>Overview</button>
            <button type="button" aria-pressed={view === "news"} onClick={() => setView("news")} className={cn(toggle, "inline-flex items-center gap-2", view === "news" ? "bg-primary-600 text-white" : "bg-transparent text-ink hover:bg-primary-50")}>
              <Megaphone aria-hidden className="size-4" />News &amp; announcements
            </button>
          </div>
        }
      />
      <NewDesignIntro />
      {view === "overview" ? <Overview catalog={catalog} completed={completed} now={now} /> : <News catalog={catalog} now={now} />}
    </>
  );
}
