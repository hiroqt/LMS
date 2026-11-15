import type { ReactNode } from "react";
import { cn } from "../../../shared/lib/cn";

export interface StatCardProps {
  icon: ReactNode;
  tone: string;
  value: number;
  label: string;
  note: string;
  /** When present the card is a button; its name starts with the value, e.g. "2 Due this week". */
  onOpen?: () => void;
}

export function StatCard({ icon, tone, value, label, note, onOpen }: StatCardProps) {
  const content = (
    <>
      <span aria-hidden className={cn("grid size-10 place-items-center rounded-control [&>svg]:size-5", tone)}>{icon}</span>
      <span className="flex flex-col">
        <strong className="text-page font-bold leading-tight">{value}</strong>
        <span className="text-body font-medium">{label}</span>
      </span>
      <span className="line-clamp-2 text-body text-muted">{note}</span>
    </>
  );
  const base = "flex h-full flex-col items-start gap-3 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(base, "transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none")}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
