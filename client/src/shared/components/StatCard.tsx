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
  const content = (
    <>
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-control sm:size-12 [&>svg]:size-5 sm:[&>svg]:size-6", tone)}>{icon}</span>
      <span className="flex w-full min-w-0 flex-col">
        <strong className="text-page-mobile leading-tight font-bold tabular-nums">{value}</strong>
        {shortLabel && <span aria-hidden className="text-body text-muted sm:hidden">{shortLabel}</span>}
        <span className={cn("text-body break-words text-muted", shortLabel && "max-sm:sr-only")}>{label}</span>
      </span>
    </>
  );
  // Phones: three compact chips in a row (icon above the number). From sm up:
  // icon beside the number, as on the desktop dashboard.
  const base = "flex h-full w-full flex-col items-start gap-1.5 rounded-card border border-line bg-surface p-3 text-left font-sans text-ink shadow-card sm:flex-row sm:items-center sm:gap-4 sm:p-4";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(base, "transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none")}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
