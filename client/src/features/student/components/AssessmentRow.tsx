import { Check, ChevronRight } from "lucide-react";
import { formatDue } from "../../../shared/lib/format";
import { Badge } from "../../../shared/ui/Badge";
import type { Assessment } from "../api/types";
import { toneFor } from "../../../shared/lib/tones";
import { AssessmentTypeIcon } from "./visuals";

export interface AssessmentRowProps {
  item: Assessment;
  courseIndex: number;
  /** Shown before the assessment type, e.g. "IT204 · Quiz". Omit inside a class page. */
  courseCode?: string;
  completed: boolean;
  missing?: boolean;
  onOpen: () => void;
}

export function AssessmentRow({ item, courseIndex, courseCode, completed, missing, onOpen }: AssessmentRowProps) {
  const meta = [courseCode, item.type, item.kind === "activity" ? undefined : `${item.questionCount ?? 0} questions`, `${item.points} points`].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none"
    >
      <span aria-hidden className={`grid size-11 shrink-0 place-items-center rounded-control ${toneFor(courseIndex)}`}>
        <AssessmentTypeIcon type={item.type} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <strong className="text-card-title font-semibold">{item.title}</strong>
        {item.description && <span className="line-clamp-2 text-body text-muted">{item.description}</span>}
        <span className="text-body text-muted">{meta.join(" · ")}</span>
        <span className="text-body text-muted sm:hidden">Due {formatDue(item.dueAt)}</span>
      </span>
      <span className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
        <span className="text-body text-muted">Due</span>
        <strong className="text-body font-semibold">{formatDue(item.dueAt)}</strong>
      </span>
      {missing && <Badge tone="danger">Missing</Badge>}
      {completed && <Badge tone="success"><Check aria-hidden className="size-3.5" />Submitted</Badge>}
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted group-hover:text-ink" />
    </button>
  );
}
