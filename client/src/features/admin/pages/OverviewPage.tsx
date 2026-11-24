import { Activity, BookOpen, CalendarDays, GraduationCap, ListChecks, Plus, School, UserPlus, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { FocusTile } from "../../../shared/components/FocusTile";
import { Panel } from "../../../shared/components/Panel";
import { PanelLink } from "../../../shared/components/PanelLink";
import { SummaryStrip } from "../../../shared/components/SummaryStrip";
import { DashboardHeader } from "../../../shared/layout/DashboardHeader";
import { cn } from "../../../shared/lib/cn";
import { formatFullDate } from "../../../shared/lib/format";
import { greeting } from "../../../shared/lib/greeting";
import { classTones, onFillFocus } from "../../../shared/lib/tones";
import { Field, Select } from "../../../shared/ui/Field";
import { EventList, type DashboardEvent } from "../components/EventList";
import { WeeklyBars, type Week } from "../components/WeeklyBars";
import { buildAdminDashboard } from "../data/adminDashboardData.js";
import { useAdmin } from "../hooks/useAdmin";
import { ADMIN_ACTOR } from "../hooks/useAdminData";
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

/** A quick action on the green tile: icon over label, the first one filled white (D-066). */
function ActionTile({ icon, primary = false, onClick, children }: { icon: ReactNode; primary?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-touch flex-col items-start justify-between gap-2 rounded-control border p-3 text-left font-sans text-body font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 motion-reduce:transition-none sm:p-4 [&>svg]:size-5",
        primary ? "border-surface bg-surface text-primary-800 hover:bg-primary-50 [&>svg]:text-primary-700" : "border-primary-500 bg-transparent text-white hover:bg-primary-800 [&>svg]:text-primary-200",
        onFillFocus,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** The Admin dashboard (D-038, D-066): heading with the scope filters, quick actions and totals, then activity. */
export default function OverviewPage() {
  const { data } = useAdmin();
  const navigate = useNavigate();
  const [now] = useState(Date.now);
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
      <DashboardHeader
        meta={`${formatFullDate(now)} · ${scope === "all" ? "All academic terms" : scope}`}
        title={`${greeting(now)}, ${ADMIN_ACTOR.actorName.split(" ")[0] ?? ADMIN_ACTOR.actorName}`}
        controls={
          <div role="group" aria-label="Activity scope filters" className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @3xl:w-[28rem]">
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
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12">
        <FocusTile id="quick-actions" icon={<Plus />} title="Quick actions" className="@4xl:col-span-5">
          <div role="group" aria-label="Administrative actions" className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
            <ActionTile primary icon={<UserPlus aria-hidden />} onClick={() => navigate(adminPaths.users(undefined, true))}>Add person</ActionTile>
            <ActionTile icon={<BookOpen aria-hidden />} onClick={() => navigate(adminPaths.courses("subjects", true))}>Create subject</ActionTile>
            <ActionTile icon={<School aria-hidden />} onClick={() => navigate(adminPaths.courses("classrooms", true))}>Create classroom</ActionTile>
            <ActionTile icon={<ListChecks aria-hidden />} onClick={() => navigate(adminPaths.enrollments(true))}>Enroll student</ActionTile>
          </div>
        </FocusTile>
        <SummaryStrip
          className="@4xl:col-span-7"
          label="Totals"
          items={[
            { icon: <UsersRound />, tone: classTones[0], value: students.length, label: "Total students", note: `${activeStudents} active · ${students.length - activeStudents} inactive`, name: `Total students: ${students.length}. View students`, onOpen: () => navigate(adminPaths.users("student")) },
            { icon: <GraduationCap />, tone: classTones[1], value: faculty.length, label: "Total faculty", note: `${activeFaculty} active · ${faculty.length - activeFaculty} inactive`, name: `Total faculty: ${faculty.length}. View faculty`, onOpen: () => navigate(adminPaths.users("instructor")) },
            { icon: <School />, tone: classTones[2], value: model.metrics.activeCourses, label: "Active courses", note: `Class sections across ${model.metrics.totalSubjects} subjects`, name: `Active courses: ${model.metrics.activeCourses}. View classrooms`, onOpen: () => navigate(adminPaths.courses("classrooms")) },
            { icon: <UserRound />, tone: classTones[3], value: model.metrics.activeUsers, label: "Active users", note: `of ${data.users.length} user accounts`, name: `Active users: ${model.metrics.activeUsers}. Manage users`, onOpen: () => navigate(adminPaths.users()) },
          ]}
        />

        {/* Course activity 8 | classroom status 4; then system, student activity, and students in equal thirds. */}
        <Panel id="course-activity" icon={<BookOpen />} title="Course activity" count={model.events.course.length} className="@4xl:col-span-8" action={<PanelLink onClick={() => navigate(adminPaths.courses("classrooms"))}>View classrooms</PanelLink>}>
          <WeeklyBars label="Course activity" weeks={model.weeklyActivity.course} sample={[3, 5, 4, 7, 5, 8, 6, 9]} unit="events" />
        </Panel>
        <Panel id="classroom-status" icon={<School />} title="Classroom status" count={rooms.length} className="@4xl:col-span-4">
          <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0">
            {roomStatuses.map((status) => (
              <CountRow key={status} label={status.charAt(0).toUpperCase() + status.slice(1)} count={rooms.filter((room) => room.status === status).length} total={rooms.length} />
            ))}
          </ul>
          <p className="m-0 text-body text-muted">Classroom sections in the selected term, from the current records.</p>
        </Panel>
        <Panel id="system-activity" icon={<Activity />} title="System activity" count={model.events.system.length} className="@4xl:col-span-4">
          <WeeklyBars label="System activity" weeks={model.weeklyActivity.system} sample={[4, 3, 6, 5, 7, 4, 8, 6]} unit="changes" />
          <EventList label="Latest system changes" events={model.events.system.slice(0, 3)} />
        </Panel>
        <Panel id="student-activity" icon={<ListChecks />} title="Student activity" count={model.events.students.length} className="@4xl:col-span-4">
          <WeeklyBars label="Student activity" weeks={model.weeklyActivity.students} sample={[2, 4, 3, 6, 5, 7, 6, 10]} unit="student actions" />
          <EventList label="Latest student activity" events={model.events.students.slice(0, 3)} />
        </Panel>
        <Panel id="student-accounts" icon={<UsersRound />} title="Students" count={students.length} className="@4xl:col-span-4" action={<PanelLink onClick={() => navigate(adminPaths.users("student"))}>View students</PanelLink>}>
          <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0">
            <CountRow label="Active" count={activeStudents} total={students.length} />
            <CountRow label="Inactive" count={students.length - activeStudents} total={students.length} />
          </ul>
        </Panel>

        <Panel
          id="recent-heading"
          icon={<CalendarDays />}
          title="Recent workspace activity"
          className="@4xl:col-span-12"
          description={model.recentActivity.isSample ? "Sample preview: this scope has no dated records yet." : "Latest records in the selected scope. For the full history, open Audit logs."}
          action={<PanelLink onClick={() => navigate(adminPaths.audit)}>Audit logs</PanelLink>}
        >
          {model.recentActivity.records.length ? (
            <EventList label="Recent workspace activity" events={model.recentActivity.records} withYear />
          ) : (
            <p className="m-0 text-body text-muted">No dated activity in this scope. Choose another range.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
