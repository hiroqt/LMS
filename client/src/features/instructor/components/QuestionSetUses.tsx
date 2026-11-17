import type { QuestionUse } from "../api/questionSets";

/** The exams that use a set: "Exam title · Subject · Section". */
export function QuestionSetUses({ uses, onOpen }: { uses: QuestionUse[]; onOpen?: (use: QuestionUse) => void }) {
  if (!uses.length) return <p className="m-0 text-body text-muted">Not used by any exam yet.</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 font-sans text-body">
      {uses.map((use) => {
        const where = [use.subjectName, use.sectionName].filter(Boolean).join(" · ");
        return (
          <li key={use.examId}>
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(use)}
                className="min-h-touch rounded-control border-0 bg-transparent p-0 text-left font-sans text-body font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-focus"
              >
                {use.examTitle}
              </button>
            ) : (
              <span className="font-medium text-ink">{use.examTitle}</span>
            )}
            <span className="text-muted"> · {where}</span>
          </li>
        );
      })}
    </ul>
  );
}
