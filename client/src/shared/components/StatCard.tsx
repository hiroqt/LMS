import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface StatCardProps {
  icon: ReactNode;
  tone: string;
  value: number;
  label: string;
  /** Shown instead of the label on phones, where a chip is about 90px wide. The full label stays the accessible name. */
  shortLabel?: string;
  /** When present the chip is a button; its name starts with the value, e.g. "2 Due this week". */
  onOpen?: () => void;
}

/** A compact summary chip: icon tile, a number, and what it counts. */
export function StatCard({ icon, tone, value, label, shortLabel, onOpen }: StatCardProps) {
  // The chip lays itself out by its own width: icon above the number when narrow,
  // beside it from 12rem; under 9rem the short label replaces the full one on screen.
  const content = (
    <span className="flex h-full flex-col items-start justify-center gap-1.5 p-3 @[12rem]:flex-row @[12rem]:items-center @[12rem]:justify-start @[12rem]:gap-4 @[12rem]:p-4">
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-control @[12rem]:size-12 [&>svg]:size-5 @[12rem]:[&>svg]:size-6", tone)}>{icon}</span>
      <span className="flex w-full min-w-0 flex-col">
        <strong className="text-page-mobile leading-tight font-bold tabular-nums">{value}</strong>
        {shortLabel && <span aria-hidden className="text-body text-muted @[9rem]:hidden">{shortLabel}</span>}
        <span className={cn("text-body break-words text-muted", shortLabel && "@max-[9rem]:sr-only")}>{label}</span>
      </span>
    </span>
  );
  const base = "@container block h-full w-full rounded-card border border-line bg-surface p-0 text-left font-sans text-ink shadow-card";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(base, "transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none")}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
