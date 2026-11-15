import type { ReactNode } from "react";

export interface ClassTableRow {
  id: string;
  name: string;
  /** One value per column after "Class". */
  cells: ReactNode[];
  onOpen: () => void;
}

/**
 * A class list as a table: one row per class, the class name is the row header
 * and opens the class. Scrolls sideways inside its frame on narrow screens.
 */
export function ClassTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: ClassTableRow[] }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-surface shadow-card focus-visible:outline-3 focus-visible:outline-focus">
      <table className="w-full min-w-[34rem] border-collapse font-sans text-body text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas">
            {["Class", ...columns].map((column) => (
              <th key={column} scope="col" className="px-4 py-3 text-left text-body font-semibold whitespace-nowrap text-muted">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-primary-50">
              <th scope="row" className="min-w-44 p-0 text-left font-semibold">
                <button
                  type="button"
                  onClick={row.onOpen}
                  className="flex min-h-touch w-full items-center border-0 bg-transparent px-4 py-2 text-left font-sans text-body font-semibold text-primary-800 underline underline-offset-4 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                >
                  {row.name}
                </button>
              </th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]} className="px-4 py-2 whitespace-nowrap tabular-nums">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
