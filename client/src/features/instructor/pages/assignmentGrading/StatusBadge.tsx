import { CircleAlert, CircleCheck, Clock, Lock, Send } from "lucide-react";
import { Badge } from "../../../../shared/ui/Badge";
import { statusLabel, type StudentRow } from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";

/** A row's state as an icon and words (C-019): held grades and returned ones look different. */
export function StatusBadge({ row, gradeRelease }: { row: StudentRow; gradeRelease: Activity["gradeRelease"] }) {
  const label = statusLabel(row, gradeRelease);
  const icon = "size-4 shrink-0";
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

export function LateBadge() {
  return <Badge tone="warning"><Clock aria-hidden className="size-4 shrink-0" />Late</Badge>;
}
