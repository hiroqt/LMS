import type { ReactNode } from "react";

/**
 * A records table in a bordered card that scrolls sideways on phones. The scroll
 * frame is a focusable, named region so keyboard users can scroll it (C-013).
 * It is `relative` so absolutely positioned content (the sr-only header labels)
 * stays inside it; otherwise WebKit widens the page by their offset (L-058).
 */
export function DataTable({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-card border border-line bg-surface focus-visible:outline-3 focus-visible:outline-focus">
      <table className="w-full min-w-[40rem] border-collapse font-sans text-body text-ink [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:whitespace-nowrap">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-canvas text-muted">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** A full-width row for an empty result. */
export function EmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columns} className="py-8 text-center text-muted">{children}</td>
    </tr>
  );
}
