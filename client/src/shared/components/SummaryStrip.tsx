import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SummaryItem {
  icon: ReactNode;
  /** Tile colors, a pair from `lib/tones` (classTones) that passes AA. */
  tone: string;
  value: number;
  label: string;
  /** Shown instead of the label when the cell is about 9rem wide (phones). The full label stays the accessible name. */
  shortLabel?: string;
  /** One fact the reader can use (a count, a date). Hidden when the cell is narrow. */
  note?: ReactNode;
  /** When present the cell is a button. Its name starts with the value ("5 Due this week") unless `name` is given. */
  onOpen?: () => void;
  /** Overrides the button's accessible name, e.g. "Total students: 12. View students". */
  name?: string;
}

/**
 * The dashboard's numbers in one bordered strip (D-066), replacing separate stat
 * cards. Cells are split by 1px rules (the strip's `bg-line` showing through a
 * `gap-px`), never colored edges (C-019). Three items sit in a row; four make a 2×2.
 */
export function SummaryStrip({ label, items, className }: { label: string; items: SummaryItem[]; className?: string }) {
  return (
    <ul aria-label={label} className={cn("m-0 grid list-none gap-px overflow-hidden rounded-card border border-line bg-line p-0", items.length === 3 ? "grid-cols-3" : "grid-cols-2", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex bg-surface">
          <SummaryCell item={item} />
        </li>
      ))}
    </ul>
  );
}

function SummaryCell({ item }: { item: SummaryItem }) {
  // The cell lays itself out by its own width (C-017): narrow cells stack the icon
  // over the number, wide ones (18rem+) put them side by side so a 2×2 stays short;
  // under 10rem the note hides and the short label replaces the full one on screen.
  const content = (
    <span className="relative flex h-full flex-col justify-between gap-3 p-3 @[10rem]:p-4 @[14rem]:p-5 @[18rem]:flex-row @[18rem]:items-center @[18rem]:justify-start @[18rem]:gap-4">
      <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-control [&>svg]:size-4.5 @[18rem]:size-11 @[18rem]:[&>svg]:size-5", item.tone)}>{item.icon}</span>
      <span className="flex min-w-0 flex-col">
        {/* The {" "} text nodes keep the accessible name "5 Due this week" spaced in every engine; flex hides them on screen. */}
        <strong className="text-page-mobile font-semibold tabular-nums @[10rem]:text-page">{item.value}</strong>{" "}
        {item.shortLabel && <span aria-hidden className="text-body font-medium @[9rem]:hidden">{item.shortLabel}</span>}
        <span className={cn("text-body font-medium break-words", item.shortLabel && "@max-[9rem]:sr-only")}>{item.label}</span>{" "}
        {item.note && <span className="text-body text-muted @max-[10rem]:sr-only">{item.note}</span>}
      </span>
      {item.onOpen && <ArrowRight aria-hidden className="absolute top-3 right-3 size-4 text-muted @[10rem]:top-4 @[10rem]:right-4 @[14rem]:top-5 @[14rem]:right-5" />}
    </span>
  );
  const base = "@container block w-full flex-1 p-0 text-left font-sans text-ink";
  return item.onOpen ? (
    <button
      type="button"
      aria-label={item.name}
      onClick={item.onOpen}
      className={cn(base, "border-0 bg-surface transition-colors duration-150 hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus motion-reduce:transition-none")}
    >
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
