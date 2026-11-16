import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, ShieldCheck } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useEffect, useLayoutEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { cn } from "../../../shared/lib/cn";
import { formatCountdown, pad2 } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { describeApiError } from "../../../shared/api/http";
import { BackLink } from "../../../shared/components/BackLink";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { failureMessage, saveAnswers, startAttempt, studentKeys, studentQueryOptions, submitAttempt, type Attempt, type ChosenAnswers } from "../api/student";
import { useQuizSession } from "../hooks/useQuizSession";
import { useRefreshStudent, useStudentCatalog, useStudentViewer } from "../hooks/useStudentCatalog";
import { studentPaths } from "../paths";

/** Announces only milestones, not every second, so screen readers are not flooded (plan §7). */
function timerAnnouncement(seconds: number) {
  if (seconds === 30) return "30 seconds left for this question.";
  if (seconds === 10) return "10 seconds left for this question.";
  if (seconds === 0) return "Time is up for this question.";
  return null;
}

function Quiz({ assessmentId, attempt }: { assessmentId: string; attempt: Attempt }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const catalog = useStudentCatalog();
  const viewer = useStudentViewer();
  const refresh = useRefreshStudent();
  const assessment = catalog.assessments.find((item) => item.id === assessmentId)!;
  const course = catalog.courses.find((item) => item.id === assessment.courseId);
  // Questions arrive without answers; the server keeps them (D-032).
  const questions = attempt.questions.map((item) => ({ id: item.id, prompt: item.prompt, points: item.points, context: undefined as string | undefined, options: item.options.map((option) => option.text), optionIds: item.options.map((option) => option.id) }));
  const [answers, setAnswers] = useState<Record<number, number>>(() =>
    Object.fromEntries(attempt.answers.flatMap((answer) => {
      const index = questions.findIndex((item) => item.id === answer.questionId);
      const option = index < 0 ? -1 : questions[index]!.optionIds.indexOf(answer.optionId ?? -1);
      return option >= 0 ? [[index, option]] : [];
    })),
  );
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const submitting = useRef(false);

  const chosen = (current: Record<number, number>): ChosenAnswers =>
    Object.entries(current).flatMap(([index, option]) => {
      const item = questions[Number(index)];
      const optionId = item?.optionIds[option];
      return item && optionId !== undefined ? [{ questionId: item.id, optionId }] : [];
    });

  const saveAnswer = (_assessmentId: string, index: number, option: number) => {
    const next = { ...answers, [index]: option };
    setAnswers(next);
    saveAnswers(viewer, assessment.courseId, assessment.id, attempt.id, chosen(next)).catch((failure: unknown) =>
      toast.show({ title: "Your answer was not saved", description: failureMessage(failure), tone: "danger" }),
    );
  };

  const finish = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await submitAttempt(viewer, assessment.courseId, assessment.id, attempt.id, chosen(answers));
    } catch (failure) {
      submitting.current = false;
      toast.show({ title: "Could not submit the assessment", description: failureMessage(failure), tone: "danger" });
      return;
    }
    queryClient.removeQueries({ queryKey: studentKeys.attempt(viewer.id, assessment.id) });
    await refresh();
    navigate(studentPaths.result(assessment.id), { replace: true });
  };
  const { index, seconds, goToQuestion } = useQuizSession(questions.length, () => void finish());
  const question = questions[index];
  const answered = Object.keys(answers).length;
  const isLast = index === questions.length - 1;

  useEffect(() => {
    const message = timerAnnouncement(seconds);
    // oxlint-disable-next-line react/set-state-in-effect -- mirrors the clock into a live region at milestones only
    if (message) setAnnouncement(message);
  }, [seconds]);

  // The latest save function, so the keyboard listener never uses stale answers.
  const saveRef = useRef(saveAnswer);
  useLayoutEffect(() => {
    saveRef.current = saveAnswer;
  });

  // Keyboard shortcuts: 1–4 pick an answer (plan §7). Ignored while typing or in the dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirming || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest("input, textarea")) return;
      const option = Number.parseInt(event.key, 10) - 1;
      if (question && option >= 0 && option < question.options.length) saveRef.current(assessment.id, index, option);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assessment.id, confirming, index, question]);

  if (!question) return <Navigate to={studentPaths.assessment(assessment.id)} replace />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink label="Exit assessment" onBack={() => navigate(studentPaths.assessment(assessment.id))} />
        <p className="m-0 flex items-center gap-2 text-body text-muted"><ShieldCheck aria-hidden className="size-4" />Your work saves automatically</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">{assessment.type} · {course?.name}</p>
            <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-bold text-ink outline-none sm:text-page">{assessment.title}</h1>
            <p className="m-0 text-body text-muted">{course?.section} · {assessment.points} points</p>
          </header>
          <p aria-live="polite" className="sr-only">{announcement}</p>

          {/* Timer and progress stick under the top bar for the whole question column,
              so the countdown stays visible while scrolling long questions on phones. */}
          <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-1 flex flex-col gap-2 rounded-card border border-line bg-surface/95 px-4 py-3 font-sans shadow-card backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body">Question <strong className="font-semibold">{pad2(index + 1)}</strong> of {pad2(questions.length)} <span className="text-muted">· {answered} answered</span></span>
              <span className={cn("flex items-center gap-2 rounded-control px-2.5 py-1", seconds <= 15 ? "bg-danger-soft text-danger" : "bg-canvas text-ink")}>
                <Clock3 aria-hidden className="size-4" />
                <span className="sr-only">Time left for this question:</span>
                <strong className="text-body-lg font-bold tabular-nums">{formatCountdown(seconds)}</strong>
              </span>
            </div>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary-600 transition-[width] motion-reduce:transition-none" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
            </div>
          </div>

          <section aria-labelledby="question-prompt" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
            <p className="m-0 flex justify-between text-body text-muted"><span className="font-semibold tracking-wide uppercase">Question {pad2(index + 1)}</span><span>{question.points} points</span></p>
            <h2 id="question-prompt" className="m-0 font-sans text-section font-semibold text-ink">{question.prompt}</h2>
            {question.context && <p className="m-0 rounded-control bg-canvas p-3 text-body">{question.context}</p>}
            <RadioGroup.Root
              aria-label="Choose an answer"
              value={answers[index] === undefined ? "" : String(answers[index])}
              onValueChange={(value) => saveAnswer(assessment.id, index, Number(value))}
              className="flex flex-col gap-2"
            >
              {question.options.map((option, optionIndex) => {
                const selected = answers[index] === optionIndex;
                return (
                  <RadioGroup.Item
                    key={option}
                    value={String(optionIndex)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-card border-2 px-4 py-3 text-left font-sans text-body-lg text-ink transition-colors motion-reduce:transition-none",
                      "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      selected ? "border-primary-600 bg-primary-50" : "border-line bg-surface hover:border-primary-300",
                    )}
                  >
                    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full text-body font-semibold", selected ? "bg-primary-600 text-white" : "bg-canvas text-ink")}>
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {selected && <Check aria-hidden className="size-5 text-primary-700" />}
                  </RadioGroup.Item>
                );
              })}
            </RadioGroup.Root>
            <p className="m-0 text-body text-muted">Select one answer. Tip: press 1–{question.options.length} on a keyboard.</p>
          </section>

          {/* Submit sits apart from Next so it is hard to hit by accident (plan §5). */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" disabled={index === 0} onClick={() => goToQuestion(index - 1)}><ChevronLeft aria-hidden className="size-4" />Previous</Button>
            {isLast ? (
              <Button onClick={() => setConfirming(true)}>Review &amp; submit<ArrowRight aria-hidden className="size-4" /></Button>
            ) : (
              <Button onClick={() => goToQuestion(index + 1)}>Next question<ChevronRight aria-hidden className="size-4" /></Button>
            )}
          </div>
        </div>

        <aside aria-labelledby="question-list" className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 id="question-list" className="m-0 mb-3 font-sans text-card-title font-semibold">Your questions <span className="font-normal text-muted">· {questions.length} total</span></h2>
            <ol className="m-0 grid list-none grid-cols-5 gap-2 p-0">
              {questions.map((item, qIndex) => {
                const done = answers[qIndex] !== undefined;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-label={`Go to question ${qIndex + 1}`}
                      aria-current={index === qIndex ? "step" : undefined}
                      onClick={() => goToQuestion(qIndex)}
                      className={cn(
                        "relative grid size-touch w-full place-items-center rounded-control border font-sans text-body font-semibold focus-visible:outline-3 focus-visible:outline-focus",
                        index === qIndex ? "border-primary-600 bg-primary-600 text-white" : done ? "border-primary-200 bg-primary-50 text-primary-700" : "border-line bg-surface text-ink hover:bg-primary-50",
                      )}
                    >
                      {pad2(qIndex + 1)}
                      {done && <Check aria-hidden className="absolute top-0.5 right-0.5 size-3" />}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="m-0 mt-3 text-body text-muted">Each question has its own timer.</p>
          </div>
          <Button variant="ghost" onClick={() => setConfirming(true)}>Submit assessment</Button>
        </aside>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title="Submit this assessment?"
          description={`You answered ${answered} of ${questions.length} questions. Unanswered questions will be submitted blank.`}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Keep working</Button></DialogClose>
              <Button onClick={() => void finish()}>Submit now<ArrowRight aria-hidden className="size-4" /></Button>
            </>
          }
        />
      </Dialog>
    </>
  );
}

/** Starts the attempt on the server, or resumes the open one. */
function AttemptLoader({ assessmentId, classId }: { assessmentId: string; classId: string }) {
  const navigate = useNavigate();
  const viewer = useStudentViewer();
  const attempt = useQuery({
    queryKey: studentKeys.attempt(viewer.id, assessmentId),
    queryFn: () => startAttempt(viewer, classId, assessmentId),
    ...studentQueryOptions,
    staleTime: Infinity,
    gcTime: 0,
  });
  if (attempt.isPending) {
    return <SkeletonGroup label="Starting your assessment" className="flex flex-col gap-4"><Skeleton className="h-9 w-1/2" /><Skeleton className="h-64 w-full" /></SkeletonGroup>;
  }
  if (attempt.isError) {
    const title = failureMessage(attempt.error);
    return (
      <EmptyState
        title="This assessment could not start"
        description={title || describeApiError(attempt.error).detail}
        action={<Button variant="secondary" onClick={() => navigate(studentPaths.assessment(assessmentId))}>Back to the assessment</Button>}
      />
    );
  }
  if (!attempt.data.questions.length) return <Navigate to={studentPaths.assessment(assessmentId)} replace />;
  // Keyed so a new attempt always starts with fresh timers.
  return <Quiz key={attempt.data.id} assessmentId={assessmentId} attempt={attempt.data} />;
}

export default function QuizPage() {
  const { assessmentId = "" } = useParams();
  const catalog = useStudentCatalog();
  const assessment = catalog.assessments.find((item) => item.id === assessmentId);
  if (!assessment || assessment.kind === "activity") {
    return <Navigate to={assessment ? studentPaths.assessment(assessment.id) : studentPaths.tasks()} replace />;
  }
  return <AttemptLoader key={assessment.id} assessmentId={assessment.id} classId={assessment.courseId} />;
}
