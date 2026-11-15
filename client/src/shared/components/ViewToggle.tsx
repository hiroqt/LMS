import { LayoutGrid, Rows3 } from "lucide-react";
import type { ClassView } from "../hooks/useClassView";
import { cn } from "../lib/cn";

const options = [
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "table", label: "Table", icon: Rows3 },
] as const;

/** Switches a class list between cards and a table. */
export function ViewToggle({ view, onChange }: { view: ClassView; onChange: (view: ClassView) => void }) {
  return (
    <div role="group" aria-label="Class list view" className="inline-flex shrink-0 rounded-control border border-line bg-surface p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex min-h-10 min-w-touch items-center justify-center gap-1.5 rounded-chip border-0 px-2.5 font-sans text-body font-medium focus-visible:outline-3 focus-visible:outline-focus",
            view === value ? "bg-primary-700 text-white" : "bg-transparent text-ink hover:bg-primary-50",
          )}
        >
          <Icon aria-hidden className="size-4" />
          {/* Phones show the icons only; the name stays for assistive technology. */}
          <span className="max-sm:sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
