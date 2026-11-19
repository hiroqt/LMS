import { Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { describeApiError } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import {
  filterCounts,
  isGradingFilter,
  nextToGradeIn,
  notHandedInRefusal,
  returnable,
  studentRows,
  studentsLabel,
  useAssignmentSubmissions,
  type GradingFilter,
} from "../api/assignmentGrading";
import { classContent, classMark, gradedLabel, subjectOf } from "../api/selectors";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";
import { GradeEveryoneMissing } from "./assignmentGrading/GradeEveryoneMissing";
import { ReturnDialog, type ReturnRequest } from "./assignmentGrading/ReturnDialog";
import { StudentList } from "./assignmentGrading/StudentList";
import { StudentWork } from "./assignmentGrading/StudentWork";

interface Selection {
  filter: GradingFilter;
  student?: string;
}

/**
 * One assignment's grading (D-061): the class list with filters, one student's work with a file
 * viewer, points and feedback with Save and next, and Return when grades wait for it. The filter
 * and the student are in the URL (`?filter=&student=`); Classwork opens it with Grading.
 */
export default function AssignmentGradingPage() {
  const { classId = "", assignmentId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { store, rooms } = useInstructorWorkspace();
  const { instructorId } = useInstructorSession();
  const viewer = useMemo<Viewer>(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
  const query = useAssignmentSubmissions(classId, assignmentId);
  const [returning, setReturning] = useState<ReturnRequest | null>(null);
  // How the shown student was reached here (not from the URL on load), so their work can be
  // brought into view on phones (click) or take focus (Save and next, whose button goes away).
  const [arrival, setArrival] = useState<{ studentId: string; how: "click" | "next" } | null>(null);
  // "Now" for the last-day rule, read once when the page opens.
  const [now] = useState(() => new Date());

  const requested = params.get("filter");
  const fromUrl: Selection = { filter: isGradingFilter(requested) ? requested : "all", student: params.get("student") ?? undefined };
  // Respond at once; the URL follows in a transition (L-028).
  const [pending, setPending] = useState<Selection | null>(null);
  const urlKey = `${fromUrl.filter}|${fromUrl.student ?? ""}`;
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- clears the optimistic selection once the URL catches up
    if (pending && `${pending.filter}|${pending.student ?? ""}` === urlKey) setPending(null);
  }, [pending, urlKey]);

  const room = rooms.find((item) => item.id === classId);
  const activity = room ? classContent(store, room.id).activities.find((item) => item.id === assignmentId) : undefined;
  const rows = useMemo(() => (query.data ? studentRows(query.data) : []), [query.data]);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  if (!activity) return <Navigate to={instructorPaths.classPage(room.id, "Classwork")} replace />;

  const { filter, student } = pending ?? fromUrl;
  const go = (next: Selection) => {
    setPending(next);
    navigate(instructorPaths.assignmentGrading(room.id, activity.id, { filter: next.filter === "all" ? undefined : next.filter, student: next.student }), { replace: true });
  };
  const held = activity.gradeRelease === "returned";
  const selected = rows.find((row) => row.studentId === student);
  const counts = filterCounts(rows);
  const waiting = returnable(rows);
  const refusal = notHandedInRefusal(activity, now);

  let body;
  if (query.isPending) {
    body = <SkeletonGroup label="Loading the class list" className="flex flex-col gap-2"><Skeleton className="h-11 w-full" /><Skeleton className="h-40 w-full" /></SkeletonGroup>;
  } else if (query.isError) {
    const { title, detail } = describeApiError(query.error);
    body = <EmptyState title={title} description={detail} action={<Button onClick={() => void query.refetch()}>Try again</Button>} />;
  } else {
    body = (
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <StudentList
            title={activity.title}
            rows={rows}
            counts={counts}
            filter={filter}
            onFilter={(next) => go({ filter: next, student })}
            selectedId={student}
            onSelect={(id) => { setArrival({ studentId: id, how: "click" }); go({ filter, student: id }); }}
            gradeRelease={activity.gradeRelease}
          />
          <GradeEveryoneMissing classId={room.id} activity={activity} missing={rows.filter((row) => !row.latest).length} refusal={refusal} />
        </div>
        {selected ? (
          <StudentWork
            key={selected.studentId}
            classId={room.id}
            activity={activity}
            row={selected}
            viewer={viewer}
            refusal={refusal}
            next={nextToGradeIn(rows, filter, selected.studentId)}
            onNext={(id) => { setArrival({ studentId: id, how: "next" }); go({ filter, student: id }); }}
            arrival={arrival?.studentId === selected.studentId ? arrival.how : undefined}
            onReturn={() => setReturning({ name: selected.name, studentIds: [selected.studentId], count: 1 })}
          />
        ) : (
          <p className="m-0 self-start rounded-card border border-dashed border-line-strong p-4 text-body text-muted">Choose a student to see their work and give a grade.</p>
        )}
      </div>
    );
  }

  return (
    <>
      <BackLink label="Back to classwork" onBack={() => navigate(instructorPaths.classPage(room.id, "Classwork"))} />
      <PageHeader
        title={activity.title}
        description={`${classMark(subjectOf(store, room))} · ${room.section} · ${gradedLabel({ gradedCount: activity.gradedCount ?? 0, rosterCount: activity.rosterCount ?? 0 })} · ${activity.maxScore} points`}
        actions={held ? (
          <Button
            variant="secondary"
            icon={<Send aria-hidden className="size-4" />}
            disabled={waiting.length === 0}
            onClick={() => setReturning({ name: null, count: waiting.length })}
          >
            Return all graded
          </Button>
        ) : undefined}
      />
      {held && (
        <p className="m-0 text-body">
          Students don't see grades until you return them. {waiting.length ? `${studentsLabel(waiting.length)} graded, not returned yet.` : "Nothing is waiting to be returned."}
        </p>
      )}
      {body}
      <ReturnDialog classId={room.id} assignmentId={activity.id} title={activity.title} request={returning} onClose={() => setReturning(null)} />
    </>
  );
}
