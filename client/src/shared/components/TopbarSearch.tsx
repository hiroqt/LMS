import { Search, X } from "lucide-react";
import { useId, useState } from "react";

export interface TopbarSearchResult {
  id: string;
  /** Shown before the title and read with it, e.g. "Class", "Quiz", "Material". */
  kind: string;
  title: string;
}

export interface TopbarSearchProps<T extends TopbarSearchResult> {
  /** Accessible name, e.g. "Search student workspace". */
  label: string;
  search: (query: string) => T[];
  onSelect: (result: T) => void;
  autoFocus?: boolean;
  /** Hint inside the empty field. */
  placeholder?: string;
}

/**
 * Workspace search in the top bar. Results appear as buttons under the field
 * as you type, with a live count for screen readers. Esc clears and closes.
 */
export function TopbarSearch<T extends TopbarSearchResult>({ label, search, onSelect, autoFocus, placeholder = "Search classes, work, materials" }: TopbarSearchProps<T>) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const results = search(query);
  const open = query.trim().length > 0;

  const choose = (result: T) => {
    setQuery("");
    onSelect(result);
  };

  return (
    <div className="relative w-full max-w-sm font-sans" onKeyDown={(event) => event.key === "Escape" && setQuery("")}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      {/* type="text" keeps the classic textbox role (D-013); inputMode still shows a search key on phones. */}
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        aria-label={label}
        autoFocus={autoFocus}
        aria-controls={open ? listId : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="min-h-touch w-full rounded-control border border-line-strong bg-canvas pr-10 pl-9 text-body-lg text-ink placeholder:text-muted focus-visible:bg-surface focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus [&::-webkit-search-cancel-button]:hidden"
      />
      {open && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-control border-0 bg-transparent text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
      {open && (
        <div id={listId} className="absolute inset-x-0 top-full z-40 mt-2 rounded-card border border-line bg-surface p-1.5 shadow-popover">
          <p role="status" className="m-0 px-2.5 py-1.5 text-body text-muted">
            {results.length ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "No matches. Try a class, quiz, or material name."}
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {results.map((result) => (
              <li key={`${result.kind}-${result.id}`}>
                <button
                  type="button"
                  onClick={() => choose(result)}
                  className="flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent px-2.5 text-left text-body text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                >
                  <span className="w-20 shrink-0 text-muted">{result.kind}</span>{" "}
                  <strong className="truncate font-medium">{result.title}</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
