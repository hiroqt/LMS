import { CircleAlert, CircleCheck, CircleSlash, Clock, Lock, Send } from "lucide-react";
import { Badge } from "../../../../shared/ui/Badge";
import { daysLateLabel, statusLabel, type StudentRow } from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";

/** A row's state as an icon and words (C-019): held grades and returned ones look different. */
export function StatusBadge({ row, gradeRelease }: { row: StudentRow; gradeRelease: Activity["gradeRelease"] }) {
  const label = statusLabel(row, gradeRelease);
  const icon = "size-4 shrink-0";
  if (label === "Excused") return <ExcusedBadge />;
  switch (row.status) {
    case "missing":
      return <Badge tone="neutral"><CircleAlert aria-hidden className={icon} />{label}</Badge>;
    case "needs-grading":
      return <Badge tone="warning"><Clock aria-hidden className={icon} />{label}</Badge>;
    case "graded":
      return gradeRelease === "returned"
        ? <Badge tone="info"><Lock aria-hidden className={icon} />{label}</Badge>
        : <Badge tone="success"><CircleCheck aria-hidden className={icon} />{label}</Badge>;
    case "returned":
      return <Badge tone="success"><Send aria-hidden className={icon} />{label}</Badge>;
  }
}

/** "Late", and how many calendar days late when the server says (contract §10). */
export function LateBadge({ days = 0 }: { days?: number }) {
  return (
    <>
      <Badge tone="warning"><Clock aria-hidden className="size-4 shrink-0" />Late</Badge>
      {days > 0 && <span className="text-body text-muted">{daysLateLabel(days)}</span>}
    </>
  );
}

/** Excused from the assignment (contract §11): in words, never by color alone. */
export function ExcusedBadge() {
  return <Badge tone="neutral"><CircleSlash aria-hidden className="size-4 shrink-0" />Excused</Badge>;
}
