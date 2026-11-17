import { Activity, BookOpen, CalendarDays, GraduationCap, ListChecks, Plus, School, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Panel } from "../../../shared/components/Panel";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { Field, Select } from "../../../shared/ui/Field";
import { DataTable, EmptyRow } from "../components/DataTable";
import { EventList, type DashboardEvent } from "../components/EventList";
import { MetricCard } from "../components/MetricCard";
import { WeeklyBars, type Week } from "../components/WeeklyBars";
import { buildAdminDashboard } from "../data/adminDashboardData.js";
import { useAdmin } from "../hooks/useAdmin";
import { adminPaths } from "../paths";

interface DashboardModel {
  metrics: { totalStudents: number; totalFaculty: number; activeCourses: number; activeUsers: number; totalSubjects: number };
  events: { course: DashboardEvent[]; students: DashboardEvent[]; system: DashboardEvent[] };
  weeklyActivity: { course: Week[]; students: Week[]; system: Week[] };
  recentActivity: { records: DashboardEvent[]; isSample: boolean };
}

const ranges = [
  ["term", "Current term"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["all", "All time"],
] as const;

/** Student completions recorded by the classic Student UI, read for the completion counts. */
function legacyCompletions(): string[] {
  try {
    return JSON.parse(localStorage.getItem("gclass-student-workspace-v1") || "{}").completed || [];
  } catch {
    return [];
  }
}

/** A labelled count with a proportional bar; the number is the information, the bar only shows scale. */
function CountRow({ label, count, total }: { label: string; count: number; total: number }) {
  return (
    <li className="flex flex-col gap-1 font-sans text-body">
      <span className="flex justify-between gap-2"><span>{label}</span><strong className="font-semibold tabular-nums">{count}</strong></span>
      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-canvas">
        <span className="block h-full rounded-full bg-primary-500" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
      </span>
    </li>
  );
}

export default function OverviewPage() {
  const { data } = useAdmin();
  const navigate = useNavigate();
  const terms = [...new Set(data.classrooms.map((room) => room.term).filter(Boolean))];
  const [term, setTerm] = useState(() => data.classrooms.find((room) => room.status === "active")?.term ?? "all");
  const [range, setRange] = useState("term");
  const scope = term !== "all" && !terms.includes(term) ? (terms[0] ?? "all") : term;
  const model = useMemo(() => buildAdminDashboard(data, { term: scope, range, legacyCompleted: legacyCompletions() }) as DashboardModel, [data, scope, range]);

  const students = data.users.filter((user) => user.role === "student");
  const activeStudents = students.filter((user) => user.status === "active").length;
  const faculty = data.users.filter((user) => user.role === "instructor");
  const activeFaculty = faculty.filter((user) => user.status === "active").length;
  const rooms = data.classrooms.filter((room) => scope === "all" || room.term === scope);
  const roomStatuses = [...new Set(["active", "inactive", ...rooms.map((room) => room.status)])];

  return (
    <>
      <PageHeader
        title="Academic overview"
        description={`People, courses, and learning activity · ${scope === "all" ? "All academic terms" : scope}`}
      />
      <div role="group" aria-label="Administrative actions" className="flex flex-wrap gap-2">
        <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => navigate(adminPaths.users(undefined, true))}>Add person</Button>
        <Button variant="secondary" onClick={() => navigate(adminPaths.courses("subjects", true))}>Create subject</Button>
        <Button variant="secondary" onClick={() => navigate(adminPaths.courses("classrooms", true))}>Create classroom</Button>
        <Button variant="secondary" onClick={() => navigate(adminPaths.enrollments(true))}>Enroll student</Button>
      </div>

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:gap-4 @xl:grid-cols-2 @7xl:grid-cols-4">
        <li><MetricCard label="Total students" value={students.length} note={`${activeStudents} active · ${students.length - activeStudents} inactive`} action="View students" icon={<UsersRound />} onOpen={() => navigate(adminPaths.users("student"))} /></li>
        <li><MetricCard label="Total faculty" value={faculty.length} note={`${activeFaculty} active · ${faculty.length - activeFaculty} inactive`} action="View faculty" icon={<GraduationCap />} onOpen={() => navigate(adminPaths.users("instructor"))} /></li>
        <li><MetricCard label="Active courses" value={model.metrics.activeCourses} note={`Class sections across ${model.metrics.totalSubjects} subjects`} action="View classrooms" icon={<School />} onOpen={() => navigate(adminPaths.courses("classrooms"))} /></li>
        <li><MetricCard label="Active users" value={model.metrics.activeUsers} note={`of ${data.users.length} user accounts`} action="Manage users" icon={<UsersRound />} onOpen={() => navigate(adminPaths.users())} /></li>
      </ul>

      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 id="activity-heading" className="m-0 font-sans text-section font-semibold text-ink">Activity and analytics</h2>
            <p className="m-0 font-sans text-body text-muted">Counts use the dated records available in this demo.</p>
          </div>
          <div role="group" aria-label="Activity scope filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 @4xl:w-[28rem]">
            <Field label="Academic term">
              <Select value={scope} onChange={(event) => setTerm(event.target.value)}>
                <option value="all">All terms</option>
                {terms.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label="Date range">
              <Select value={range} onChange={(event) => setRange(event.target.value)}>
                {ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-3">
          <Panel id="course-activity" icon={<BookOpen />} title="Course activity" count={model.events.course.length} className="@4xl:col-span-2" action={<Button variant="ghost" onClick={() => navigate(adminPaths.courses("classrooms"))}>View classrooms</Button>}>
            <WeeklyBars label="Course activity" weeks={model.weeklyActivity.course} sample={[3, 5, 4, 7, 5, 8, 6, 9]} unit="events" />
          </Panel>
          <Panel id="classroom-status" icon={<School />} title="Classroom status" count={rooms.length}>
            <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0">
              {roomStatuses.map((status) => (
                <CountRow key={status} label={status.charAt(0).toUpperCase() + status.slice(1)} count={rooms.filter((room) => room.status === status).length} total={rooms.length} />
              ))}
            </ul>
            <p className="m-0 text-body text-muted">Classroom sections in the selected term, from the current records.</p>
          </Panel>
          <Panel id="system-activity" icon={<Activity />} title="System activity" count={model.events.system.length}>
            <WeeklyBars label="System activity" weeks={model.weeklyActivity.system} sample={[4, 3, 6, 5, 7, 4, 8, 6]} unit="changes" />
            <EventList label="Latest system changes" events={model.events.system.slice(0, 3)} />
          </Panel>
          <Panel id="student-activity" icon={<ListChecks />} title="Student activity" count={model.events.students.length}>
            <WeeklyBars label="Student activity" weeks={model.weeklyActivity.students} sample={[2, 4, 3, 6, 5, 7, 6, 10]} unit="student actions" />
            <EventList label="Latest student activity" events={model.events.students.slice(0, 3)} />
          </Panel>
          <Panel id="student-accounts" icon={<UsersRound />} title="Students" count={students.length} action={<Button variant="ghost" onClick={() => navigate(adminPaths.users("student"))}>View students</Button>}>
            <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0">
              <CountRow label="Active" count={activeStudents} total={students.length} />
              <CountRow label="Inactive" count={students.length - activeStudents} total={students.length} />
            </ul>
          </Panel>
        </div>
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="recent-heading" className="m-0 flex items-center gap-2.5 font-sans text-section font-semibold text-ink">
            <CalendarDays aria-hidden className="size-6 text-primary-700" />
            Recent workspace activity
          </h2>
          <p className="m-0 font-sans text-body text-muted">
            {model.recentActivity.isSample ? "Sample preview: this scope has no dated records yet." : "Latest records in the selected scope. For the full history, open Audit logs."}
          </p>
        </div>
        <DataTable label="Recent workspace activity" head={<tr><th scope="col">Activity</th><th scope="col">Details</th><th scope="col">Date</th></tr>}>
          {model.recentActivity.records.length ? (
            model.recentActivity.records.map((event, index) => (
              <tr key={`${event.type}-${event.date}-${index}`}>
                <td className="font-semibold">{event.title}</td>
                <td className="text-muted">{event.detail}</td>
                <td className="whitespace-nowrap"><time dateTime={event.date}>{new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></td>
              </tr>
            ))
          ) : (
            <EmptyRow columns={3}>No dated activity in this scope. Choose another range.</EmptyRow>
          )}
        </DataTable>
      </section>
    </>
  );
}
