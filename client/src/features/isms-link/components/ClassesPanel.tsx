import { CalendarClock, Inbox } from "lucide-react";
import { Panel } from "../../../shared/components/Panel";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Field, Select } from "../../../shared/ui/Field";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { instructorName } from "../api/format";
import { classFilters } from "../api/isms";
import { useIsmsClasses } from "../hooks/useIsmsClasses";
import { useIsmsInstructors } from "../hooks/useIsmsInstructors";
import { ClassCard } from "./ClassCard";
import { QueryError } from "./QueryError";

const cardGrid = "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-3 p-0 sm:gap-4";

/** GET /api/classes, filtered by an instructor from GET /api/instructors. */
export function ClassesPanel({ instructorId, onInstructorChange }: { instructorId: string; onInstructorChange: (id: string) => void }) {
  const instructors = useIsmsInstructors();
  const classes = useIsmsClasses(classFilters(instructorId));
  const options = [...(instructors.data?.items ?? [])].sort((a, b) => instructorName(a).localeCompare(instructorName(b)));

  const instructorHint = instructors.isPending
    ? "Loading instructors…"
    : instructors.isError
      ? "The instructor list could not be loaded; showing all classes."
      : undefined;

  return (
    <Panel id="isms-classes-heading" icon={<CalendarClock />} title="Classes" count={classes.data?.items.length}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Instructor" hint={instructorHint} className="sm:w-80">
          <Select value={instructorId} onChange={(event) => onInstructorChange(event.target.value)} disabled={!instructors.isSuccess}>
            <option value="">All instructors</option>
            {options.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>{instructorName(instructor)}</option>
            ))}
          </Select>
        </Field>
      </div>

      {classes.isPending ? (
        <SkeletonGroup label="Loading classes" className={cardGrid}>
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-48 rounded-card" />)}
        </SkeletonGroup>
      ) : classes.isError ? (
        <QueryError error={classes.error} what="Classes" onRetry={() => void classes.refetch()} retrying={classes.isFetching} />
      ) : classes.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={instructorId ? "No classes for this instructor" : "No classes in ISMS"}
          description={instructorId ? "Choose another instructor, or All instructors." : "ISMS returned no class schedules."}
        />
      ) : (
        <ul aria-label="Classes from ISMS" aria-busy={classes.isPlaceholderData || undefined} className={cardGrid}>
          {classes.data.items.map((item) => <ClassCard key={item.id} item={item} />)}
        </ul>
      )}
    </Panel>
  );
}
