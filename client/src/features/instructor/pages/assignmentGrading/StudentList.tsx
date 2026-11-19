import { cn } from "../../../../shared/lib/cn";
import { Card } from "../../../../shared/ui/Card";
import { FilterChip } from "../../../../shared/ui/FilterChip";
import { FILTER_LABELS, GRADING_FILTERS, matchesFilter, type GradingFilter, type StudentRow } from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";
import { LateBadge, StatusBadge } from "./StatusBadge";

export interface StudentListProps {
  title: string;
  rows: StudentRow[];
  counts: Record<GradingFilter, number>;
  filter: GradingFilter;
  onFilter: (filter: GradingFilter) => void;
  selectedId?: string;
  onSelect: (studentId: string) => void;
  gradeRelease: Activity["gradeRelease"];
}

/** The class list for one assignment: filter chips with counts, then one row per student. */
export function StudentList({ title, rows, counts, filter, onFilter, selectedId, onSelect, gradeRelease }: StudentListProps) {
  const shown = rows.filter((row) => matchesFilter(row, filter));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Wrapped rather than scrolled (FilterChipGroup scrolls): all six fit in a narrow column and none hide. */}
      <div role="group" aria-label="Show students" className="flex flex-wrap gap-2">
        {GRADING_FILTERS.map((item) => (
          <FilterChip key={item} selected={filter === item} count={counts[item]} onClick={() => onFilter(item)}>{FILTER_LABELS[item]}</FilterChip>
        ))}
      </div>
      <Card className="p-2">
        {shown.length ? (
          <ul aria-label={`Students for ${title}`} className="m-0 flex list-none flex-col p-0">
            {shown.map((row) => (
              <li key={row.studentId}>
                <button
                  type="button"
                  aria-current={row.studentId === selectedId ? "true" : undefined}
                  onClick={() => onSelect(row.studentId)}
                  className={cn(
                    "flex min-h-touch w-full flex-col items-start justify-center gap-1 rounded-control border-0 px-3 py-2 text-left font-sans focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                    row.studentId === selectedId ? "bg-primary-100" : "bg-transparent hover:bg-primary-50",
                  )}
                >
                  <strong className="text-body font-semibold break-words text-ink">{row.name}</strong>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge row={row} gradeRelease={gradeRelease} />
                    {row.latest?.late && <LateBadge />}
                    {row.versions.length > 1 && <span className="text-body text-muted">Version {row.latest?.attemptNumber}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 p-3 text-body text-muted">No students match “{FILTER_LABELS[filter]}”.</p>
        )}
      </Card>
    </div>
  );
}
