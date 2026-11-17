import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, SpellCheck } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../../shared/lib/cn";
import { formatCountdown, pad2 } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { describeApiError, isApiError } from "../../../shared/api/http";
import { BackLink } from "../../../shared/components/BackLink";
import { fromAnswer, isAnswered, SPELLING_RULES, takesShortcuts, toAnswerInput, usesSpelling } from "../../../shared/components/quiz/answers";
import { QuestionAnswer } from "../../../shared/components/quiz/QuestionAnswer";
import { QuestionPrompt } from "../../../shared/components/quiz/QuestionPrompt";
import type { AnswerChange, AnswerValue, QuizQuestion } from "../../../shared/components/quiz/types";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { failureMessage, saveAnswers, startAttempt, studentKeys, studentQueryOptions, submitAttempt, type Attempt } from "../api/student";
import { SaveStatusNote } from "../components/SaveStatusNote";
import { questionSeconds } from "../hooks/quizSession";
import { useAutosave } from "../hooks/useAutosave";
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

/** A retry helps when the request did not arrive or the server failed; not when it refused the answer. */
const retryable = (error: unknown) => !isApiError(error) || error.kind === "network" || error.kind === "timeout" || error.status >= 500;

/** setTimeout fires at once for waits above about 24.8 days. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** "2, 5, and 7" */
function listNumbers(numbers: number[]): string {
  if (numbers.length <= 2) return numbers.join(" and ");
  return `${numbers.slice(0, -1).join(", ")}, and ${numbers.at(-1)}`;
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
  // Questions arrive without answer keys; the server keeps them (D-032, contract §4).
  const questions = attempt.questions;
  const sections = new Map((attempt.sections ?? []).map((section) => [section.id, section]));
  const spellingMode = attempt.spellingMode ?? assessment.spellingMode;

  const [values, setValues] = useState<Record<number, AnswerValue>>(() => Object.fromEntries(attempt.answers.map((answer) => [answer.questionId, fromAnswer(answer)])));
  // The latest answers, for the keyboard listener and the submit, which must never see stale ones.
  const valuesRef = useRef(values);
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const submitting = useRef(false);

  const { status, announcement: saveAnnouncement, autosaver } = useAutosave({
    save: (answers) => saveAnswers(viewer, assessment.courseId, assessment.id, attempt.id, answers),
    shouldRetry: retryable,
    onFailure: (failure) => toast.show({ title: "Your answer was not saved", description: failureMessage(failure), tone: "danger" }),
  });

  const change = (question: QuizQuestion, value: AnswerValue, how: AnswerChange) => {
    valuesRef.current = { ...valuesRef.current, [question.id]: value };
    setValues(valuesRef.current);
    autosaver.change(toAnswerInput(question, value), how === "choice");
  };

  const finish = async () => {
    if (submitting.current) return;
    submitting.current = true;
    // Let a save in flight land first; the submit itself carries every answer.
    await autosaver.stop();
    const answers = questions.filter((item) => valuesRef.current[item.id]).map((item) => toAnswerInput(item, valuesRef.current[item.id]!));
    try {
      await submitAttempt(viewer, assessment.courseId, assessment.id, attempt.id, answers);
    } catch (failure) {
      submitting.current = false;
      autosaver.resume();
      toast.show({ title: "Could not submit the assessment", description: failureMessage(failure), tone: "danger" });
      return;
    }
    queryClient.removeQueries({ queryKey: studentKeys.attempt(viewer.id, assessment.id) });
    await refresh();
    navigate(studentPaths.result(assessment.id), { replace: true });
  };
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    finishRef.current = finish;
  });

  const [seconds0] = useState(() => questionSeconds(questions.map((item) => item.timeLimitSeconds)));
  const { index, seconds, goToQuestion } = useQuizSession(seconds0, () => void finishRef.current());
  const question = questions[index];
  const unanswered = questions.flatMap((item, at) => (isAnswered(item, values[item.id]) ? [] : [at + 1]));
  const answered = questions.length - unanswered.length;
  const isLast = index === questions.length - 1;
  const section = question?.sectionId ? sections.get(question.sectionId) : undefined;
  const sectionTitle = section?.title?.trim();
  const sectionDirections = section?.directions?.trim();

  // Typed answers save when the question changes: Previous, Next, the list, or a timer.
  useEffect(() => {
    void autosaver.flush();
  }, [autosaver, index]);

  // The attempt's deadline (time limit or due date): submit what was given.
  useEffect(() => {
    if (!attempt.deadline) return;
    const wait = Date.parse(attempt.deadline) - Date.now();
    if (Number.isNaN(wait) || wait > MAX_TIMEOUT_MS) return;
    const id = window.setTimeout(() => void finishRef.current(), Math.max(wait, 0));
    return () => window.clearTimeout(id);
  }, [attempt.deadline]);

  useEffect(() => {
    const message = timerAnnouncement(seconds);
    // oxlint-disable-next-line react/set-state-in-effect -- mirrors the clock into a live region at milestones only
    if (message) setAnnouncement(message);
  }, [seconds]);

  // The latest change function, so the keyboard listener never uses stale answers.
  const changeRef = useRef(change);
  useLayoutEffect(() => {
    changeRef.current = change;
  });

  // Keyboard shortcuts: 1–9 pick a choice (plan §7). Ignored while typing, in a list, or in the dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirming || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest("input, textarea, select")) return;
      if (!question || !takesShortcuts(question)) return;
      const option = question.options[Number.parseInt(event.key, 10) - 1];
      if (option) changeRef.current(question, { ...valuesRef.current[question.id], optionId: option.id }, "choice");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, question]);

  if (!question) return <Navigate to={studentPaths.assessment(assessment.id)} replace />;

  const PromptHeading = sectionTitle ? "h3" : "h2";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink label="Exit assessment" onBack={() => navigate(studentPaths.assessment(assessment.id))} />
        <SaveStatusNote status={status} announcement={saveAnnouncement} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-semibold text-ink outline-none sm:text-page">{assessment.title}</h1>
            <p className="m-0 text-body text-muted">{assessment.type} · {course?.name} · {course?.section} · {assessment.points} points</p>
            {spellingMode && usesSpelling(questions) && (
              <p className="m-0 flex items-center gap-2 text-body text-ink"><SpellCheck aria-hidden className="size-4 shrink-0 text-muted" />{SPELLING_RULES[spellingMode]}.</p>
            )}
          </header>
          <p aria-live="polite" className="sr-only">{announcement}</p>

          {/* Timer and progress stick under the top bar for the whole question column,
              so the countdown stays visible while scrolling long questions on phones. */}
          <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-1 flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3 font-sans">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-body">Question <strong className="font-semibold">{pad2(index + 1)}</strong> of {pad2(questions.length)} <span className="text-muted">· {answered} answered</span></span>
              <span className={cn("flex items-center gap-2 rounded-control px-2.5 py-1", seconds <= 15 ? "bg-danger-soft text-danger" : "bg-canvas text-ink")}>
                <Clock3 aria-hidden className="size-4" />
                <span className="sr-only">Time left for this question:</span>
                <strong className="text-body-lg font-semibold tabular-nums">{formatCountdown(seconds)}</strong>
              </span>
            </div>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary-600 transition-[width] motion-reduce:transition-none" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
            </div>
          </div>

          {(sectionTitle || sectionDirections) && (
            <div className="flex flex-col gap-1">
              {sectionTitle && <h2 className="m-0 font-sans text-section font-semibold text-ink">{sectionTitle}</h2>}
              {sectionDirections && <p className="m-0 max-w-prose text-body-lg whitespace-pre-line text-ink">{sectionDirections}</p>}
            </div>
          )}

          <section aria-labelledby="question-prompt" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
            <p className="m-0 flex justify-between gap-3 text-body text-muted"><span className="font-semibold">Question {pad2(index + 1)}</span><span>{question.points} {question.points === 1 ? "point" : "points"}</span></p>
            <PromptHeading id="question-prompt" className="m-0 font-sans text-section font-semibold break-words whitespace-pre-line text-ink"><QuestionPrompt question={question} /></PromptHeading>
            {/* Keyed by question so focus and local state never leak from one question to the next. */}
            <QuestionAnswer key={question.id} question={question} number={index + 1} value={values[question.id] ?? {}} shortcuts onChange={(value, how) => change(question, value, how)} />
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
                const done = isAnswered(item, values[item.id]);
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
        >
          {unanswered.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-body text-ink">Not answered: {unanswered.length === 1 ? "question" : "questions"} {listNumbers(unanswered)}.</p>
              <ul aria-label="Unanswered questions" className="m-0 flex list-none flex-wrap gap-2 p-0">
                {unanswered.map((number) => (
                  <li key={number}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setConfirming(false);
                        goToQuestion(number - 1);
                      }}
                    >
                      Open question {number}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
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
