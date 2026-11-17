import { FileCheck2, X } from "lucide-react";
import { IconButton } from "../../../../shared/ui/IconButton";
import type { ImportResult } from "../../api/questionSets";

const FORMATS: Record<ImportResult["format"], string> = { docx: "Word document", xlsx: "Excel file", csv: "CSV file", text: "pasted text" };

/** What an import read, and the document-wide warnings (numbering gaps, points mismatches). */
export function ImportSummary({ result, onDismiss }: { result: ImportResult; onDismiss: () => void }) {
  const count = result.questions.length;
  const flagged = result.questions.filter((question) => question.warnings.length).length;
  return (
    <section aria-label="Import summary" className="flex flex-col gap-2 rounded-card border border-info/30 bg-info-soft p-4 text-body text-info">
      <div className="flex items-start gap-2">
        <FileCheck2 aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p className="m-0 flex-1 font-semibold">
          Read {count} {count === 1 ? "question" : "questions"} from the {FORMATS[result.format]}.
          {flagged > 0 && ` ${flagged} ${flagged === 1 ? "has a note" : "have notes"} on its card.`} Check them, then save.
        </p>
        <IconButton label="Dismiss the import summary" className="-m-2 text-info" onClick={onDismiss}><X /></IconButton>
      </div>
      {result.warnings.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-12">
          {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </section>
  );
}
