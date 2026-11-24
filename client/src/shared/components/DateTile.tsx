const month = new Intl.DateTimeFormat("en-US", { month: "short" });
const full = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The one way a dashboard shows a date beside an item (D-066): the month over the
 * day. A screen reader hears the full date ("October 24, 2026") instead of "Oct 24".
 */
export function DateTile({ date }: { date: Date }) {
  return (
    <time
      dateTime={`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`}
      className="flex w-13 shrink-0 flex-col items-center rounded-control border border-line bg-canvas py-1 font-sans leading-tight text-ink"
    >
      <span className="sr-only">{full.format(date)}</span>
      <span aria-hidden className="text-body text-muted">{month.format(date)}</span>
      <span aria-hidden className="text-section font-semibold tabular-nums">{date.getDate()}</span>
    </time>
  );
}
