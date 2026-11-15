import { ArrowRight, Check, ClipboardCheck, ShieldCheck, X } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { cn } from "../../../shared/lib/cn";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { STUDENT } from "../api/catalog";
import { scoreAttempt } from "../api/selectors";
import { useProgress } from "../hooks/useProgress";
import { useStudentCatalog } from "../hooks/useStudentCatalog";
import { studentPaths } from "../paths";

export default function ResultPage() {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const catalog = useStudentCatalog();
  const progress = useProgress();
  const assessment = catalog.assessments.find((item) => item.id === assessmentId);
  const questions = assessment ? catalog.questions[assessment.id] ?? [] : [];
  if (!assessment || !questions.length) return <Navigate to={studentPaths.tasks()} replace />;

  const course = catalog.courses.find((item) => item.id === assessment.courseId);
  const answers = progress.answers[assessment.id] ?? {};
  const score = scoreAttempt(questions, answers);
  const percent = Math.round((score / questions.length) * 100);
  const grade = catalog.examGrades[assessment.id];
  const toClasswork = () => navigate(course ? studentPaths.classPage(course.id, "Classwork") : studentPaths.tasks());

  return (
    <>
      <Card className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-5 sm:p-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-success-soft text-success"><ClipboardCheck className="size-7" /></span>
          <p className="m-0 text-label font-semibold tracking-wide text-success uppercase">Assessment submitted</p>
          <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-bold outline-none sm:text-page">You did it, {STUDENT.firstName}!</h1>
          <p className="m-0 text-body-lg text-muted">Your {assessment.type.toLowerCase()} for {course?.name ?? "your class"} has been submitted.</p>
        </header>

        <div className="flex flex-col items-center gap-4 rounded-card bg-primary-50 p-5 sm:flex-row">
          <p className="m-0 flex flex-col items-center">
            <strong className="text-display font-bold text-primary-700">{percent}%</strong>
            <span className="text-body text-muted">score</span>
          </p>
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p className="m-0 text-label font-semibold tracking-wide text-muted uppercase">Your result</p>
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
              const correct = answers[index] === item.correct;
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
      <p className="m-0 flex items-center justify-center gap-2 text-body text-muted"><ShieldCheck aria-hidden className="size-4" />Your result is saved in this browser for the demo.</p>
    </>
  );
}
