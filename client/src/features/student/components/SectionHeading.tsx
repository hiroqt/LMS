import type { ReactNode } from "react";

/** Eyebrow + h2 + optional count and action, used for page sections. */
export function SectionHeading({ id, eyebrow, title, count, action }: { id?: string; eyebrow?: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        {eyebrow && <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">{eyebrow}</p>}
        <h2 id={id} className="m-0 flex items-center gap-2 font-sans text-section font-semibold text-ink">
          {title}
          {count !== undefined && <span className="rounded-full bg-primary-100 px-2 text-body font-semibold text-primary-700">{count}</span>}
        </h2>
      </div>
      {action}
    </div>
  );
}
