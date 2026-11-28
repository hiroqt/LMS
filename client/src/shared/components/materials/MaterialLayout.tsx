import type { ReactNode } from "react";
import { PageHeader } from "../../layout/PageHeader";

export interface MaterialLayoutProps {
  /** The page's h1. */
  title: string;
  /** Where it sits: "Introduction to Programming › Unit 1 › Loops". */
  path: string;
  /** "Study guide · Added 20 Nov by Prof. Angela Reyes" */
  facts: string;
  /** Beside the facts, e.g. an "Archived" badge. */
  status?: ReactNode;
  /** The file's preview, or a notice when there is none. */
  preview: ReactNode;
  /** The file and its Download button, then any role's own actions. */
  file: ReactNode;
  description?: string | null;
  /** Links to the materials before and after this one. */
  nav?: ReactNode;
  /** Under the preview, e.g. the class comments. */
  discussion?: ReactNode;
  /** At the end of the side column, e.g. the student's private comments. */
  aside?: ReactNode;
}

/**
 * One class material, the same for students and instructors (D-067): the preview takes the width,
 * and the file, its actions, and the description sit beside it on wide screens and below it on
 * phones. Prose keeps its reading width (D-025).
 */
export function MaterialLayout({ title, path, facts, status, preview, file, description, nav, discussion, aside }: MaterialLayoutProps) {
  return (
    <>
      <p className="m-0 -mb-2 text-body break-words text-muted">{path}</p>
      <PageHeader title={title} description={facts} actions={status} />
      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] @4xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Preview" className="min-w-0">{preview}</section>
          {discussion}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="material-file" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
            <h2 id="material-file" className="m-0 font-sans text-card-title font-semibold">File</h2>
            {file}
          </section>
          {description && (
            <section aria-labelledby="material-about" className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
              <h2 id="material-about" className="m-0 font-sans text-card-title font-semibold">About</h2>
              <p className="m-0 max-w-prose text-body whitespace-pre-line text-ink">{description}</p>
            </section>
          )}
          {aside}
        </div>
      </div>
      {nav}
    </>
  );
}
