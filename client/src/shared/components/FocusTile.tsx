import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * The one filled tile on a dashboard (D-027, D-066): the next thing to do. Student:
 * Next due. Instructor: Review queue. Admin: Quick actions.
 *
 * Text on the fill is white or `primary-100` (both pass AA on `primary-700`). The
 * page's focus ring is dark green and would vanish on the fill, so controls inside
 * use `onFillFocus` from `lib/tones` (L-099).
 */
export function FocusTile({ id, icon, title, className, children }: { id: string; icon?: ReactNode; title: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4 rounded-card bg-primary-700 p-5 font-sans text-white sm:p-6", className)}>
      <h2 id={id} className="m-0 flex items-center gap-2.5 text-section font-semibold">
        {icon && <span aria-hidden className="inline-flex text-primary-200 [&>svg]:size-5">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}
