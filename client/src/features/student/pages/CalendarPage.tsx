import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { formatMonth, formatTime, formatWeekday } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import { Badge } from "../../../shared/ui/Badge";
import { Card } from "../../../shared/ui/Card";
import { IconButton } from "../../../shared/ui/IconButton";
import { calendarEntries, inMonth, weekBounds, type CalendarEntry } from "../api/selectors";
import { MonthGrid } from "../../../shared/components/MonthGrid";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

function EntryStatus({ entry, completed, now }: { entry: CalendarEntry; completed: string[]; now: number }) {
  if (!entry.assessment) return <Badge>Scheduled</Badge>;
  if (completed.includes(entry.assessment.id)) return <Badge tone="success">Done</Badge>;
  if (entry.assessment.excused) return <Badge>Excused</Badge>;
  return entry.date.getTime() < now ? <Badge tone="danger">Past due</Badge> : <Badge tone="brand">Upcoming</Badge>;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { catalog, completed, now } = useWorkspace();
  const [month, setMonth] = useState(() => new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1));
  const thisWeek = params.get("view") === "week";
  const all = calendarEntries(catalog.assessments, catalog.academicEvents);
  const monthEntries = inMonth(all, month);
  const { start, end } = weekBounds(now);
  const agenda = thisWeek ? all.filter((item) => item.date >= start && item.date < end) : monthEntries;
  const courseName = (id: string) => catalog.courses.find((course) => course.id === id)?.name ?? "Class";

  const changeMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    if (thisWeek) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Academic calendar"
        description="Term dates, school events, and assessment deadlines in one view."
        actions={
          <div role="group" aria-label="Calendar month navigation" className="flex items-center gap-1 rounded-card border border-line bg-surface p-1">
            <IconButton label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft /></IconButton>
            <strong aria-live="polite" className="min-w-36 text-center font-sans text-body font-semibold">{formatMonth(month)}</strong>
            <IconButton label="Next month" onClick={() => changeMonth(1)}><ChevronRight /></IconButton>
          </div>
        }
      />
      <p className="m-0 text-body text-muted">Mock academic schedule for demonstration. Replace these sample term dates and events with the official school calendar.</p>
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-3 sm:p-4">
          <MonthGrid month={month} entries={monthEntries} now={now} label={`${formatMonth(month)} calendar`} size="full" />
        </Card>
        <section aria-labelledby="agenda-title" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="agenda-title" className="m-0 font-sans text-section font-semibold text-ink">{thisWeek ? "This week" : formatMonth(month)}</h2>
              <p className="m-0 text-body text-muted">{agenda.length} scheduled {agenda.length === 1 ? "item" : "items"}</p>
            </div>
            <CalendarDays aria-hidden className="size-5 text-muted" />
          </div>
          {agenda.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {agenda.map((entry) => {
                const body = (
                  <>
                    <time dateTime={entry.date.toISOString()} className="flex w-24 shrink-0 flex-col text-body">
                      <strong className="font-semibold">{formatWeekday(entry.date)}</strong>
                      <span className="text-muted">{entry.assessment ? formatTime(entry.date) : "All day"}</span>
                    </time>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <strong className="text-body font-semibold">{entry.title}</strong>
                      <span className="text-body text-muted">{entry.assessment ? `${courseName(entry.assessment.courseId)} · ${entry.assessment.type}` : `Academic calendar · ${entry.category}`}</span>
                    </span>
                    <EntryStatus entry={entry} completed={completed} now={now} />
                  </>
                );
                const row = "flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left font-sans text-ink";
                return (
                  <li key={entry.id}>
                    {entry.assessment ? (
                      <button type="button" onClick={() => navigate(studentPaths.assessment(entry.id))} className={cn(row, "hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus")}>{body}</button>
                    ) : (
                      <div className={row}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No dates are scheduled {thisWeek ? "this week" : "this month"}.</p>
          )}
        </section>
      </div>
    </>
  );
}
