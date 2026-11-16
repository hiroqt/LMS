import type { ReactNode } from "react";

/** Eyebrow + h2 + optional count and action, used for page sections. */
export function SectionHeading({ id, eyebrow, title, count, description, icon, action }: { id?: string; eyebrow?: string; title: string; count?: number; description?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex flex-1 basis-40 flex-col gap-0.5">
        {eyebrow && <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">{eyebrow}</p>}
        <h2 id={id} className="m-0 flex items-center gap-2.5 font-sans text-section font-semibold text-ink">
          {icon && <span aria-hidden className="inline-flex text-primary-700 [&>svg]:size-6">{icon}</span>}
          {title}
          {count !== undefined && <span className="rounded-full bg-primary-100 px-2 text-body font-semibold text-primary-700">{count}</span>}
        </h2>
        {description && <p className="m-0 text-body text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
