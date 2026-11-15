import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import { cn } from "../lib/cn";

/**
 * A sidebar list that folds away, e.g. "My classes". When the sidebar itself
 * is collapsed to icons there is no room for the heading, so the list stays
 * visible under a divider.
 */
export function SidebarGroup({ label, icon, count, collapsed, storageKey, children }: { label: string; icon: ReactNode; count?: number; collapsed: boolean; storageKey: string; children: ReactNode }) {
  const [open, setOpen] = usePersistentState<boolean>(storageKey, true);
  if (collapsed) return <div className="border-t border-line pt-3">{children}</div>;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent px-3 text-left font-sans text-body font-medium text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
      >
        <span aria-hidden className="inline-flex text-muted [&>svg]:size-5">{icon}</span>
        <span className="flex-1">{label}</span>{" "}
        {count !== undefined && <span className="rounded-full bg-primary-100 px-2 font-semibold text-primary-700">{count}</span>}
        <ChevronRight aria-hidden className={cn("size-4 text-muted transition-transform motion-reduce:transition-none", open && "rotate-90")} />
      </button>
      {open && children}
    </div>
  );
}
