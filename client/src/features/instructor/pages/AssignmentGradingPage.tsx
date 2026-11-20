import { Download, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { describeApiError } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import {
  filterCounts,
  handedInNothing,
  isGradingFilter,
  nextToGradeIn,
  notHandedInRefusal,
  returnable,
  selectedReturnable,
  studentRows,
  studentsLabel,
  useAssignmentSubmissions,
  useDownloadAllWork,
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
 * One assignment's grading (D-061, D-064): the class list with filters, one student's work with a
 * file viewer, points or a rubric and feedback with Save and next, late penalties, a student's own
 * dates and excuse, Return (one, selected, or all), and every student's work as one zip. The
 * filter and the student are in the URL (`?filter=&student=`); Classwork opens it with Grading.
 */
export default function AssignmentGradingPage() {
  const { classId = "", assignmentId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { store, rooms } = useInstructorWorkspace();
  const { instructorId } = useInstructorSession();
  const viewer = useMemo<Viewer>(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
  const query = useAssignmentSubmissions(classId, assignmentId);
  const [returning, setReturning] = useState<ReturnRequest | null>(null);
  // Graded work chosen for "Return selected" (only when grades wait to be returned).
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
  const [downloading, setDownloading] = useState(false);
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
  const download = useDownloadAllWork(classId, assignmentId, activity?.title ?? "");
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
  const chosenIds = selectedReturnable(rows, chosen);
  const refusal = notHandedInRefusal(activity, now);
  const handedIn = rows.filter((row) => !handedInNothing(row)).length;
  const noWork = query.isSuccess && handedIn === 0;

  const downloadAll = async () => {
    if (downloading) return;
    setDownloading(true);
    const result = await download();
    setDownloading(false);
    if (!result.ok) {
      toast.show({ title: "Could not download the work", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Work downloaded", description: `${result.fileName ?? "The zip"} · the latest work of ${studentsLabel(handedIn)}.`, tone: "success" });
  };

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
            activity={activity}
            {...(held ? {
              chosen,
              chosenCount: chosenIds.length,
              onChoose: (id: string, on: boolean) => setChosen((current) => {
                const next = new Set(current);
                if (on) next.add(id);
                else next.delete(id);
                return next;
              }),
              onReturnChosen: () => setReturning({ name: null, studentIds: chosenIds, count: chosenIds.length }),
            } : {})}
          />
          <GradeEveryoneMissing classId={room.id} activity={activity} missing={rows.filter((row) => !row.latest && !row.excused).length} refusal={refusal} />
        </div>
        {selected ? (
          <StudentWork
            key={selected.studentId}
            classId={room.id}
            activity={activity}
            row={selected}
            viewer={viewer}
            refusal={notHandedInRefusal(activity, now, selected.exception)}
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
        actions={
          <>
            <Button
              variant="secondary"
              className="max-w-full shrink whitespace-normal"
              icon={<Download aria-hidden className="size-4" />}
              loading={downloading}
              loadingLabel="Downloading…"
              disabled={!query.isSuccess || noWork}
              aria-describedby={noWork ? "download-reason" : undefined}
              onClick={() => void downloadAll()}
            >
              Download all work (.zip)
            </Button>
            {held && (
              <Button
                variant="secondary"
                icon={<Send aria-hidden className="size-4" />}
                disabled={waiting.length === 0}
                onClick={() => setReturning({ name: null, count: waiting.length })}
              >
                Return all graded
              </Button>
            )}
          </>
        }
      />
      {noWork && <p id="download-reason" className="m-0 text-body text-muted">Nobody has handed in work yet, so there is nothing to download.</p>}
      {held && (
        <p className="m-0 text-body">
          Students don't see grades until you return them. {waiting.length ? `${studentsLabel(waiting.length)} graded, not returned yet.` : "Nothing is waiting to be returned."}
        </p>
      )}
      {body}
      <ReturnDialog
        classId={room.id}
        assignmentId={activity.id}
        title={activity.title}
        request={returning}
        onClose={() => setReturning(null)}
        onReturned={() => setChosen(new Set())}
      />
    </>
  );
}
