import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/** A dashboard total that opens the matching directory. */
export function MetricCard({ label, value, note, action, icon, onOpen }: { label: string; value: number; note: string; action: string; icon: ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${value}. ${action}`}
      onClick={onOpen}
      className="flex h-full w-full flex-col gap-2 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none sm:p-5"
    >
      <span className="flex items-center justify-between gap-2 text-body font-medium text-muted">
        {label}
        <span aria-hidden className="grid size-9 place-items-center rounded-control bg-primary-100 text-primary-700 [&>svg]:size-5">{icon}</span>
      </span>
      <strong className="text-page leading-none font-semibold tabular-nums">{value}</strong>
      <span className="text-body text-muted">{note}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-body font-semibold text-primary-700">
        {action}
        <ArrowRight aria-hidden className="size-4" />
      </span>
    </button>
  );
}
