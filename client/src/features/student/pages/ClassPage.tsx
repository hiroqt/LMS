import { ArrowRight, BookOpen, CalendarDays, ClipboardList, Clock3, ExternalLink, FileText, FolderTree, GraduationCap, MapPin, Search, UsersRound } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { attendancePercent, formatPercent, monthKey, monthLabel } from "../../../shared/lib/attendance";
import { cn } from "../../../shared/lib/cn";
import { formatDue } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { courseModules, dueSoon, type ModuleEntry } from "../api/selectors";
import type { Course, StudentCatalog } from "../api/types";
import { AssessmentRow } from "../components/AssessmentRow";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { CourseHeader } from "../../../shared/components/CourseHeader";
import { termStatus } from "../../../shared/lib/term";
import { courseCode } from "../api/catalog";
import { useWorkspace } from "../hooks/useWorkspace";
import { CLASS_TABS, isClassTab, studentPaths, type ClassTab } from "../paths";

function ListSearch({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-touch w-full rounded-control border border-line-strong bg-surface pr-3 pl-9 font-sans text-body-lg text-ink placeholder:text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus"
      />
    </div>
  );
}

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
            <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">This week in {course.subject}</p>
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
  const shownMaterials = catalog.materials.filter((item) => item.courseId === course.id && `${item.title} ${item.kind}`.toLowerCase().includes(q));
  const count = (type: WorkFilter) => work.filter((item) => item.type === type).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="Classwork" />
        <ListSearch label="Search classwork" placeholder="Find classwork" value={query} onChange={setQuery} />
      </div>
      <div role="group" aria-label="Filter classwork" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {WORK_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={cn(
              "inline-flex min-h-touch shrink-0 items-center gap-2 rounded-full border px-4 font-sans text-body font-medium focus-visible:outline-3 focus-visible:outline-focus",
              filter === item ? "border-primary-600 bg-primary-600 text-white" : "border-line-strong bg-surface text-ink hover:bg-primary-50",
            )}
          >
            {item}
            {["Quiz", "Long Quiz", "Exam"].includes(item) && <span className={cn("rounded-full px-2 font-semibold", filter === item ? "bg-primary-800" : "bg-canvas")}>{count(item)}</span>}
          </button>
        ))}
      </div>
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
          <MaterialGrid materials={shownMaterials} />
        </section>
      )}
    </div>
  );
}

function MaterialGrid({ materials }: { materials: StudentCatalog["materials"] }) {
  const navigate = useNavigate();
  if (!materials.length) return <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No materials found.</p>;
  return (
    <ul className="m-0 grid list-none gap-3 p-0 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
      {materials.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => navigate(studentPaths.material(item.id))}
            className="flex h-full w-full flex-col items-start gap-2 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
          >
            <span className="text-label font-semibold tracking-wide text-primary-700 uppercase">{item.kind}</span>
            <strong className="text-card-title font-semibold">{item.title}</strong>
            <span className="line-clamp-3 text-body text-muted">{item.summary}</span>
            <span className="mt-auto text-body text-muted">{item.readTime} read · {item.added}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ModuleEntries({ label, entries }: { label: string; entries: ModuleEntry[] }) {
  const navigate = useNavigate();
  if (!entries.length) return <p className="m-0 text-body text-muted">Nothing in {label} yet.</p>;
  return (
    <ul aria-label={`Content in ${label}`} className="m-0 flex list-none flex-col gap-2 p-0">
      {entries.map((entry) => {
        const Icon = entry.kind === "material" ? FileText : ClipboardList;
        return (
          <li key={`${entry.kind}-${entry.id}`}>
            <button
              type="button"
              onClick={() => navigate(entry.kind === "material" ? studentPaths.material(entry.id) : studentPaths.assessment(entry.id))}
              className="flex min-h-touch w-full items-center gap-3 rounded-control border border-line bg-surface p-3 text-left font-sans text-ink hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
            >
              <Icon aria-hidden className="size-5 shrink-0 text-primary-700" />
              <span className="flex min-w-0 flex-1 flex-col">
                <strong className="text-body font-semibold">{entry.title}</strong>
                <span className="text-body text-muted">{entry.kind === "material" ? `Material · ${entry.type}` : entry.type}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The class's modules with their submodules, and what is placed in each (D-033). */
function Modules({ course, catalog }: { course: Course; catalog: StudentCatalog }) {
  const sections = courseModules(catalog, course.id);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Modules" />
      {sections.length ? (
        sections.map(({ module, entries, submodules }) => (
          <Card key={module.id} className="p-5">
            <section aria-labelledby={`module-${module.id}`} className="flex flex-col gap-4">
              <h3 id={`module-${module.id}`} className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold">
                <FolderTree aria-hidden className="size-5 text-primary-700" />
                {module.title}
              </h3>
              {(entries.length > 0 || submodules.length === 0) && <ModuleEntries label={module.title} entries={entries} />}
              {submodules.length > 0 && (
                <ol aria-label={`Submodules of ${module.title}`} className="m-0 flex list-none flex-col gap-3 border-l-2 border-primary-200 p-0 pl-4">
                  {submodules.map((sub) => (
                    <li key={sub.module.id}>
                      <section aria-labelledby={`module-${sub.module.id}`} className="flex flex-col gap-3">
                        <h4 id={`module-${sub.module.id}`} className="m-0 font-sans text-body-lg font-semibold">{sub.module.title}</h4>
                        <ModuleEntries label={sub.module.title} entries={sub.entries} />
                      </section>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </Card>
        ))
      ) : (
        <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">This class has no modules yet.</p>
      )}
    </div>
  );
}

function Materials({ course, catalog }: { course: Course; catalog: StudentCatalog }) {
  const [query, setQuery] = useState("");
  const shown = catalog.materials.filter((item) => item.courseId === course.id && `${item.title} ${item.kind}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="Class materials" />
        <ListSearch label="Search materials" placeholder="Search materials" value={query} onChange={setQuery} />
      </div>
      <MaterialGrid materials={shown} />
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
          <span className="text-label font-semibold tracking-wide text-muted uppercase">Your teacher</span>
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
        <TabsContent value="Modules"><Modules course={course} catalog={catalog} /></TabsContent>
        <TabsContent value="Materials"><Materials course={course} catalog={catalog} /></TabsContent>
        <TabsContent value="People"><People course={course} catalog={catalog} /></TabsContent>
        <TabsContent value="Attendance"><Attendance course={course} catalog={catalog} /></TabsContent>
      </Tabs>
    </>
  );
}
