import { Copy, KeyRound, Lock } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { describeApiError, isApiError } from "../../../shared/api/http";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { setFacts, useQuestionSet, useQuestionSetActions } from "../api/questionSets";
import { AnswerKeyDialog } from "../components/AnswerKeyDialog";
import { QuestionSetEditor, QuestionSetView } from "../components/QuestionSetEditor";
import { QuestionSetUses } from "../components/QuestionSetUses";
import { useGuardedNavigate } from "../hooks/useGuardedNavigate";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";
import { subjectLabel, subjectLabels } from "./questionSetUtils";

/** One question set: edit it while no student has started an exam that uses it; copy it any time (D-034). */
export default function QuestionSetPage() {
  const navigate = useGuardedNavigate();
  const toast = useToast();
  const { setId } = useParams();
  const id = Number(setId);
  const { store, rooms } = useInstructorWorkspace();
  const query = useQuestionSet(id);
  const actions = useQuestionSetActions();
  const [copying, setCopying] = useState(false);
  const [fixingKey, setFixingKey] = useState(false);
  const back = <BackLink label="All question sets" onBack={() => navigate(instructorPaths.questionSets)} />;

  if (query.isPending) {
    return (
      <>
        {back}
        <SkeletonGroup label="Loading the question set" className="flex flex-col gap-3">
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </SkeletonGroup>
      </>
    );
  }
  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.status === 404;
    const { title, detail } = describeApiError(query.error);
    return (
      <>
        {back}
        <PageHeader title={notFound ? "Question set not found" : title} />
        <EmptyState
          title={notFound ? "This set is not one of yours" : title}
          description={notFound ? "It may have been removed, or it belongs to another instructor." : detail}
          action={notFound ? undefined : <Button onClick={() => void query.refetch()}>Try again</Button>}
        />
      </>
    );
  }

  const set = query.data;
  const points = set.questions.reduce((sum, question) => sum + question.points, 0);
  const copy = async () => {
    setCopying(true);
    const result = await actions.copy(set.id);
    setCopying(false);
    if (!result.ok || result.copyId === undefined) {
      toast.show({ title: "Could not copy the set", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Copy made", description: "The copy is not used by any exam, so you can edit it.", tone: "success" });
    navigate(instructorPaths.questionSet(result.copyId));
  };

  return (
    <>
      {back}
      <PageHeader
        title={set.title}
        description={`${subjectLabel(subjectLabels(store, rooms), set.subjectId)} · ${setFacts({ questionCount: set.questions.length, totalPoints: points })}`}
        actions={
          <Button variant="secondary" icon={<Copy aria-hidden className="size-4" />} loading={copying} loadingLabel="Copying…" onClick={() => void copy()}>
            Make a copy
          </Button>
        }
      />
      <section aria-labelledby="set-uses" className="flex flex-col gap-2">
        <h2 id="set-uses" className="m-0 font-sans text-section font-semibold">Used by</h2>
        <QuestionSetUses uses={set.usedBy} onOpen={(use) => navigate(instructorPaths.classPage(use.classId, "Classwork"))} />
      </section>
      <section aria-labelledby="set-questions" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="set-questions" className="m-0 font-sans text-section font-semibold">Questions</h2>
          {set.locked && <Badge tone="warning"><Lock aria-hidden className="size-3.5" />Locked</Badge>}
        </div>
        {set.locked ? (
          <>
            <p role="note" className="m-0 flex items-start gap-2 rounded-card border border-warning/30 bg-warning-soft p-3 text-body text-warning">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
              Students have started an exam that uses this set, so its questions can no longer change: their answers point to these questions. Make a copy to edit the questions; the copy is not used by any exam until you choose it.
            </p>
            {/* A wrong key can still be fixed; every submitted attempt is re-scored (D-042). */}
            <Button variant="secondary" className="self-start" icon={<KeyRound aria-hidden className="size-4" />} onClick={() => setFixingKey(true)}>
              Fix answer key
            </Button>
            <AnswerKeyDialog setId={set.id} open={fixingKey} onOpenChange={setFixingKey} />
            <QuestionSetView set={set} />
          </>
        ) : (
          // Keyed by set only: a background refetch (window focus) must not wipe unsaved edits.
          <QuestionSetEditor key={set.id} set={set} onSave={(title, sections) => actions.save(set, title, sections)} />
        )}
      </section>
    </>
  );
}
