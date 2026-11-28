import { AlarmClock, CalendarDays, Check, ListChecks } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { FilterChip, FilterChipGroup } from "../../../shared/ui/FilterChip";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { courseCode } from "../api/catalog";
import { isTaskStatus, taskGroups, type TaskStatus } from "../api/selectors";
import { AssessmentRow } from "../components/AssessmentRow";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

/** Groups items (already sorted by due date) under their due day. */
function byDay<T extends { dueAt: string }>(items: T[]): Array<[string, T[]]> {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const key = item.dueAt ? new Date(item.dueAt).toDateString() : "";
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return [...days];
}

const dayLabel = (key: string) => (key ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(key)) : "No due date");

const icons: Record<TaskStatus, typeof CalendarDays> = { "Due soon": CalendarDays, "Due this week": CalendarDays, Missing: AlarmClock, Done: Check };

export default function TasksPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("status");
  const status: TaskStatus = isTaskStatus(requested) ? requested : "Due soon";
  const { catalog, completed, now } = useWorkspace();
  const groups = taskGroups(catalog.assessments, completed, now);
  const group = groups.find((item) => item.status === status) ?? groups[0]!;
  const courseIndex = (id: string) => catalog.courses.findIndex((course) => course.id === id);

  return (
    <>
      <PageHeader title="Tasks" description="See due dates, missing work, and the work you have done." />

      {/* Visible filter instead of the classic dropdown: one tap, counts always shown. */}
      <FilterChipGroup label="Filter by status">
        {groups.map((item) => {
          const Icon = icons[item.status];
          const selected = item.status === status;
          return (
            <FilterChip key={item.status} selected={selected} count={item.items.length} onClick={() => navigate(studentPaths.tasks(item.status), { replace: true })}>
              <Icon aria-hidden className="size-4" />
              {item.status}
            </FilterChip>
          );
        })}
      </FilterChipGroup>

      <section aria-labelledby="task-group" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="task-group" className="m-0 font-sans text-section font-semibold text-ink">{group.status}</h2>
          <p className="m-0 text-body text-muted">{group.description}</p>
        </div>
        {group.items.length ? (
          <ol className="m-0 flex list-none flex-col gap-5 p-0">
            {byDay(group.items).map(([day, items]) => (
              <li key={day} className="flex flex-col gap-2">
                <h3 className="m-0 font-sans text-body font-semibold text-ink">{dayLabel(day)}</h3>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {items.map((item) => {
                    const index = courseIndex(item.courseId);
                    const course = catalog.courses[index];
                    return (
                      <li key={item.id}>
                        <AssessmentRow
                          item={item}
                          courseIndex={index}
                          courseCode={course ? courseCode(course) : undefined}
                          completed={completed.includes(item.id)}
                          missing={group.status === "Missing"}
                          onOpen={() => navigate(studentPaths.assessment(item.id))}
                        />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={<ListChecks />} title={`No ${group.status.toLowerCase()} work`} description="Try another status above, or check your classes for new work." />
        )}
      </section>
    </>
  );
}
