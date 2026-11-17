import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { useExamCoursework, useSpellingReview, waitingCount } from "../api/grading";
import { classContent, classMark, gradedLabel, subjectOf } from "../api/selectors";
import { AnswerKeyDialog } from "../components/AnswerKeyDialog";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths, isGradingView, type GradingView } from "../paths";
import { ExamSubmissionsView } from "./grading/ExamSubmissionsView";
import { ItemAnalysisView } from "./grading/ItemAnalysisView";
import { SpellingReviewView } from "./grading/SpellingReviewView";

const LABELS: Record<GradingView, string> = { submissions: "Submissions", "spelling-review": "Spelling review", "item-analysis": "Item analysis" };

/**
 * One exam's grading (D-042): its attempts, the spelling review list, and item analysis, each
 * at its own URL (`?view=`), plus fixing the answer key. Opened from Classwork and Submissions.
 */
export default function ExamGradingPage() {
  const { classId = "", examId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { store, rooms } = useInstructorWorkspace();
  const requested = params.get("view");
  const urlView: GradingView = isGradingView(requested) ? requested : "submissions";
  // Show the chosen tab at once; the URL follows (as on the class page, L-028).
  const [pendingView, setPendingView] = useState<GradingView | null>(null);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- clears the optimistic tab once the URL catches up
    if (pendingView === urlView) setPendingView(null);
  }, [pendingView, urlView]);
  const [keyDialog, setKeyDialog] = useState<{ questionId?: number } | null>(null);
  const coursework = useExamCoursework(classId, examId);
  const spelling = useSpellingReview(classId, examId);

  const room = rooms.find((item) => item.id === classId);
  const exam = store.exams.find((item) => item.id === examId && item.classroomId === classId);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  if (!exam) return <Navigate to={instructorPaths.classPage(room.id, "Classwork")} replace />;

  const view = pendingView ?? urlView;
  const review = params.get("review") ?? undefined;
  const go = (next: GradingView, extra: { review?: string } = {}) => {
    setPendingView(next);
    navigate(instructorPaths.examGrading(room.id, exam.id, next, extra), { replace: true });
  };
  const content = classContent(store, room.id);
  const waiting = store.examSubmissions.filter((item) => item.examId === exam.id && item.status === "submitted").length;
  const spellingWaiting = waitingCount(spelling.data);
  const setId = coursework.data?.questionnaireId ?? null;
  const counts: Partial<Record<GradingView, number>> = { submissions: waiting, "spelling-review": spellingWaiting };

  return (
    <>
      <BackLink label="Back to classwork" onBack={() => navigate(instructorPaths.classPage(room.id, "Classwork"))} />
      <PageHeader
        title={exam.title}
        description={`${classMark(subjectOf(store, room))} · ${room.section} · ${gradedLabel({ gradedCount: exam.gradedCount ?? 0, rosterCount: exam.rosterCount ?? 0 })}`}
        actions={
          <Button variant="secondary" icon={<KeyRound aria-hidden className="size-4" />} disabled={!setId} onClick={() => setKeyDialog({})}>
            Fix answer key
          </Button>
        }
      />
      <Tabs value={view} onValueChange={(value) => go(isGradingView(value) ? value : "submissions")}>
        <TabsList aria-label="Exam grading">
          {(Object.keys(LABELS) as GradingView[]).map((item) => (
            <TabsTrigger key={item} value={item}>
              {LABELS[item]}
              {counts[item] !== undefined && <> <span className="rounded-full bg-canvas px-2 text-body font-semibold">{counts[item]}</span></>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="submissions">
          <ExamSubmissionsView classId={room.id} exam={exam} students={content.students} selectedId={review} onSelect={(id) => go("submissions", { review: id })} />
        </TabsContent>
        <TabsContent value="spelling-review">
          <SpellingReviewView classId={room.id} examId={exam.id} examTitle={exam.title} />
        </TabsContent>
        <TabsContent value="item-analysis">
          <ItemAnalysisView classId={room.id} examId={exam.id} examTitle={exam.title} canFix={Boolean(setId)} onFixKey={(questionId) => setKeyDialog({ questionId })} />
        </TabsContent>
      </Tabs>
      <AnswerKeyDialog setId={setId} questionId={keyDialog?.questionId} open={keyDialog !== null} onOpenChange={(open) => { if (!open) setKeyDialog(null); }} />
    </>
  );
}
