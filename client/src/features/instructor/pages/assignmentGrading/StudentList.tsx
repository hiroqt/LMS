import { Send } from "lucide-react";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { FilterChip } from "../../../../shared/ui/FilterChip";
import { FILTER_LABELS, GRADING_FILTERS, matchesFilter, type GradingFilter, type StudentRow } from "../../api/assignmentGrading";
import { ownDatesLabel } from "../../api/exceptions";
import type { Activity } from "../../api/types";
import { ExcusedBadge, LateBadge, StatusBadge } from "./StatusBadge";

export interface StudentListProps {
  title: string;
  rows: StudentRow[];
  counts: Record<GradingFilter, number>;
  filter: GradingFilter;
  onFilter: (filter: GradingFilter) => void;
  selectedId?: string;
  onSelect: (studentId: string) => void;
  activity: Pick<Activity, "gradeRelease" | "dueAt" | "closeAt">;
  /** When grades wait to be returned: the students chosen for "Return selected", and how to change them. */
  chosen?: ReadonlySet<string>;
  onChoose?: (studentId: string, chosen: boolean) => void;
  onReturnChosen?: () => void;
  /** How many chosen students can be returned now. */
  chosenCount?: number;
}

/** The class list for one assignment: filter chips with counts, then one row per student. */
export function StudentList({ title, rows, counts, filter, onFilter, selectedId, onSelect, activity, chosen, onChoose, onReturnChosen, chosenCount = 0 }: StudentListProps) {
  const shown = rows.filter((row) => matchesFilter(row, filter));
  const choosing = Boolean(chosen && onChoose);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Wrapped rather than scrolled (FilterChipGroup scrolls): all seven fit in a narrow column and none hide. */}
      <div role="group" aria-label="Show students" className="flex flex-wrap gap-2">
        {GRADING_FILTERS.map((item) => (
          <FilterChip key={item} selected={filter === item} count={counts[item]} onClick={() => onFilter(item)}>{FILTER_LABELS[item]}</FilterChip>
        ))}
      </div>
      {choosing && onReturnChosen && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-body text-muted">Choose graded work with the boxes to return only some.</p>
          <Button variant="secondary" className="max-w-full shrink whitespace-normal" icon={<Send aria-hidden className="size-4" />} disabled={chosenCount === 0} onClick={onReturnChosen}>
            Return selected ({chosenCount})
          </Button>
        </div>
      )}
      <Card className="p-2">
        {shown.length ? (
          <ul aria-label={`Students for ${title}`} className="m-0 flex list-none flex-col p-0">
            {shown.map((row) => {
              const dates = ownDatesLabel(activity, row.exception);
              const returnable = choosing && row.status === "graded";
              return (
                <li key={row.studentId} className="flex min-w-0 items-stretch gap-1">
                  {choosing && (returnable ? (
                    // The whole 44px cell toggles the box (C-003).
                    <label className="grid min-h-touch w-touch shrink-0 cursor-pointer place-items-center rounded-control hover:bg-primary-50">
                      <input
                        type="checkbox"
                        aria-label={`Choose ${row.name} to return`}
                        checked={chosen?.has(row.studentId) ?? false}
                        onChange={(event) => onChoose?.(row.studentId, event.target.checked)}
                        className="size-5 cursor-pointer accent-primary-600"
                      />
                    </label>
                  ) : (
                    <span aria-hidden className="w-touch shrink-0" />
                  ))}
                  <button
                    type="button"
                    aria-current={row.studentId === selectedId ? "true" : undefined}
                    onClick={() => onSelect(row.studentId)}
                    className={cn(
                      "flex min-h-touch min-w-0 flex-1 flex-col items-start justify-center gap-1 rounded-control border-0 px-3 py-2 text-left font-sans focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                      row.studentId === selectedId ? "bg-primary-100" : "bg-transparent hover:bg-primary-50",
                    )}
                  >
                    <strong className="text-body font-semibold break-words text-ink">{row.name}</strong>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge row={row} gradeRelease={activity.gradeRelease} />
                      {row.excused && row.latest?.score != null && <ExcusedBadge />}
                      {row.latest?.late && <LateBadge days={row.latest.daysLate} />}
                      {row.versions.length > 1 && <span className="text-body text-muted">Version {row.latest?.attemptNumber}</span>}
                    </span>
                    {dates && <span className="text-body text-muted">{dates}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 p-3 text-body text-muted">No students match “{FILTER_LABELS[filter]}”.</p>
        )}
      </Card>
    </div>
  );
}
