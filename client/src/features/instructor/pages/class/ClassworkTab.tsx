import { ArrowRight, ClipboardList, GraduationCap, Plus } from "lucide-react";
import { useState } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { cn } from "../../../../shared/lib/cn";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { classWork } from "../../api/selectors";
import { dueLabel } from "./classUtils";
import { ListSearch, type ClassTabProps } from "./shared";

const FILTERS = [
  { id: "All", label: "All work" },
  { id: "Assignment", label: "Assignments" },
  { id: "Assessment", label: "Assessments" },
] as const;

export function ClassworkTab({ content, goTab }: ClassTabProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof FILTERS)[number]["id"]>("All");
  const work = classWork(content);
  const shown = work.filter((item) => (type === "All" || item.kind === type) && `${item.title} ${item.kind}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Assignments and assessments" title="Classwork" count={work.length} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <ListSearch label="Search classwork" placeholder="Search classwork" value={query} onChange={setQuery} />
          <Button onClick={() => goTab("Create content")} icon={<Plus aria-hidden className="size-4" />}>Create</Button>
        </div>
      </div>
      <div role="group" aria-label="Filter classwork" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {FILTERS.map((filter) => {
          const count = filter.id === "All" ? work.length : work.filter((item) => item.kind === filter.id).length;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={type === filter.id}
              onClick={() => setType(filter.id)}
              className={cn(
                "inline-flex min-h-touch shrink-0 items-center gap-2 rounded-full border px-4 font-sans text-body font-medium focus-visible:outline-3 focus-visible:outline-focus",
                type === filter.id ? "border-primary-600 bg-primary-600 text-white" : "border-line-strong bg-surface text-ink hover:bg-primary-50",
              )}
            >
              {filter.label}{" "}
              <span className={cn("rounded-full px-2 font-semibold", type === filter.id ? "bg-primary-800" : "bg-canvas")}>{count}</span>
            </button>
          );
        })}
      </div>
      {shown.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 font-sans">
              <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-control", item.kind === "Assignment" ? "bg-accent-100 text-accent-700" : "bg-info-soft text-info")}>
                {item.kind === "Assignment" ? <ClipboardList className="size-5" /> : <GraduationCap className="size-5" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <strong className="text-card-title font-semibold">{item.title}</strong>
                <span className="text-body text-muted">{item.kind} · Due {dueLabel(item.dueAt)} · {item.points} points</span>
              </span>
              <Badge tone="success">Published</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ClipboardList />}
          title={work.length ? "No classwork matches your search" : "No classwork yet"}
          action={<Button variant="secondary" onClick={() => goTab("Create content")}>Create the first item<ArrowRight aria-hidden className="size-4" /></Button>}
        />
      )}
    </div>
  );
}
