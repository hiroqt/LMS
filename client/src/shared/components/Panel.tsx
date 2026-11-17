import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { SectionHeading } from "./SectionHeading";

/**
 * A dashboard tile: a titled surface that stretches to its grid cell, so tiles
 * in a row end on the same line. Give the main child `flex-1` to use the height.
 */
export function Panel({ id, icon, title, count, action, className, children }: { id: string; icon?: ReactNode; title: string; count?: number; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4 font-sans text-ink sm:p-5", className)}>
      <SectionHeading id={id} icon={icon} title={title} count={count} action={action} />
      {children}
    </section>
  );
}
