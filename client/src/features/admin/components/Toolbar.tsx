import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";

/** Search and filters together above a directory (the directory pattern in AGENTS.md). */
export function Toolbar({ searchLabel, query, onQuery, onClear, children }: { searchLabel: string; query: string; onQuery: (value: string) => void; onClear?: () => void; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 font-sans @2xl:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(10rem,1fr))] @2xl:items-end">
      <label className="relative flex flex-col gap-1.5">
        <span className="text-body font-medium text-ink">{searchLabel}</span>
        <Search aria-hidden className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="min-h-touch w-full rounded-control border border-line-strong bg-surface pr-3 pl-9 font-sans text-body-lg text-ink placeholder:text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus"
        />
      </label>
      {children}
      {onClear && (
        <Button variant="ghost" className="justify-self-start" onClick={onClear}>Clear filters</Button>
      )}
    </div>
  );
}
