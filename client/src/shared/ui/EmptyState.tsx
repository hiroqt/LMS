import type { ReactNode } from "react";
import type { Illustration } from "../assets/illustrations";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  /**
   * Shown instead of the icon. Only where nothing exists yet, never for a search or
   * filter miss (D-057). Decorative: the title carries the meaning.
   */
  illustration?: Illustration;
  title: string;
  /** What the person can do next. */
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, illustration, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface px-6 py-10 text-center", className)}>
      {illustration && <img src={illustration.src} alt="" width={illustration.width} height={illustration.height} className="h-16 w-auto sm:h-22" />}
      {icon && !illustration && <span aria-hidden className="grid size-12 place-items-center rounded-full bg-primary-100 text-primary-700 [&>svg]:size-6">{icon}</span>}
      <p className="m-0 font-sans text-card-title font-semibold text-ink">{title}</p>
      {description && <p className="m-0 max-w-prose text-body text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
