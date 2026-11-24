import { Award } from "lucide-react";
import type { Submission } from "../../../../shared/api/overview";
import { chosenLevels, type Rubric } from "../../../../shared/api/rubrics";
import { RubricView } from "../../../../shared/components/assignment/RubricView";
import { gradeSum } from "../../api/work";

export interface GradeSummaryProps {
  /** The handed-in version the grade belongs to. */
  work: Pick<Submission, "status" | "score" | "rawScore" | "maxPoints" | "daysLate" | "penaltyPercent" | "penaltyWaived" | "rubricScores">;
  /** The assignment's rubric, when it has one and it has loaded. */
  rubric?: Pick<Rubric, "criteria" | "totalPoints"> | null;
}

/**
 * The grade on the student's work as a sum (contract §10, §12): the points given, the late
 * penalty and the score after it, and the rubric level chosen for each criterion. Nothing while
 * the grade is held: the server sends a held grade as `submitted` with no score or levels.
 */
export function GradeSummary({ work, rubric }: GradeSummaryProps) {
  const sum = gradeSum(work);
  if (!sum) return null;
  const showRubric = rubric && work.rubricScores.length > 0;
  return (
    <section aria-labelledby="your-grade" className="flex flex-col gap-3 rounded-control border border-line p-4">
      <h3 id="your-grade" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><Award aria-hidden className="size-4 text-primary-700" />Your grade</h3>
      <dl className="m-0 flex flex-col gap-1 text-body">
        {sum.lines.map((line) => (
          <div key={line.label} className="flex flex-wrap gap-x-2">
            <dt className="font-medium">{line.label}:</dt>
            <dd className="m-0">{line.value}</dd>
          </div>
        ))}
      </dl>
      {sum.note && <p className="m-0 max-w-prose text-body text-ink">{sum.note}</p>}
      {showRubric && (
        <section aria-labelledby="your-grade-rubric" className="flex flex-col gap-2">
          <h4 id="your-grade-rubric" className="m-0 font-sans text-body font-semibold">Rubric</h4>
          <RubricView rubric={rubric} chosen={chosenLevels(work.rubricScores)} name="grade-rubric" />
        </section>
      )}
    </section>
  );
}
