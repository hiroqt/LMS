import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Phones show the icon only; the label stays the accessible name and the tooltip. */
  iconOnlyOnPhone?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology, e.g. "Class list view". */
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Switches between views of the same page (D-066). Each option is a toggle
 * button with `aria-pressed`, so the chosen one is announced and survives
 * forced colors (C-014). The pressed fill changes at once, without a color
 * transition, so the new state is never measured half-faded (L-101). For filters
 * use `FilterChip`; for panels of content that keep their own focus order use `Tabs`.
 */
export function SegmentedControl<T extends string>({ label, value, options, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex shrink-0 rounded-control border border-line bg-surface p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={option.iconOnlyOnPhone ? option.label : undefined}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-10 min-w-touch items-center justify-center gap-1.5 rounded-chip border-0 px-3 font-sans text-body font-medium whitespace-nowrap focus-visible:outline-3 focus-visible:outline-focus [&>svg]:size-4",
            value === option.value ? "bg-primary-700 text-white" : "bg-transparent text-ink hover:bg-primary-50",
          )}
        >
          {option.icon}
          <span className={option.iconOnlyOnPhone ? "max-sm:sr-only" : undefined}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
