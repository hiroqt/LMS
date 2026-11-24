import { Copy, ListChecks, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { describeApiError } from "../../../shared/api/http";
import type { Rubric } from "../../../shared/api/rubrics";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { rubricFacts, useRubricActions, useRubrics } from "../api/rubrics";
import { subjectOf } from "../api/selectors";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";
import { DeleteRubricDialog } from "./rubrics/DeleteRubricDialog";

/** A class's grading rubrics (D-062, D-063): open, copy, or delete one, or write a new one. */
export default function RubricsPage() {
  const { classId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { rooms, store } = useInstructorWorkspace();
  const room = rooms.find((item) => item.id === classId);
  const rubrics = useRubrics(room?.id ?? "");
  const actions = useRubricActions(room?.id ?? "");
  const [copying, setCopying] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Rubric | null>(null);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  const subject = subjectOf(store, room);

  const copy = async (rubric: Rubric) => {
    setCopying(rubric.id);
    const result = await actions.copy(rubric.id);
    setCopying(null);
    if (!result.ok || !result.rubric) {
      toast.show({ title: "Could not copy the rubric", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Rubric copied", description: `${result.rubric.title} can be changed; no grade uses it.`, tone: "success" });
  };

  const header = (
    <>
      <BackLink label="Back to classwork" onBack={() => navigate(instructorPaths.classPage(room.id, "Classwork"))} />
      <PageHeader
        title="Rubrics"
        description={`${subject?.title ?? "Classroom"} · ${room.section}. A rubric lists what work is graded on; an assignment that uses one is worth its total.`}
        actions={<Button icon={<Plus aria-hidden className="size-4" />} onClick={() => navigate(instructorPaths.rubricNew(room.id))}>New rubric</Button>}
      />
    </>
  );

  if (rubrics.isPending) {
    return (
      <>
        {header}
        <SkeletonGroup label="Loading the rubrics" className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </SkeletonGroup>
      </>
    );
  }
  if (rubrics.isError) {
    const { title, detail } = describeApiError(rubrics.error);
    return (
      <>
        {header}
        <EmptyState title={title} description={detail} action={<Button onClick={() => void rubrics.refetch()}>Try again</Button>} />
      </>
    );
  }

  return (
    <>
      {header}
      {rubrics.data.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No rubrics yet" description="Write one with New rubric, then choose it on an assignment's Dates and grading tab." />
      ) : (
        <ul aria-label="Rubrics" className="@container m-0 grid list-none grid-cols-1 gap-3 p-0 sm:gap-4 @4xl:grid-cols-2">
          {rubrics.data.map((rubric) => (
            <li key={rubric.id} className="flex">
              <Card className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="m-0 min-w-0 font-sans text-card-title font-semibold break-words text-ink">{rubric.title}</h2>
                  {rubric.locked && <Badge tone="warning"><Lock aria-hidden className="size-3.5" />Locked</Badge>}
                </div>
                <p className="m-0 text-body text-muted">{rubricFacts(rubric)}</p>
                {rubric.locked && <p className="m-0 text-body text-ink">Used to grade, so its criteria can't change. Copy it to change them.</p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => navigate(instructorPaths.rubric(room.id, rubric.id))}>
                    Open<span className="sr-only"> {rubric.title}</span>
                  </Button>
                  <Button variant="secondary" icon={<Copy aria-hidden className="size-4" />} loading={copying === rubric.id} loadingLabel="Copying…" disabled={copying !== null && copying !== rubric.id} onClick={() => void copy(rubric)}>
                    Copy<span className="sr-only"> {rubric.title}</span>
                  </Button>
                  <Button variant="ghost" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setDeleting(rubric)}>
                    Delete<span className="sr-only"> {rubric.title}</span>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <DeleteRubricDialog
        rubric={deleting}
        onClose={() => setDeleting(null)}
        onDelete={actions.remove}
        onGone={() => document.querySelector<HTMLElement>("main h1")?.focus()}
      />
    </>
  );
}
