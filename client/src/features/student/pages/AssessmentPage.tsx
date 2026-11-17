import { AlarmClock, ArrowRight, CalendarDays, Check, ClipboardCheck, Clock3, FileText, ListChecks, Lock, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { formatDue } from "../../../shared/lib/format";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Field, Input, Textarea } from "../../../shared/ui/Field";
import { useToast } from "../../../shared/ui/toast/useToast";
import { failureMessage, submitAssignment } from "../api/student";
import { useRefreshStudent, useStudentViewer } from "../hooks/useStudentCatalog";
import type { ActivitySubmission, Assessment, ExamGrade } from "../api/types";
import { BackLink } from "../../../shared/components/BackLink";
import { toneFor } from "../../../shared/lib/tones";
import { AssessmentTypeIcon } from "../components/visuals";
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

function ActivityStatus({ submission, points }: { submission: ActivitySubmission; points: number }) {
  return (
    <p role="status" className="m-0 flex flex-wrap items-center gap-2 rounded-card border border-line bg-canvas p-3 text-body">
      <Check aria-hidden className="size-4 text-success" />
      <span>
        {submission.notHandedIn ? "Not handed in" : "Submitted"} · {submission.grade === null ? "Waiting for instructor review" : `${submission.grade} / ${points} points`}
        {submission.feedback && <> · {submission.feedback}</>}
      </span>
    </p>
  );
}

function TurnInForm({ assessment, submitted, closed }: { assessment: Assessment; submitted: boolean; closed: boolean }) {
  const toast = useToast();
  const [fileName, setFileName] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const viewer = useStudentViewer();
  const refresh = useRefreshStudent();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!fileName.trim()) {
      setError("Enter the filename of the work you are turning in.");
      return;
    }
    setSaving(true);
    try {
      await submitAssignment(viewer, assessment.courseId, assessment.id, { fileName, comment });
      await refresh();
    } catch (failure) {
      toast.show({ title: "Could not hand in your work", description: failureMessage(failure), tone: "danger" });
      return;
    } finally {
      setSaving(false);
    }
    setFileName("");
    setComment("");
    setError("");
    toast.show({ title: submitted ? "New version submitted" : "Work submitted", description: assessment.title, tone: "success" });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-sans text-section font-semibold">{submitted ? "Submit a new version" : "Turn in your work"}</h2>
        <p className="m-0 text-body text-muted">
          {closed ? "The due date has passed and late submissions are turned off." : "Use the filename of the document you prepared for this class. Only the filename is saved for now."}
        </p>
      </div>
      <Field label="Attachment filename" required error={error || undefined}>
        <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="research-notes.pdf" disabled={closed} autoComplete="off" />
      </Field>
      <Field label="Comment for instructor">
        <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Add a note about your work" disabled={closed} />
      </Field>
      <Button type="submit" disabled={closed || saving} className="self-start">{submitted ? "Resubmit work" : "Submit work"}<ArrowRight aria-hidden className="size-4" /></Button>
    </form>
  );
}

export default function AssessmentPage() {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const { catalog, completed, now } = useWorkspace();
  const assessment = catalog.assessments.find((item) => item.id === assessmentId);
  if (!assessment) return <Navigate to={studentPaths.tasks()} replace />;

  const courseIndex = catalog.courses.findIndex((item) => item.id === assessment.courseId);
  const course = catalog.courses[courseIndex];
  const isActivity = assessment.kind === "activity";
  const isCompleted = completed.includes(assessment.id);
  const submission = catalog.activitySubmissions[assessment.id];
  const grade = catalog.examGrades[assessment.id];
  const attempts = catalog.attempts[assessment.id];
  const attemptsLeft = (assessment.maxAttempts ?? 1) - (attempts?.used ?? 0);
  const pastDue = isActivity && Boolean(assessment.dueAt) && new Date(assessment.dueAt).getTime() < now && !assessment.allowLate;
  // Closed by the instructor (D-036), or graded without anything handed in: nothing more can be handed in.
  const isClosed = Boolean(assessment.closed);
  const notHandedIn = Boolean(submission?.notHandedIn || grade?.notHandedIn);
  const canStart = !isClosed && !notHandedIn && (Boolean(attempts?.openId) || attemptsLeft > 0);
  const toClasswork = () => navigate(course ? studentPaths.classPage(course.id, "Classwork") : studentPaths.tasks());

  const facts: Array<[string, string, typeof ListChecks]> = [
    [isActivity ? "Submission" : "Questions", isActivity ? "File + comment" : String(assessment.questionCount ?? 0), ListChecks],
    ["Time limit", isActivity ? "—" : assessment.timeLimit, Clock3],
    ["Points", `${assessment.points} pts`, ClipboardCheck],
    ["Due date", formatDue(assessment.dueAt), CalendarDays],
  ];

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
            {assessment.description && <p className="m-0 text-body-lg text-muted">{assessment.description}</p>}
            {course && <p className="m-0 text-body text-muted">{course.teacher} · {course.section}</p>}
          </header>

          {grade && !isActivity && <ExamGradeNote grade={grade} points={assessment.points} />}
          {submission && <ActivityStatus submission={submission} points={assessment.points} />}
          {isCompleted && !isActivity && !grade && (
            <p className="m-0 flex items-center gap-2 rounded-card border border-line bg-canvas p-3 text-body">
              <Check aria-hidden className="size-4 text-success" />You have submitted this assessment. You can view your result or practice again.
            </p>
          )}

          <Card className="flex flex-col gap-2 p-5">
            <h2 className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><FileText aria-hidden className="size-4 text-primary-700" />Instructions</h2>
            <p className="m-0 text-body whitespace-pre-line">{assessment.instructions}</p>
            <p className="m-0 text-body text-muted">
              {isActivity ? "Attach the filename for your work and leave a note for your instructor." : "Choose the best answer for every question. You may revisit questions before submitting."}
            </p>
          </Card>

          {!isActivity && (
            <p className="m-0 flex items-start gap-3 rounded-card bg-accent-100 p-4 text-body text-ink">
              <AlarmClock aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-700" />
              <span><strong className="font-semibold">One minute per question.</strong> Your timer is individual to each question. Time pauses while you review other questions.</span>
            </p>
          )}

          {isClosed && (
            <p role="status" className="m-0 flex items-center gap-2 rounded-card border border-line bg-canvas p-3 text-body">
              <Lock aria-hidden className="size-4 text-muted" />Closed. Your instructor is no longer accepting work for this {isActivity ? "assignment" : "assessment"}.
            </p>
          )}
          {isActivity && !isClosed && !notHandedIn && (!isCompleted || assessment.allowResubmission) && <TurnInForm assessment={assessment} submitted={Boolean(submission)} closed={pastDue} />}
        </article>

        <aside aria-labelledby="assessment-details" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 id="assessment-details" className="m-0 text-label font-semibold tracking-wide text-muted uppercase">Assessment details</h2>
              <Badge tone={isClosed ? "neutral" : isCompleted && !notHandedIn ? "success" : "brand"}>{isClosed ? "Closed" : notHandedIn ? "Not handed in" : isCompleted ? "Submitted" : "Open"}</Badge>
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
              <div className="flex justify-between text-body"><span className="text-muted">Your progress</span><strong className="font-semibold">{notHandedIn ? "Not handed in" : isCompleted ? "Submitted" : "Not started"}</strong></div>
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
