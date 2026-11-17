import { monthGrid, type CalendarMark } from "../lib/calendar";
import { cn } from "../lib/cn";
import { pad2 } from "../lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface MonthGridProps {
  month: Date;
  entries: CalendarMark[];
  now: number;
  label: string;
  /** Compact (dashboard) or full (calendar page) cells. */
  size?: "compact" | "full";
}

/**
 * Month table. Each day has a visually hidden label with its date and what
 * is on it ("October 2026 24, Quiz 02: Relational Data and Keys"), so
 * screen-reader users get the same information as the dots.
 */
export function MonthGrid({ month, entries, now, label, size = "compact" }: MonthGridProps) {
  const cells = monthGrid(month, size === "full" ? 42 : 0);
  const today = new Date(now);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(month);
  return (
    <table aria-label={label} className="w-full table-fixed border-collapse font-sans text-ink">
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th key={day} scope="col" className="pb-2 text-center text-body font-medium text-muted">
              <abbr title={day} className="no-underline">{size === "compact" ? day.slice(0, 1) : day}</abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <tr key={week}>
            {cells.slice(week * 7, week * 7 + 7).map((day, weekday) => {
              const dayEntries = day === null ? [] : entries.filter((item) => item.date.getDate() === day);
              const isToday = day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
              return (
                <td key={weekday} className={cn("p-0.5 align-top", size === "full" && "h-16 sm:h-20")}>
                  {day !== null && (
                    <span
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-control text-body",
                        size === "full" ? "h-full items-start p-1.5" : "py-1",
                        isToday ? "bg-primary-600 font-semibold text-white" : dayEntries.length ? "bg-primary-50" : "",
                      )}
                    >
                      <span className="sr-only">{`${monthName} ${day}${dayEntries.length ? `, ${dayEntries.map((item) => item.title).join(", ")}` : ""}`}</span>
                      <time aria-hidden dateTime={`${month.getFullYear()}-${pad2(month.getMonth() + 1)}-${pad2(day)}`}>{day}</time>
                      {size === "full" && dayEntries.length > 0 && (
                        <span aria-hidden className="hidden text-body text-muted sm:block">{dayEntries.length} {dayEntries.length === 1 ? "item" : "items"}</span>
                      )}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
