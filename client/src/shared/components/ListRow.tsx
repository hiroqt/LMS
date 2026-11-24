import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * One row anatomy for every dashboard list (D-066): a lead (`IconTile`, `InitialsAvatar`,
 * or `DateTile`), a title with one line of metadata, and an optional trailing badge or
 * action word. With `onOpen` the whole row is one button (one control per item, C-015);
 * without it the row is read-only, like the calendar timeline.
 */
export function ListRow({ lead, title, meta, trail, below, onOpen, chevron = Boolean(onOpen), className }: {
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Trailing content beside the text: a `Badge`, a date, or an action word. */
  trail?: ReactNode;
  /** Shown under the metadata, e.g. a due badge that moves there on phones. */
  below?: ReactNode;
  onOpen?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {lead}
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="text-card-title font-semibold break-words">{title}</strong>
        {meta && <span className="text-body text-muted break-words">{meta}</span>}
        {below}
      </span>
      {trail}
      {chevron && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
    </>
  );
  const base = "flex min-h-touch w-full items-center gap-3 px-1 py-3 text-left font-sans text-ink sm:gap-4";
  return (
    <li className={cn("flex", className)}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(base, "rounded-control border-0 bg-transparent hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus")}
        >
          {body}
        </button>
      ) : (
        <div className={base}>{body}</div>
      )}
    </li>
  );
}

/** The list that holds `ListRow`s: rows split by a 1px rule. */
export function RowList({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return <ul aria-label={label} className={cn("m-0 flex list-none flex-col divide-y divide-line p-0", className)}>{children}</ul>;
}

/** A 40px tinted square holding an icon: the lead for tasks and activity rows. */
export function IconTile({ tone = "bg-primary-100 text-primary-700", children }: { tone?: string; children: ReactNode }) {
  return <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-control [&>svg]:size-5", tone)}>{children}</span>;
}

/** A person's initials in a circle: the lead for people rows. Decorative; the row title names the person. */
export function InitialsAvatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">
      {(firstName?.[0] ?? "") + (lastName?.[0] ?? "")}
    </span>
  );
}
