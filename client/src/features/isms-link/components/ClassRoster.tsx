import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { sortStudents, studentName } from "../api/format";
import { useClassStudents } from "../hooks/useClassStudents";
import { QueryError } from "./QueryError";

/** The students ISMS lists for one class. Mounted only while the roster is open. */
export function ClassRoster({ id, classId, className }: { id: string; classId: string; className: string }) {
  const students = useClassStudents(classId, true);

  return (
    <div id={id} role="region" aria-label={`Students in ${className}`} className="flex flex-col gap-2">
      {students.isPending ? (
        <SkeletonGroup label="Loading students" className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-6" />)}
        </SkeletonGroup>
      ) : students.isError ? (
        <QueryError error={students.error} what="Students" onRetry={() => void students.refetch()} retrying={students.isFetching} />
      ) : students.data.items.length === 0 ? (
        <EmptyState className="py-6" title="No students enrolled" description="ISMS lists no enrollments for this class." />
      ) : (
        <>
          <p className="m-0 text-body text-muted">{students.data.items.length} {students.data.items.length === 1 ? "student" : "students"}</p>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {sortStudents(students.data.items).map((student) => (
              <li key={student.enrollmentId} className="flex flex-wrap justify-between gap-x-3 border-b border-line py-1.5 text-body text-ink last:border-b-0">
                <span>{studentName(student)}</span>
                <span className="text-muted tabular-nums">{student.studentId}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
