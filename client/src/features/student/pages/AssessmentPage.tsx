import { AlarmClock, ArrowRight, CalendarDays, Check, ClipboardCheck, Clock3, Eye, FileText, ListChecks, Lock, ShieldCheck, SpellCheck } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { ANSWER_REVIEW_NOTES, SPELLING_RULES } from "../../../shared/components/quiz/answers";
import { formatDue } from "../../../shared/lib/format";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import type { ActivitySubmission, Assessment, ExamGrade } from "../api/types";
import { BackLink } from "../../../shared/components/BackLink";
import { toneFor } from "../../../shared/lib/tones";
import { AssessmentTypeIcon } from "../components/visuals";
import { workIsHandedIn } from "../api/work";
import { AssignmentWork } from "../components/work/AssignmentWork";
import { useMyWork } from "../hooks/useMyWork";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

/** Instructor grade for an exam. New in the rebuilt UI (D-015): the classic UI had no way back to it. */
function ExamGradeNote({ grade, points }: { grade: ExamGrade; points: number }) {
  return (
    <section aria-labelledby="exam-grade" className="flex flex-col gap-1 rounded-card border border-success/30 bg-success-soft p-4">
      <h2 id="exam-grade" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold text-success"><Check aria-hidden className="size-4" />Your grade</h2>
      <p className="m-0 text-body-lg font-semibold text-ink">{grade.notHandedIn && "Not handed in · "}{grade.totalScore} / {points} points</p>
      {grade.feedback && <p className="m-0 text-body text-ink">{grade.feedback}</p>}
    </section>
  );
}

function ActivityStatus({ submission, points, excused }: { submission: ActivitySubmission; points: number; excused: boolean }) {
  // Excused work is not graded for the student's average, so it is not "waiting for review" (D-062).
  const result = submission.grade !== null ? `${submission.grade} / ${points} points` : excused ? "Excused" : "Waiting for instructor review";
  return (
    <p role="status" className="m-0 flex flex-wrap items-center gap-2 rounded-card border border-line bg-canvas p-3 text-body">
      <Check aria-hidden className="size-4 text-success" />
      <span>
        {submission.notHandedIn ? "Not handed in" : "Submitted"} · {result}
        {submission.feedback && <> · {submission.feedback}</>}
      </span>
    </p>
  );
}

/** "Written answer, files" for the details card. */
const KIND_WORDS = { text: "Written answer", file: "Files", link: "Link" } as const;
const handInWords = (assessment: Assessment) => (assessment.handIn?.submissionKinds ?? ["text", "file"]).map((kind) => KIND_WORDS[kind]).join(", ");

export default function AssessmentPage() {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const { catalog, completed } = useWorkspace();
  const assessment = catalog.assessments.find((item) => item.id === assessmentId);
  // The same rows as the work card (one cached query), so the header and the brief agree on "handed in".
  const assignment = assessment?.kind === "activity" && assessment.handIn ? assessment : undefined;
  const work = useMyWork(assignment?.courseId ?? "", assessmentId, Boolean(assignment));
  if (!assessment) return <Navigate to={studentPaths.tasks()} replace />;

  const courseIndex = catalog.courses.findIndex((item) => item.id === assessment.courseId);
  const course = catalog.courses[courseIndex];
  const isActivity = assessment.kind === "activity";
  const isCompleted = completed.includes(assessment.id);
  const submission = catalog.activitySubmissions[assessment.id];
  const grade = catalog.examGrades[assessment.id];
  const attempts = catalog.attempts[assessment.id];
  const attemptsLeft = (assessment.maxAttempts ?? 1) - (attempts?.used ?? 0);
  // Closed by the instructor (D-036), or graded without anything handed in: nothing more can be handed in.
  const isClosed = Boolean(assessment.closed);
  const notHandedIn = Boolean(submission?.notHandedIn || grade?.notHandedIn);
  const canStart = !isClosed && !notHandedIn && (Boolean(attempts?.openId) || attemptsLeft > 0);
  const toClasswork = () => navigate(course ? studentPaths.classPage(course.id, "Classwork") : studentPaths.tasks());

  // Handed in: the instructions step aside until a new version is started (D-073).
  const handedIn = Boolean(assignment) && workIsHandedIn(work.data, assessment.turnIn);
  // Without a description of its own, the header repeats the instructions (catalog), so it steps aside with them.
  const description = handedIn && assessment.description === assessment.instructions ? "" : assessment.description;
  const excused = Boolean(assessment.excused);
  // The student's own due date when the instructor gave them more time (contract §11).
  const ownDueDate = Boolean(assessment.turnIn?.extended);
  const facts: Array<[string, string, typeof ListChecks]> = [
    [isActivity ? "Hand in" : "Questions", isActivity ? handInWords(assessment) : String(assessment.questionCount ?? 0), ListChecks],
    ["Time limit", isActivity ? "—" : assessment.timeLimit, Clock3],
    ["Points", `${assessment.points} pts`, ClipboardCheck],
    [ownDueDate ? "Your due date" : "Due date", formatDue(assessment.dueAt), CalendarDays],
  ];
  const status = isClosed ? "Closed" : notHandedIn ? "Not handed in" : excused ? "Excused" : isCompleted ? "Submitted" : "Open";

  const closedNote = isClosed && (
    <p role="status" className="m-0 flex items-center gap-2 rounded-card border border-line bg-canvas p-3 text-body">
      <Lock aria-hidden className="size-4 text-muted" />Closed. Your instructor is no longer accepting work for this {isActivity ? "assignment" : "assessment"}.
    </p>
  );

  return (
    <>
      <BackLink label="Back to classwork" onBack={toClasswork} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="flex flex-col gap-5">
          <header className="flex flex-col gap-2">
            <p className="m-0 flex flex-wrap items-center gap-2 text-body text-muted">
              <span aria-hidden className={`grid size-8 place-items-center rounded-control ${toneFor(courseIndex)}`}><AssessmentTypeIcon type={assessment.type} className="size-4" /></span>
              {course && <button type="button" onClick={toClasswork} className="min-h-touch rounded-control border-0 bg-transparent px-1 font-sans text-body font-medium text-primary-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-focus">{course.name}</button>}
              <span aria-hidden>›</span>
              {assessment.type}
            </p>
            <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-semibold text-ink outline-none sm:text-page">{assessment.title}</h1>
            {description && <p className="m-0 text-body-lg text-muted">{description}</p>}
            {course && <p className="m-0 text-body text-muted">{course.teacher} · {course.section}</p>}
          </header>

          {grade && !isActivity && <ExamGradeNote grade={grade} points={assessment.points} />}
          {submission && <ActivityStatus submission={submission} points={assessment.points} excused={excused} />}
          {isCompleted && !isActivity && !grade && (
            <p className="m-0 flex items-center gap-2 rounded-card border border-line bg-canvas p-3 text-body">
              <Check aria-hidden className="size-4 text-success" />You have submitted this assessment. You can view your result or practice again.
            </p>
          )}

          {isActivity && assessment.handIn ? (
            <AssignmentWork classId={assessment.courseId} assessmentId={assessment.id} instructions={assessment.instructions} settings={assessment.handIn} turnIn={assessment.turnIn} rubricId={assessment.rubricId} handedIn={handedIn}>
              {closedNote}
            </AssignmentWork>
          ) : (
            <>
            <Card className="flex flex-col gap-2 p-5">
              <h2 className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><FileText aria-hidden className="size-4 text-primary-700" />Instructions</h2>
              <p className="m-0 text-body whitespace-pre-line">{assessment.instructions}</p>
              <p className="m-0 text-body text-muted">Answer every question. You may revisit questions before submitting.</p>
              {assessment.spellingMode && (
                <p className="m-0 flex items-center gap-2 text-body text-ink"><SpellCheck aria-hidden className="size-4 shrink-0 text-muted" />{SPELLING_RULES[assessment.spellingMode]}.</p>
              )}
              {assessment.answerReview && (
                <p className="m-0 flex items-center gap-2 text-body text-ink"><Eye aria-hidden className="size-4 shrink-0 text-muted" />{ANSWER_REVIEW_NOTES[assessment.answerReview]}</p>
              )}
            </Card>
            {!isActivity && (
              <p className="m-0 flex items-start gap-3 rounded-card bg-accent-100 p-4 text-body text-ink">
                <AlarmClock aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-700" />
                <span><strong className="font-semibold">Each question has its own timer,</strong> one minute unless your instructor set another. Time pauses while you review other questions.</span>
              </p>
            )}
            {closedNote}
            </>
          )}
        </article>

        <aside aria-labelledby="assessment-details" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 id="assessment-details" className="m-0 font-sans text-card-title font-semibold text-ink">Assessment details</h2>
              <Badge tone={isClosed || excused ? "neutral" : isCompleted && !notHandedIn ? "success" : "brand"}>{status}</Badge>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3">
              {facts.map(([label, value, Icon]) => (
                <div key={label} className="flex flex-col gap-1 rounded-control bg-canvas p-3">
                  <dt className="flex items-center gap-1.5 text-body text-muted"><Icon aria-hidden className="size-4" />{label}</dt>
                  <dd className="m-0 text-body font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-body"><span className="text-muted">Your progress</span><strong className="font-semibold">{notHandedIn ? "Not handed in" : excused ? "Excused" : isCompleted ? "Submitted" : "Not started"}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-primary-600" style={{ width: isCompleted && !notHandedIn ? "100%" : "0%" }} /></div>
            </div>
            {!isActivity && (
              <div className="flex flex-col gap-2">
                {canStart ? (
                  <Button size="lg" block onClick={() => navigate(studentPaths.quiz(assessment.id))}>{attempts?.openId ? "Continue assessment" : isCompleted ? "Practice again" : "Start assessment"}<ArrowRight aria-hidden className="size-4" /></Button>
                ) : (
                  <p className="m-0 text-body text-muted">
                    {isClosed ? "This assessment is closed." : notHandedIn ? "Your instructor recorded a grade without an attempt." : "You have used every attempt for this assessment."}
                  </p>
                )}
                {isCompleted && attempts?.latestId !== undefined && <Button variant="secondary" block onClick={() => navigate(studentPaths.result(assessment.id))}>View your result</Button>}
              </div>
            )}
            <p className="m-0 flex items-center gap-2 text-body text-muted"><ShieldCheck aria-hidden className="size-4" />Your answers save to your class as you go.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
