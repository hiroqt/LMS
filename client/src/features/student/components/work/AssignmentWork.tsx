import type { ReactNode } from "react";
import { describeApiError } from "../../../../shared/api/http";
import { AssignmentBrief, type BriefRubric } from "../../../../shared/components/assignment/AssignmentBrief";
import type { HandInSettings } from "../../../../shared/lib/assignmentRules";
import type { TurnIn } from "../../../../shared/api/overview";
import { gradeSum, splitWork } from "../../api/work";
import { useAssignmentRubric } from "../../hooks/useAssignmentRubric";
import { useMyWork } from "../../hooks/useMyWork";
import { YourWork } from "./YourWork";

export interface AssignmentWorkProps {
  classId: string;
  assessmentId: string;
  instructions: string;
  /** With the student's own dates (`ownHandIn`). */
  settings: HandInSettings;
  turnIn: TurnIn | undefined;
  rubricId: number | undefined;
  /** The work is handed in with no new version under way (`workIsHandedIn`): the brief keeps only the rubric (D-073). */
  handedIn: boolean;
  /** Shown between the brief and the work card (the "Closed" note). */
  children?: ReactNode;
}

/**
 * An assignment on the student's page: the brief (instructions, rules, rubric) and the Your work
 * card. The rubric is read once for both: read-only in the brief, and with the chosen levels on a
 * visible grade, where the brief then leaves it out so it is not shown twice. Once the work is
 * handed in, the instructions and rules step aside until a new version is started (D-073).
 */
export function AssignmentWork({ classId, assessmentId, instructions, settings, turnIn, rubricId, handedIn, children }: AssignmentWorkProps) {
  const rubric = useAssignmentRubric(classId, assessmentId, rubricId);
  const work = useMyWork(classId, assessmentId);
  const { current } = splitWork(work.data ?? []);
  const gradeShowsRubric = Boolean(current && gradeSum(current) && current.rubricScores.length > 0 && rubric.data);

  let briefRubric: BriefRubric | undefined;
  if (rubricId && !gradeShowsRubric) {
    if (rubric.isPending) briefRubric = { loading: true };
    else if (rubric.isError) {
      const { title, detail } = describeApiError(rubric.error);
      briefRubric = { error: `${title}. ${detail}`, onRetry: () => void rubric.refetch() };
    } else if (rubric.data) briefRubric = { rubric: rubric.data };
  }

  return (
    <>
      <AssignmentBrief instructions={instructions} settings={settings} ownDueDate={turnIn?.extended} rubric={briefRubric} handedIn={handedIn} />
      {children}
      {turnIn && <YourWork classId={classId} assessmentId={assessmentId} settings={settings} turnIn={turnIn} rubric={rubric.data} />}
    </>
  );
}
