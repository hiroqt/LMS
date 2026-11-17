import { useQuery } from "@tanstack/react-query";
import { Eye, SpellCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { describeApiError, getJson, isApiError, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { BackLink } from "../../../shared/components/BackLink";
import { pointsOf, SPELLING_RULES, toAnswerInput, usesSpelling } from "../../../shared/components/quiz/answers";
import { QuestionAnswer } from "../../../shared/components/quiz/QuestionAnswer";
import { QuestionPrompt } from "../../../shared/components/quiz/QuestionPrompt";
import { QuestionResult } from "../../../shared/components/quiz/QuestionResult";
import type { AnswerInput, AnswerKey, AnswerValue, MatchNote, QuizQuestion, QuizSection, SpellingMode } from "../../../shared/components/quiz/types";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";

/** `GET …/preview`: an attempt built from the questions, with nothing saved and no keys (contract §6). */
interface PreviewAttempt {
  maxPoints: number;
  spellingMode?: SpellingMode;
  sections?: QuizSection[];
  questions: QuizQuestion[];
}

/** `POST …/preview/score`: scores the answers without saving anything (contract §6). */
interface PreviewScore {
  score: number;
  maxPoints: number;
  answers: Array<{ questionId: number; pointsAwarded: number | null; matchNote: MatchNote | null }>;
  keys: Array<{ questionId: number; key: AnswerKey }>;
}

const workPath = (classId: string, id: string) => `/api/classes/${encodeURIComponent(classId)}/coursework/${encodeURIComponent(id)}`;
/** The assessment builder (built in its own stream). */
const builderPath = (classId: string, id: string) => `/instructor/classes/${encodeURIComponent(classId)}/assessments/${encodeURIComponent(id)}/edit`;

/** Preview as student: the student's inputs for every question, with "Check answers" and nothing saved (D-040). */
export default function AssessmentPreviewPage() {
  const { classId = "", id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { instructorId } = useInstructorSession();
  const { store } = useInstructorWorkspace();
  const viewer = useMemo<Viewer>(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
  const exam = store.exams.find((item) => item.id === id);
  const preview = useQuery({
    queryKey: ["instructor", "preview", instructorId, classId, id],
    queryFn: ({ signal }) => getJson<PreviewAttempt>(`${workPath(classId, id)}/preview`, { identity: true, viewer, signal }),
    retry: shouldRetryApiRead,
    networkMode: "always",
    gcTime: 0,
    enabled: Boolean(instructorId && classId && id),
  });
  const [values, setValues] = useState<Record<number, AnswerValue>>({});
  const [result, setResult] = useState<PreviewScore | null>(null);
  const [checking, setChecking] = useState(false);
  const score = useRef<HTMLParagraphElement>(null);

  const title = exam?.title ?? "Preview as student";
  const back = <BackLink label="Back to the assessment builder" onBack={() => navigate(builderPath(classId, id))} />;
  const note = (
    <p role="note" className="m-0 flex items-center gap-2">
      <Eye aria-hidden className="size-4 shrink-0 text-info" />
      <span><strong className="font-semibold">Preview: nothing is saved.</strong> This is what students see. Answers you give here are never recorded.</span>
    </p>
  );

  if (preview.isPending) {
    return (
      <>
        {back}
        <PageHeader title={title} />
        <SkeletonGroup label="Loading the preview" className="flex flex-col gap-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></SkeletonGroup>
      </>
    );
  }
  if (preview.isError) {
    const notFound = isApiError(preview.error) && preview.error.status === 404;
    const { title: problem, detail } = describeApiError(preview.error);
    return (
      <>
        {back}
        <PageHeader title={title} />
        <EmptyState
          title={notFound ? "This assessment was not found" : problem}
          description={notFound ? "It may have been deleted, or it belongs to another class." : detail}
          action={<Button variant="secondary" onClick={() => void preview.refetch()}>Try again</Button>}
        />
      </>
    );
  }

  const { questions } = preview.data;
  const sections = new Map((preview.data.sections ?? []).map((section) => [section.id, section]));
  // Consecutive questions of one section, so each section's title and directions sit above its questions.
  const groups: Array<{ start: number; section: QuizSection | undefined; questions: QuizQuestion[] }> = [];
  questions.forEach((question, index) => {
    const last = groups.at(-1);
    if (last && last.questions[0]?.sectionId === question.sectionId) last.questions.push(question);
    else groups.push({ start: index, section: question.sectionId ? sections.get(question.sectionId) : undefined, questions: [question] });
  });
  const scored = new Map(result?.answers.map((answer) => [answer.questionId, answer]));
  const keys = new Map(result?.keys.map((entry) => [entry.questionId, entry.key]));
  const spellingMode = preview.data.spellingMode;
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);

  const change = (question: QuizQuestion, value: AnswerValue) => {
    setValues((current) => ({ ...current, [question.id]: value }));
    // A changed answer makes the last check out of date.
    setResult(null);
  };

  const check = async () => {
    const answers: AnswerInput[] = questions.map((question) => toAnswerInput(question, values[question.id] ?? {}));
    setChecking(true);
    try {
      setResult(await sendJson<PreviewScore>("POST", `${workPath(classId, id)}/preview/score`, { answers }, { viewer }));
      // Every question grows a result, so start the review from the top, where the score is, as
      // the student's result page does. Left in place, scroll anchoring could park a control half
      // under the sticky top bar (axe target-size).
      window.scrollTo({ top: 0 });
      score.current?.focus({ preventScroll: true });
    } catch (failure) {
      toast.show({ title: "Could not check the answers", description: describeApiError(failure).detail, tone: "danger" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      {back}
      <PageHeader
        title={title}
        description={`Preview as student · ${questions.length} ${questions.length === 1 ? "question" : "questions"} · ${totalPoints} ${totalPoints === 1 ? "point" : "points"}`}
      />
      <div className="flex flex-col rounded-card border border-line bg-info-soft p-3 text-body text-ink">
        {note}
        {/* Empty until the answers are checked; a margin only, so the live region is never hidden. */}
        <p ref={score} role="status" tabIndex={-1} className="m-0 mt-2 text-body-lg font-semibold outline-none empty:mt-0">
          {result ? `Score: ${pointsOf(result.score, result.maxPoints)}` : ""}
        </p>
      </div>
      {spellingMode && usesSpelling(questions) && (
        <p className="m-0 flex items-center gap-2 text-body text-ink"><SpellCheck aria-hidden className="size-4 shrink-0 text-muted" />{SPELLING_RULES[spellingMode]}.</p>
      )}

      {groups.map((group) => {
        const sectionTitle = group.section?.title?.trim();
        const directions = group.section?.directions?.trim();
        const Heading = sectionTitle ? "h3" : "h2";
        return (
          <div key={group.start} className="flex flex-col gap-3">
            {sectionTitle && <h2 className="m-0 font-sans text-section font-semibold text-ink">{sectionTitle}</h2>}
            {directions && <p className="m-0 max-w-prose text-body-lg whitespace-pre-line text-ink">{directions}</p>}
            <ol start={group.start + 1} className="m-0 flex list-none flex-col gap-4 p-0">
              {group.questions.map((question, offset) => {
                const number = group.start + offset + 1;
                const outcome = scored.get(question.id);
                return (
                  <li key={question.id}>
                    <section aria-labelledby={`preview-q-${question.id}`} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
                      <p className="m-0 flex justify-between gap-3 text-body text-muted">
                        <span className="font-semibold">Question {number}</span>
                        <span>{question.points} {question.points === 1 ? "point" : "points"}</span>
                      </p>
                      <Heading id={`preview-q-${question.id}`} className="m-0 font-sans text-card-title font-semibold break-words whitespace-pre-line text-ink">
                        <QuestionPrompt question={question} />
                      </Heading>
                      <QuestionAnswer question={question} number={number} value={values[question.id] ?? {}} onChange={(value) => change(question, value)} />
                      {result && (
                        <div className="rounded-control border border-line bg-canvas p-3">
                          <QuestionResult question={{ ...question, key: keys.get(question.id) ?? null }} value={values[question.id] ?? {}} pointsAwarded={outcome?.pointsAwarded ?? null} matchNote={outcome?.matchNote} showGiven={false} />
                        </div>
                      )}
                    </section>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}

      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!Object.keys(values).length && !result}
            onClick={() => {
              setValues({});
              setResult(null);
            }}
          >
            Clear answers
          </Button>
          <Button loading={checking} loadingLabel="Checking…" onClick={() => void check()}>Check answers</Button>
        </div>
      </div>
    </>
  );
}
