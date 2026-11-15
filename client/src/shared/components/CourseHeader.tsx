import type { ReactNode } from "react";
import { bandFor } from "../lib/tones";
import { CourseCode } from "./CourseCode";

export interface CourseFact {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}

export interface CourseHeaderProps {
  code: string;
  section: string;
  term: string;
  title: string;
  /** The subject area, e.g. "Programming fundamentals". */
  subject?: string;
  facts: CourseFact[];
  index: number;
  breadcrumbLabel: string;
  onBreadcrumb: () => void;
  actions?: ReactNode;
}

/**
 * The top of a course page, set like a syllabus header: code, section, and
 * term on one line, the course title as the page's h1, then the facts a
 * student or instructor looks up most (who, where, how many, when next).
 */
export function CourseHeader({ code, section, term, title, subject, facts, index, breadcrumbLabel, onBreadcrumb, actions }: CourseHeaderProps) {
  return (
    <header className="overflow-hidden rounded-card border border-line bg-surface font-sans text-ink shadow-card">
      <div aria-hidden className={`h-2 w-full ${bandFor(index)}`} />
      <div className="flex flex-col gap-4 p-5 sm:p-7">
        <nav aria-label="Breadcrumb">
          <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-body text-muted">
            <li>
              <button type="button" onClick={onBreadcrumb} className="min-h-touch rounded-control border-0 bg-transparent px-1 font-sans font-medium text-primary-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-focus">
                {breadcrumbLabel}
              </button>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page">{code} · {section}</li>
          </ol>
        </nav>
        <div className="flex flex-col gap-2">
          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted">
            <CourseCode code={code} />
            <span>{section}</span>
            <span aria-hidden>·</span>
            <span>{term}</span>
          </p>
          <h1 tabIndex={-1} className="m-0 text-page-mobile font-bold tracking-tight outline-none sm:text-page">{title}</h1>
          {subject && <p className="m-0 text-body-lg text-muted">{subject}</p>}
        </div>
        <dl className="m-0 grid grid-cols-1 gap-3 border-t border-line pt-4 min-[400px]:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="flex items-center gap-2 text-label font-semibold tracking-label text-muted uppercase">
                <span aria-hidden className="inline-flex text-primary-700 [&>svg]:size-4">{fact.icon}</span>
                {fact.label}
              </dt>
              <dd className="m-0 pl-6 text-body font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
