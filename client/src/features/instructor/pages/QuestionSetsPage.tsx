import { ListChecks, Lock } from "lucide-react";
import { useNavigate } from "react-router";
import { describeApiError } from "../../../shared/api/http";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { setFacts, useQuestionSets } from "../api/questionSets";
import { QuestionSetUses } from "../components/QuestionSetUses";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";
import { subjectLabel, subjectLabels } from "./questionSetUtils";

/** Every question set the instructor owns, and the exams that use each one (D-034). */
export default function QuestionSetsPage() {
  const navigate = useNavigate();
  const { store, rooms } = useInstructorWorkspace();
  const sets = useQuestionSets();
  const labels = subjectLabels(store, rooms);
  const count = sets.data?.length;
  const header = (
    <PageHeader
      title="Question sets"
      description={count === undefined ? "Questions you can reuse in exams for the same subject." : `${count} ${count === 1 ? "set" : "sets"}. A set can back exams in any of your classes for its subject.`}
    />
  );

  if (sets.isPending) {
    return (
      <>
        {header}
        <SkeletonGroup label="Loading your question sets" className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </SkeletonGroup>
      </>
    );
  }
  if (sets.isError) {
    const { title, detail } = describeApiError(sets.error);
    return (
      <>
        {header}
        <EmptyState title={title} description={detail} action={<Button onClick={() => void sets.refetch()}>Try again</Button>} />
      </>
    );
  }
  if (!sets.data.length) {
    return (
      <>
        {header}
        <EmptyState icon={<ListChecks />} title="No question sets yet" description="A set is created when you write the questions for a new assessment." />
      </>
    );
  }

  return (
    <>
      {header}
      <ul className="@container m-0 grid list-none grid-cols-1 gap-3 p-0 sm:gap-4 @4xl:grid-cols-2">
        {sets.data.map((set) => (
          <li key={set.id} className="flex">
            <Card className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="m-0 min-w-0 font-sans text-card-title font-semibold">
                  <button
                    type="button"
                    onClick={() => navigate(instructorPaths.questionSet(set.id))}
                    className="min-h-touch max-w-full rounded-control border-0 bg-transparent p-0 text-left font-sans text-card-title font-semibold whitespace-normal text-ink hover:text-primary-700 hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                  >
                    {set.title}
                  </button>
                </h2>
                {set.locked && <Badge tone="warning"><Lock aria-hidden className="size-3.5" />Locked</Badge>}
              </div>
              <p className="m-0 text-body text-muted">{subjectLabel(labels, set.subjectId)} · {setFacts(set)}</p>
              <div className="flex flex-col gap-1">
                <h3 className="m-0 font-sans text-body font-semibold text-ink">Used by</h3>
                <QuestionSetUses uses={set.usedBy} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
