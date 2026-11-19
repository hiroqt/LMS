import { FileText, ListChecks } from "lucide-react";
import { handInRules, type HandInSettings } from "../../lib/assignmentRules";
import { Card } from "../../ui/Card";

export interface AssignmentBriefProps {
  /** The instructor's instructions, as plain text. */
  instructions: string;
  /** The assignment's hand-in settings; their sentences come from `handInRules`. */
  settings: HandInSettings;
}

/**
 * An assignment's instructions and its rules in plain words, as a student reads them. Purely
 * presentational, so the student's assignment page and the instructor's "Preview as student" show
 * the same thing; the server enforces every rule listed.
 */
export function AssignmentBrief({ instructions, settings }: AssignmentBriefProps) {
  const text = instructions.trim();
  return (
    <Card className="flex flex-col gap-4 p-5">
      <section aria-labelledby="assignment-instructions" className="flex flex-col gap-2">
        <h2 id="assignment-instructions" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><FileText aria-hidden className="size-4 text-primary-700" />Instructions</h2>
        <p className="m-0 max-w-prose text-body whitespace-pre-line">{text || "Your instructor did not add instructions."}</p>
      </section>
      <section aria-labelledby="assignment-rules" className="flex flex-col gap-2">
        <h2 id="assignment-rules" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><ListChecks aria-hidden className="size-4 text-primary-700" />How to hand in</h2>
        <ul className="m-0 flex max-w-prose list-disc flex-col gap-1 pl-5 text-body">
          {handInRules(settings).map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </section>
    </Card>
  );
}
