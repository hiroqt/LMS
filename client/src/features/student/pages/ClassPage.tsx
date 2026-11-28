import { ArrowRight, BookOpen, CalendarDays, ChevronRight, ClipboardList, Clock3, ExternalLink, FileText, FolderTree, GraduationCap, MapPin, PencilRuler, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackLink } from "../../../shared/components/BackLink";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { attendancePercent, formatPercent, monthKey, monthLabel } from "../../../shared/lib/attendance";
import { FilterChip, FilterChipGroup } from "../../../shared/ui/FilterChip";
import { formatDue } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { courseModules, courseTopic, dueSoon, type Topic, type TopicCategory, type TopicEntry } from "../api/selectors";
import type { Course, StudentCatalog } from "../api/types";
import { AssessmentRow } from "../components/AssessmentRow";
import { ListSearch } from "../components/ListSearch";
import { ClassMaterials, MaterialRows } from "../components/MaterialList";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { CourseHeader } from "../../../shared/components/CourseHeader";
import { termStatus } from "../../../shared/lib/term";
import { toneFor } from "../../../shared/lib/tones";
import { courseCode } from "../api/catalog";
import { useWorkspace } from "../hooks/useWorkspace";
import { CLASS_TABS, isClassTab, studentPaths, type ClassTab } from "../paths";

function Stream({ course, catalog, completed, now, onTab }: { course: Course; catalog: StudentCatalog; completed: string[]; now: number; onTab: (tab: ClassTab) => void }) {
  const navigate = useNavigate();
  const announcements = catalog.announcements.filter((item) => item.classroomId === course.id);
  const resource = catalog.materials.find((item) => item.courseId === course.id);
  const upcoming = dueSoon(catalog.assessments.filter((item) => item.courseId === course.id), completed, now);

  return (
    <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        {announcements.length ? (
          announcements.map((item) => (
            <Card key={item.id} className="flex flex-col gap-2 p-5">
              <p className="m-0 text-body text-muted">{item.author} · Class announcement · {formatDue(item.createdAt)}</p>
              <h2 className="m-0 font-sans text-section font-semibold">{item.title}</h2>
              <p className="m-0 text-body whitespace-pre-line">{item.message}</p>
            </Card>
          ))
        ) : (
          <Card className="flex flex-col gap-2 p-5">
            <p className="m-0 text-body text-muted">{course.teacher} · Posted an announcement</p>
            <h2 className="m-0 font-sans text-section font-semibold">Welcome to another week of learning!</h2>
            <p className="m-0 text-body">We’re building on what we learned last week. Check the classwork tab for this week’s activities and take a look at the study notes before our next class.</p>
            <Button variant="ghost" className="self-start" onClick={() => onTab("Classwork")}>Explore this week’s work<ArrowRight aria-hidden className="size-4" /></Button>
          </Card>
        )}
        {resource && (
          <Card className="flex items-start gap-3 p-4">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-info-soft text-info"><FileText className="size-5" /></span>
            <div className="flex flex-1 flex-col gap-1">
              <strong className="text-body font-semibold">New material: {resource.title}</strong>
              <span className="text-body text-muted">{course.teacher} · Yesterday</span>
              <Button variant="ghost" className="-ml-4 self-start" onClick={() => navigate(studentPaths.material(resource.id))}>Open material<ArrowRight aria-hidden className="size-4" /></Button>
            </div>
          </Card>
        )}
        <Card className="flex items-start gap-3 p-4">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-100 text-accent-700"><ClipboardList className="size-5" /></span>
          <div className="flex flex-1 flex-col gap-1">
            <strong className="text-body font-semibold">New assignment posted</strong>
            <span className="text-body text-muted">{course.teacher} · Monday</span>
            <Button variant="ghost" className="-ml-4 self-start" onClick={() => onTab("Classwork")}>View classwork<ArrowRight aria-hidden className="size-4" /></Button>
          </div>
        </Card>
      </div>
      <aside aria-label="Class information" className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><CalendarDays aria-hidden className="size-4 text-primary-700" />Upcoming</h2>
          {upcoming.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => navigate(studentPaths.assessment(item.id))} className="flex min-h-touch w-full flex-col items-start justify-center rounded-control border-0 bg-transparent px-2 text-left font-sans hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus">
                    <span className="text-body font-medium text-ink">{item.title}</span>
                    <span className="text-body text-muted">{item.dueAt ? `Due ${formatDue(item.dueAt)}` : "No due date"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-body text-muted">No work is due soon.</p>
          )}
          <Button variant="ghost" className="self-start" onClick={() => onTab("Classwork")}>View all<ArrowRight aria-hidden className="size-4" /></Button>
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><BookOpen aria-hidden className="size-4 text-primary-700" />About this class</h2>
          <p className="m-0 text-body">{course.about}</p>
          <p className="m-0 flex items-center gap-2 text-body text-muted"><UsersRound aria-hidden className="size-4" />{course.count} students</p>
          <p className="m-0 flex items-center gap-2 text-body text-muted"><GraduationCap aria-hidden className="size-4" />{course.room}</p>
        </Card>
      </aside>
    </div>
  );
}

const WORK_FILTERS = ["All work", "Quiz", "Long Quiz", "Exam", "Materials"] as const;
type WorkFilter = (typeof WORK_FILTERS)[number];

function Classwork({ course, catalog, completed, courseIndex }: { course: Course; catalog: StudentCatalog; completed: string[]; courseIndex: number }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<WorkFilter>("All work");
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const work = catalog.assessments.filter((item) => item.courseId === course.id);
  const shownWork = work.filter((item) => (filter === "All work" || item.type === filter) && `${item.title} ${item.description}`.toLowerCase().includes(q));
  const shownMaterials = catalog.materials.filter((item) => item.courseId === course.id && `${item.title} ${item.kind} ${item.file?.name ?? ""}`.toLowerCase().includes(q));
  const count = (type: WorkFilter) => work.filter((item) => item.type === type).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="Classwork" />
        <ListSearch label="Search classwork" placeholder="Find classwork" value={query} onChange={setQuery} />
      </div>
      <FilterChipGroup label="Filter classwork">
        {WORK_FILTERS.map((item) => (
          <FilterChip key={item} selected={filter === item} count={["Quiz", "Long Quiz", "Exam"].includes(item) ? count(item) : undefined} onClick={() => setFilter(item)}>
            {item}
          </FilterChip>
        ))}
      </FilterChipGroup>
      {filter !== "Materials" && (
        <section aria-labelledby="work-list" className="flex flex-col gap-3">
          <h3 id="work-list" className="m-0 font-sans text-card-title font-semibold">{filter === "All work" ? "Assessments" : filter} <span className="font-normal text-muted">· {shownWork.length}</span></h3>
          {shownWork.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {shownWork.map((item) => (
                <li key={item.id}><AssessmentRow item={item} courseIndex={courseIndex} completed={completed.includes(item.id)} onOpen={() => navigate(studentPaths.assessment(item.id))} /></li>
              ))}
            </ul>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No work in this category matches your search.</p>
          )}
        </section>
      )}
      {(filter === "All work" || filter === "Materials") && (
        <section aria-labelledby="material-list" className="flex flex-col gap-3">
          <h3 id="material-list" className="m-0 font-sans text-card-title font-semibold">Learning materials <span className="font-normal text-muted">· {shownMaterials.length}</span></h3>
          {shownMaterials.length ? (
            <div className="rounded-card border border-line bg-surface px-3"><MaterialRows materials={shownMaterials} label="Learning materials" /></div>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No materials found.</p>
          )}
        </section>
      )}
    </div>
  );
}

const TOPIC_ICONS: Record<TopicCategory, typeof FileText> = { Assignments: ClipboardList, Activities: PencilRuler, Assessments: GraduationCap, Materials: FileText };

function TopicEntries({ category, entries }: { category: TopicCategory; entries: TopicEntry[] }) {
  const navigate = useNavigate();
  if (!entries.length) return <p className="m-0 text-body text-muted">No {category.toLowerCase()} in this topic.</p>;
  const Icon = TOPIC_ICONS[category];
  return (
    <ul aria-label={category} className="m-0 flex list-none flex-col gap-2 p-0">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`}>
          <button
            type="button"
            onClick={() => navigate(entry.kind === "material" ? studentPaths.material(entry.id) : studentPaths.assessment(entry.id))}
            className="flex min-h-touch w-full items-center gap-3 rounded-control border border-line bg-surface p-3 text-left font-sans text-ink hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
          >
            <Icon aria-hidden className="size-5 shrink-0 text-primary-700" />
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="text-body font-semibold">{entry.title}</strong>
              <span className="text-body text-muted">{[entry.type, entry.submodule].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One topic: what is placed in it and its submodules, by category (D-070). */
function TopicView({ topic, focusOnOpen, onBack }: { topic: Topic; focusOnOpen: boolean; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnOpen) heading.current?.focus();
  }, [focusOnOpen]);
  return (
    <div className="flex flex-col gap-4">
      <BackLink label="All topics" onBack={onBack} />
      <h2 ref={heading} tabIndex={-1} className="m-0 flex items-center gap-2.5 font-sans text-section font-semibold text-ink focus-visible:outline-3 focus-visible:outline-focus">
        <FolderTree aria-hidden className="size-6 text-primary-700" />
        {topic.module.title}
      </h2>
      {topic.groups.map(({ category, entries }) => (
        <Card key={category} className="p-5">
          <section aria-labelledby={`topic-${category}`} className="flex flex-col gap-3">
            <h3 id={`topic-${category}`} className="m-0 font-sans text-card-title font-semibold">
              {category} <span className="font-normal text-muted">· {entries.length}</span>
            </h3>
            <TopicEntries category={category} entries={entries} />
          </section>
        </Card>
      ))}
    </div>
  );
}

/**
 * The class's topics (its top-level modules) as buttons; one opens on the same
 * tab with its content grouped by category (D-070, supersedes D-033's tree).
 */
function Modules({ course, catalog, courseIndex, topicId, onTopic }: { course: Course; catalog: StudentCatalog; courseIndex: number; topicId: string | null; onTopic: (id: string | null) => void }) {
  const sections = courseModules(catalog, course.id);
  const topic = topicId ? courseTopic(catalog, course.id, topicId) : undefined;
  // Focus follows a click only, so a page opened by URL keeps the shell's h1 focus.
  const [focus, setFocus] = useState<{ to: "topic" } | { to: "button"; id: string } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!topic && focus?.to === "button") buttons.current.get(focus.id)?.focus();
  }, [topic, focus]);

  if (topic) {
    return (
      <TopicView
        topic={topic}
        focusOnOpen={focus?.to === "topic"}
        onBack={() => {
          setFocus({ to: "button", id: topic.module.id });
          onTopic(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Modules" />
      {sections.length ? (
        <ul aria-label="Topics" className="m-0 flex list-none flex-col gap-3 p-0">
          {sections.map(({ module }) => (
            <li key={module.id}>
              <button
                ref={(node) => {
                  if (node) buttons.current.set(module.id, node);
                  else buttons.current.delete(module.id);
                }}
                type="button"
                onClick={() => {
                  setFocus({ to: "topic" });
                  onTopic(module.id);
                }}
                className="group flex min-h-27 w-full items-center gap-4 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none"
              >
                <span aria-hidden className={`grid size-11 shrink-0 place-items-center rounded-control ${toneFor(courseIndex)}`}>
                  <FolderTree className="size-5" />
                </span>
                <strong className="min-w-0 flex-1 text-card-title font-semibold">{module.title}</strong>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted group-hover:text-ink" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">This class has no modules yet.</p>
      )}
    </div>
  );
}

function People({ course, catalog }: { course: Course; catalog: StudentCatalog }) {
  const [query, setQuery] = useState("");
  const roster = catalog.classmates.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="People" count={course.count} />
        <ListSearch label="Find a student" placeholder="Find a student" value={query} onChange={setQuery} />
      </div>
      <Card className="flex items-center gap-3 p-4">
        <span aria-hidden className="grid size-10 place-items-center rounded-control bg-primary-100 text-primary-700"><GraduationCap className="size-5" /></span>
        <div className="flex flex-col">
          <span className="text-body text-muted">Your teacher</span>
          <strong className="text-body font-semibold">{course.teacher}</strong>
        </div>
      </Card>
      <Card className="p-2">
        <p className="m-0 px-3 py-2 text-body text-muted">{roster.length} shown · Name A–Z</p>
        {roster.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {roster.map((student) => (
              <li key={student.id} className="flex items-center gap-3 rounded-control px-3 py-2">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">{student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-body font-medium">{student.name}</strong>
                  <span className="truncate text-body text-muted">{student.email}</span>
                </span>
                <span className="text-body text-muted">{student.role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 px-3 py-2 text-body text-muted">No classmates match your search.</p>
        )}
      </Card>
    </div>
  );
}

function Attendance({ course, catalog }: { course: Course; catalog: StudentCatalog }) {
  const months = catalog.attendance.filter((item) => item.courseId === course.id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionHeading title="Attendance" />
        <p className="m-0 text-body text-muted">Recorded monthly by {course.teacher}: days present ÷ school days. Not counted in grades yet.</p>
      </div>
      {months.length ? (
        <div role="region" aria-labelledby="attendance-caption" tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-surface focus-visible:outline-3 focus-visible:outline-focus">
          <table className="w-full min-w-[26rem] border-collapse text-left font-sans text-body">
            <caption id="attendance-caption" className="px-4 pt-3 text-left font-semibold">Your attendance by month</caption>
            <thead className="text-muted">
              <tr>{["Month", "Days present", "School days", "Attendance"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-medium">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {months.map((item) => (
                <tr key={monthKey(item)} className="border-t border-line">
                  <th scope="row" className="px-4 py-3 font-semibold">{monthLabel(item)}</th>
                  <td className="px-4 py-3">{item.daysPresent ?? "Not recorded"}</td>
                  <td className="px-4 py-3">{item.schoolDays}</td>
                  <td className="px-4 py-3 font-semibold">{item.daysPresent === null ? "—" : formatPercent(attendancePercent(item.daysPresent, item.schoolDays))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No attendance has been recorded for this class yet.</p>
      )}
    </div>
  );
}

export default function ClassPage() {
  const { classId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const term = termStatus(catalog.academicEvents, now)?.name ?? "This term";
  const index = catalog.courses.findIndex((item) => item.id === classId);
  const course = catalog.courses[index];
  if (!course) return <Navigate to={studentPaths.classes} replace />;

  const requested = params.get("tab");
  const tab: ClassTab = isClassTab(requested) ? requested : "Stream";
  const setTab = (next: ClassTab) => setParams(next === "Stream" ? {} : { tab: next }, { replace: true });
  const workCount = catalog.assessments.filter((item) => item.courseId === course.id).length;
  const topicId = tab === "Modules" ? params.get("topic") : null;
  // A topic is its own history entry, so Back returns to the list of topics.
  const setTopic = (id: string | null) => setParams(id ? { tab: "Modules", topic: id } : { tab: "Modules" });

  return (
    <>
      <CourseHeader
        code={courseCode(course)}
        section={course.section}
        term={term}
        title={course.name}
        subject={course.subject}
        breadcrumbLabel="My classes"
        onBreadcrumb={() => navigate(studentPaths.classes)}
        facts={[
          { label: "Instructor", value: course.teacher, icon: <GraduationCap /> },
          { label: "Room", value: course.room, icon: <MapPin /> },
          { label: "Enrolled", value: `${course.count} students`, icon: <UsersRound /> },
          { label: "Next class", value: course.next, icon: <Clock3 /> },
        ]}
        actions={
          course.id === "biology" && (
            <Button asChild variant="secondary">
              <a href="https://discord.com/app" target="_blank" rel="noreferrer">Join live class on Discord<ExternalLink aria-hidden className="size-4" /><span className="sr-only"> (opens in a new tab)</span></a>
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={(value) => isClassTab(value) && setTab(value)}>
        <TabsList aria-label="Class sections">
          {CLASS_TABS.map((item) => (
            <TabsTrigger key={item} value={item}>
              {item}
              {item === "Classwork" && <span className="rounded-full bg-canvas px-2 text-body font-semibold">{workCount}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Stream"><Stream course={course} catalog={catalog} completed={completed} now={now} onTab={setTab} /></TabsContent>
        <TabsContent value="Classwork"><Classwork course={course} catalog={catalog} completed={completed} courseIndex={index} /></TabsContent>
        <TabsContent value="Modules"><Modules course={course} catalog={catalog} courseIndex={index} topicId={topicId} onTopic={setTopic} /></TabsContent>
        <TabsContent value="Materials"><ClassMaterials course={course} catalog={catalog} /></TabsContent>
        <TabsContent value="People"><People course={course} catalog={catalog} /></TabsContent>
        <TabsContent value="Attendance"><Attendance course={course} catalog={catalog} /></TabsContent>
      </Tabs>
    </>
  );
}
