export interface Week {
  label: string;
  count: number;
}

/**
 * Eight weeks as plain bars with the number on each, so the values are readable
 * without hovering. When no record in the range has a date, a labelled sample
 * keeps the demo legible (it never mixes with real counts).
 */
export function WeeklyBars({ label, weeks, sample, unit }: { label: string; weeks: Week[]; sample: number[]; unit: string }) {
  const real = weeks.some((week) => week.count > 0);
  const values = real ? weeks.map((week) => week.count) : sample;
  const max = Math.max(1, ...values);
  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <ol aria-label={`${label} by week${real ? "" : ", sample preview"}`} className="m-0 grid h-44 list-none grid-cols-8 items-end gap-1.5 p-0 sm:gap-2">
        {weeks.map((week, index) => {
          const value = values[index] ?? 0;
          return (
            // Number, bar area, and day share fixed rows, so every label sits on one line.
            <li key={week.label} className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] justify-items-center gap-1 font-sans">
              <span className="text-body font-semibold tabular-nums text-ink">
                {value}
                <span className="sr-only"> {unit}, week of {week.label}</span>
              </span>
              <span aria-hidden className="flex w-full items-end">
                <span className={real ? "w-full rounded-t-chip bg-primary-500" : "w-full rounded-t-chip bg-primary-200"} style={{ height: `${Math.max(4, (value / max) * 100)}%` }} />
              </span>
              <span aria-hidden className="w-full truncate text-center text-body text-muted">{week.label.replace(/^\w+ /, "")}</span>
            </li>
          );
        })}
      </ol>
      <figcaption className="text-body text-muted">{real ? `Weeks starting ${weeks[0]?.label} to ${weeks.at(-1)?.label}` : "Sample preview: no dated records in this range."}</figcaption>
    </figure>
  );
}
