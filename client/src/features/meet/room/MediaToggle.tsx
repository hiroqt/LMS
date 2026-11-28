import type { ReactNode } from "react";
import { cn } from "../../../shared/lib/cn";

/**
 * A meeting control that is on or off (mic, camera, hand, chat): one name, its state in
 * `aria-pressed` (C-014), the icon and the name, and `aria-disabled` rather than `disabled` when
 * the person may not use it, so it stays focusable and can say why. Mic and camera off are a
 * warning ("device"); a panel or hand that is off is just off ("plain"). On narrow screens the
 * name is read, not shown (`labelHidden`), and is the tooltip.
 */
export function MediaToggle({ label, on, onIcon, offIcon = onIcon, allowed = true, onPress, tone = "device", labelHidden = false, badge, badgeSuffix }: {
  label: string;
  on: boolean;
  onIcon: ReactNode;
  offIcon?: ReactNode;
  allowed?: boolean;
  onPress: () => void;
  tone?: "device" | "plain";
  labelHidden?: boolean;
  /** A count beside the name, e.g. unread messages; read as part of the name, then `badgeSuffix` ("unread"). */
  badge?: string;
  badgeSuffix?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={allowed ? undefined : true}
      title={labelHidden ? label : undefined}
      onClick={onPress}
      className={cn(
        "relative inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 rounded-control border px-3 font-sans text-body font-semibold transition-colors duration-150 motion-reduce:transition-none",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        tone === "device"
          ? on ? "border-line-strong bg-surface text-ink hover:bg-primary-50" : "border-transparent bg-danger-soft text-danger"
          : on ? "border-primary-700 bg-primary-100 text-primary-800 hover:bg-primary-200" : "border-line-strong bg-surface text-ink hover:bg-primary-50",
        !allowed && "cursor-not-allowed opacity-60",
      )}
    >
      <span aria-hidden className="[&>svg]:size-5">{on ? onIcon : offIcon}</span>
      <span className={labelHidden ? "sr-only" : undefined}>{label}</span>
      {badge && <span className="rounded-full bg-primary-700 px-1.5 text-body leading-5 text-white">{badge}</span>}
      {badge && badgeSuffix && <span className="sr-only"> {badgeSuffix}</span>}
    </button>
  );
}
