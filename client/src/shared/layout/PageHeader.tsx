import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Short uppercase context label, e.g. "Your work". */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Primary page actions, placed first on phones and to the right on desktop. */
  actions?: ReactNode;
}

/** The page's single h1 (C-004). The shell moves focus here on navigation. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <p className="m-0 text-label font-semibold tracking-label text-primary-700 uppercase">{eyebrow}</p>}
        <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-bold tracking-tight text-ink outline-none sm:text-page">{title}</h1>
        {description && <p className="m-0 max-w-prose text-body-lg text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
