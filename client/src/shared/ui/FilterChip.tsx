import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

/** A row of filter chips: a labelled group that scrolls sideways on phones. */
export function FilterChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {children}
    </div>
  );
}

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected: boolean;
  /** Number of matching items, shown in a pill after the label. */
  count?: number;
}

/** One filter toggle. `aria-pressed` carries the state, so forced colors can outline it (C-014). */
export function FilterChip({ selected, count, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-touch shrink-0 items-center gap-2 rounded-full border px-4 font-sans text-body font-medium transition-colors focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none",
        selected ? "border-primary-600 bg-primary-600 text-white" : "border-line-strong bg-surface text-ink hover:bg-primary-50",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span className={cn("rounded-full px-2 font-semibold tabular-nums", selected ? "bg-primary-800" : "bg-canvas")}>{count}</span>
        </>
      )}
    </button>
  );
}
