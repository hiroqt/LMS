import type { ReactNode } from "react";
import { cn } from "../../../shared/lib/cn";

/**
 * A meeting control that is on or off (mic, camera): one name, its state in `aria-pressed`
 * (C-014), the icon and a word for the state, and `aria-disabled` rather than `disabled`
 * when the person may not use it, so it stays focusable and can say why.
 */
export function MediaToggle({ label, on, onIcon, offIcon, allowed = true, onPress, compact = false }: {
  label: string;
  on: boolean;
  onIcon: ReactNode;
  offIcon: ReactNode;
  allowed?: boolean;
  onPress: () => void;
  /** Phones: the word goes under the icon at body size; the name stays the same. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={allowed ? undefined : true}
      onClick={onPress}
      className={cn(
        "inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 rounded-control border px-3 font-sans text-body font-semibold transition-colors duration-150 motion-reduce:transition-none",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        compact && "flex-col gap-0.5 px-2 py-1",
        on ? "border-line-strong bg-surface text-ink hover:bg-primary-50" : "border-transparent bg-danger-soft text-danger hover:bg-danger-soft",
        !allowed && "cursor-not-allowed opacity-60",
      )}
    >
      <span aria-hidden className="[&>svg]:size-5">{on ? onIcon : offIcon}</span>
      <span>{label}</span>
    </button>
  );
}
