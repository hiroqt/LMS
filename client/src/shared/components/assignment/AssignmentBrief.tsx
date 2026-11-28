import { FileText, ListChecks, Table2 } from "lucide-react";
import type { Rubric } from "../../api/rubrics";
import { handInRules, type HandInSettings } from "../../lib/assignmentRules";
import { formatDue } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Skeleton, SkeletonGroup } from "../../ui/Skeleton";
import { RubricView } from "./RubricView";

/** The assignment's rubric for the brief: the rubric, still loading, or why it could not be loaded. */
export type BriefRubric =
  | { rubric: Pick<Rubric, "criteria" | "totalPoints"> }
  | { loading: true }
  | { error: string; onRetry: () => void };

export interface AssignmentBriefProps {
  /** The instructor's instructions, as plain text. */
  instructions: string;
  /** The assignment's hand-in settings; their sentences come from `handInRules`. */
  settings: HandInSettings;
  /**
   * `settings.dueAt` is the student's own due date, later than the class's (contract §11). The
   * due-date rule then says so: "Your due date: … (your instructor gave you more time)."
   */
  ownDueDate?: boolean;
  /** What the work is graded on, read-only (contract §12). Omit when the assignment has no rubric. */
  rubric?: BriefRubric;
  /**
   * The student's work is handed in (D-073): the instructions and the rules step aside, and only
   * the rubric stays, since the work is still graded on it. Nothing shows without a rubric.
   */
  handedIn?: boolean;
}

/** The rules, with the due-date sentence reworded when the date is the student's own. */
function briefRules(settings: HandInSettings, ownDueDate = false): string[] {
  const rules = handInRules(settings);
  if (!ownDueDate || !settings.dueAt) return rules;
  const classSentence = `Due ${formatDue(settings.dueAt)}.`;
  return rules.map((rule) => (rule === classSentence ? `Your due date: ${formatDue(settings.dueAt!)} (your instructor gave you more time).` : rule));
}

/**
 * An assignment's instructions, its rules in plain words, and its rubric, as a student reads them
 * (only the rubric once the work is handed in).
 * Purely presentational, so the student's assignment page and the instructor's "Preview as
 * student" show the same thing; the server enforces every rule listed.
 */
export function AssignmentBrief({ instructions, settings, ownDueDate, rubric, handedIn = false }: AssignmentBriefProps) {
  const text = instructions.trim();
  if (handedIn && !rubric) return null;
  return (
    <Card className="flex flex-col gap-4 p-5">
      {!handedIn && (
        <>
          <section aria-labelledby="assignment-instructions" className="flex flex-col gap-2">
            <h2 id="assignment-instructions" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><FileText aria-hidden className="size-4 text-primary-700" />Instructions</h2>
            <p className="m-0 max-w-prose text-body whitespace-pre-line">{text || "Your instructor did not add instructions."}</p>
          </section>
          <section aria-labelledby="assignment-rules" className="flex flex-col gap-2">
            <h2 id="assignment-rules" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><ListChecks aria-hidden className="size-4 text-primary-700" />How to hand in</h2>
            <ul className="m-0 flex max-w-prose list-disc flex-col gap-1 pl-5 text-body">
              {briefRules(settings, ownDueDate).map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </section>
        </>
      )}
      {rubric && (
        <section aria-labelledby="assignment-rubric" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="assignment-rubric" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><Table2 aria-hidden className="size-4 text-primary-700" />Rubric</h2>
            <p className="m-0 max-w-prose text-body text-muted">Your work is graded on each criterion below. Your instructor chooses one level for each.</p>
          </div>
          {"rubric" in rubric ? (
            <RubricView rubric={rubric.rubric} name="brief-rubric" />
          ) : "loading" in rubric ? (
            <SkeletonGroup label="Loading the rubric"><Skeleton className="h-24 w-full" /></SkeletonGroup>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-body text-danger">The rubric could not be loaded. {rubric.error}</p>
              <Button variant="secondary" onClick={rubric.onRetry}>Try again</Button>
            </div>
          )}
        </section>
      )}
    </Card>
  );
}
