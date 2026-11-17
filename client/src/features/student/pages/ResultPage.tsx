import { ArrowRight, Check, ClipboardCheck, ShieldCheck, X } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { cn } from "../../../shared/lib/cn";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { fetchAttempt, studentKeys, studentQueryOptions } from "../api/student";
import { useStudentCatalog, useStudentViewer } from "../hooks/useStudentCatalog";
import { studentPaths } from "../paths";

export default function ResultPage() {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const catalog = useStudentCatalog();
  const viewer = useStudentViewer();
  const assessment = catalog.assessments.find((item) => item.id === assessmentId);
  const attemptId = catalog.attempts[assessmentId]?.latestId;
  const result = useQuery({
    queryKey: studentKeys.result(viewer.id, attemptId ?? 0),
    queryFn: ({ signal }) => fetchAttempt(viewer, assessment!.courseId, assessmentId, attemptId!, signal),
    ...studentQueryOptions,
    enabled: Boolean(assessment && attemptId),
  });
  if (!assessment || !attemptId) return <Navigate to={assessment ? studentPaths.assessment(assessment.id) : studentPaths.tasks()} replace />;
  if (!result.data) {
    return <SkeletonGroup label="Loading your result" className="mx-auto flex w-full max-w-3xl flex-col gap-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></SkeletonGroup>;
  }

  const attempt = result.data;
  const questions = attempt.questions;
  const pointsOf = (questionId: number) => attempt.answers.find((answer) => answer.questionId === questionId)?.pointsAwarded ?? 0;
  const isRight = (item: { id: number; points: number }) => pointsOf(item.id) >= item.points;
  const score = questions.filter(isRight).length;
  const earned = attempt.score ?? questions.reduce((sum, item) => sum + pointsOf(item.id), 0);
  const percent = attempt.maxPoints > 0 ? Math.round((earned / attempt.maxPoints) * 100) : 0;
  const course = catalog.courses.find((item) => item.id === assessment.courseId);
  const grade = attempt.feedback ? { totalScore: attempt.score ?? earned, feedback: attempt.feedback } : undefined;
  const toClasswork = () => navigate(course ? studentPaths.classPage(course.id, "Classwork") : studentPaths.tasks());

  return (
    <>
      <Card className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-5 sm:p-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-success-soft text-success"><ClipboardCheck className="size-7" /></span>
          <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-semibold outline-none sm:text-page">You did it, {catalog.me.firstName}!</h1>
          <p className="m-0 text-body-lg text-muted">Your {assessment.type.toLowerCase()} for {course?.name ?? "your class"} has been submitted.</p>
          <Badge tone="success">Assessment submitted</Badge>
        </header>

        <div className="flex flex-col items-center gap-4 rounded-card bg-primary-50 p-5 sm:flex-row">
          <p className="m-0 flex flex-col items-center">
            <strong className="text-display font-semibold text-primary-700">{percent}%</strong>
            <span className="text-body text-muted">score</span>
          </p>
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p className="m-0 text-section font-semibold">{score} / {questions.length} correct</p>
            <p className="m-0 text-body">
              {percent >= 80 ? "Excellent work. You’ve got a strong grasp of this topic." : percent >= 50 ? "Nice work. Review the questions below to keep building your understanding." : "Keep practicing. Revisit the class materials and try again."}
            </p>
          </div>
        </div>

        {grade && (
          <section aria-labelledby="instructor-feedback" className="flex flex-col gap-1 rounded-card border border-success/30 bg-success-soft p-4">
            <h2 id="instructor-feedback" className="m-0 text-card-title font-semibold text-success">Instructor feedback</h2>
            <p className="m-0 text-body-lg font-semibold">{grade.totalScore} / {assessment.points} points</p>
            {grade.feedback && <p className="m-0 text-body">{grade.feedback}</p>}
          </section>
        )}

        <section aria-labelledby="answer-review" className="flex flex-col gap-2">
          <h2 id="answer-review" className="m-0 font-sans text-section font-semibold">Answer review <span className="font-normal text-muted">· {questions.length} questions</span></h2>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {questions.map((item, index) => {
              const correct = isRight(item);
              return (
                <li key={item.id} className="flex items-start gap-3 rounded-control border border-line p-3">
                  <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full", correct ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {correct ? <Check className="size-4" /> : <X className="size-4" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="text-body font-semibold">Question {index + 1}</strong>
                    <span className="text-body text-muted">{item.prompt}</span>
                  </span>
                  <span className={cn("text-body font-semibold", correct ? "text-success" : "text-danger")}>{correct ? "Correct" : "Review"}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={toClasswork}>Back to classwork</Button>
          <Button onClick={() => navigate(studentPaths.quiz(assessment.id))}>Practice again<ArrowRight aria-hidden className="size-4" /></Button>
        </div>
      </Card>
      <p className="m-0 flex items-center justify-center gap-2 text-body text-muted"><ShieldCheck aria-hidden className="size-4" />Your result is saved with your class record.</p>
    </>
  );
}
