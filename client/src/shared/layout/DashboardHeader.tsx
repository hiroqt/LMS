import type { ReactNode } from "react";

export interface DashboardHeaderProps {
  /** The page's single h1, a greeting on every role's dashboard (D-066). */
  title: string;
  /** One line above the title: the date and term week, or the scope. */
  meta?: ReactNode;
  /** Page-level controls on the right: the demo person picker, a view switch, scope filters. */
  controls?: ReactNode;
}

/**
 * The dashboard heading, the same on every role (D-066): no card and no fill, so the
 * one filled tile below it (`FocusTile`) stays the page's single emphasis. The shell
 * moves focus to the h1 on navigation (C-010).
 */
export function DashboardHeader({ title, meta, controls }: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 @3xl:flex-row @3xl:items-end @3xl:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {meta && <p className="m-0 font-sans text-body text-muted">{meta}</p>}
        <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-semibold tracking-tight text-ink outline-none sm:text-page">{title}</h1>
      </div>
      {controls && <div className="flex flex-col gap-3 @xl:flex-row @xl:flex-wrap @xl:items-end @3xl:justify-end">{controls}</div>}
    </header>
  );
}
