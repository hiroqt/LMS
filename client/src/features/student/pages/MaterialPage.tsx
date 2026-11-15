import { BookOpen, Check, Clock3, FileText } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { pad2 } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { BackLink } from "../../../shared/components/BackLink";
import { toneFor } from "../../../shared/lib/tones";
import { useStudentCatalog } from "../hooks/useStudentCatalog";
import { useStudentSession } from "../hooks/useStudentSession";
import { studentPaths } from "../paths";

export default function MaterialPage() {
  const { materialId = "" } = useParams();
  const navigate = useNavigate();
  const catalog = useStudentCatalog();
  const { reviewed, toggleReviewed } = useStudentSession();
  const material = catalog.materials.find((item) => item.id === materialId);
  if (!material) return <Navigate to={studentPaths.classes} replace />;

  const courseIndex = catalog.courses.findIndex((item) => item.id === material.courseId);
  const course = catalog.courses[courseIndex];
  const isReviewed = reviewed.has(material.id);

  return (
    <>
      <BackLink label={`Back to ${course?.name ?? "class"}`} onBack={() => navigate(course ? studentPaths.classPage(course.id, "Materials") : studentPaths.classes)} />
      <Card className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden">
        <header className={`flex items-start gap-4 p-5 sm:p-7 ${toneFor(courseIndex)}`}>
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-control bg-surface/70"><FileText className="size-6" /></span>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-label font-semibold tracking-wide uppercase">{course?.name} · {material.kind}</p>
            <h1 tabIndex={-1} className="m-0 font-sans text-page-mobile font-bold text-ink outline-none sm:text-page">{material.title}</h1>
            <p className="m-0 text-body text-ink">Added {material.added} by {course?.teacher ?? "your instructor"}</p>
          </div>
        </header>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <p className="m-0 flex items-center gap-2 text-body text-muted"><Clock3 aria-hidden className="size-4" />{material.readTime} read</p>
          <p className="m-0 text-body-lg">{material.summary}</p>
          <div className="flex items-start gap-3 rounded-card bg-primary-50 p-4">
            <BookOpen aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-700" />
            <p className="m-0 flex flex-col text-body"><strong className="font-semibold">Learning goal</strong>{material.goal}</p>
          </div>
          {material.points.length > 0 && (
            <section aria-labelledby="key-ideas" className="flex flex-col gap-3">
              <h2 id="key-ideas" className="m-0 font-sans text-section font-semibold">Key ideas</h2>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {material.points.map((point, index) => (
                  <li key={point} className="flex items-start gap-3 rounded-control border border-line p-3 text-body">
                    <span aria-hidden className="font-semibold text-primary-700">{pad2(index + 1)}</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <Button variant={isReviewed ? "secondary" : "primary"} className="self-start" onClick={() => toggleReviewed(material.id)}>
            {isReviewed ? <><Check aria-hidden className="size-4" />Reviewed</> : <>Mark as reviewed<Check aria-hidden className="size-4" /></>}
          </Button>
        </div>
      </Card>
    </>
  );
}
