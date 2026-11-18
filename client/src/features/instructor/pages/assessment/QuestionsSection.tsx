import { FileUp } from "lucide-react";
import type { Ref } from "react";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import type { QuestionSource } from "../../api/assessments";
import type { DraftSection, MappedErrors } from "../../api/questionDrafts";
import type { ImportResult } from "../../api/questionSets";
import { QuestionEditor, type QuestionEditorHandle } from "../../components/questionEditor/QuestionEditor";
import { ImportSummary } from "../../components/questionEditor/ImportSummary";
import { QuestionSetPicker } from "../../components/QuestionSetPicker";

const SOURCES: Array<{ value: QuestionSource; label: string; hint: string }> = [
  { value: "write", label: "Write questions", hint: "Type them here, in sections." },
  { value: "import", label: "Import from a file", hint: "Word, Excel, CSV, or pasted text." },
  { value: "use", label: "Use a question set", hint: "Reuse one of your sets." },
];

export interface QuestionsSectionProps {
  source: QuestionSource;
  onSource: (source: QuestionSource) => void;
  sections: DraftSection[];
  onSections: (sections: DraftSection[]) => void;
  errors: MappedErrors;
  reveal: boolean;
  imported: ImportResult | null;
  onDismissImport: () => void;
  onOpenImport: () => void;
  subjectId: number | undefined;
  setId: string;
  onSetId: (id: string) => void;
  setError?: string;
  editorRef: Ref<QuestionEditorHandle>;
}

/** Three ways in (D-040): write, import, or reuse a set. Writing and importing share one editor. */
export function QuestionsSection(props: QuestionsSectionProps) {
  const { source, onSource, sections, onSections, errors, reveal, imported, onDismissImport, onOpenImport, subjectId, setId, onSetId, setError, editorRef } = props;
  const hasDrafts = sections.some((section) => section.questions.length > 0);
  return (
    <section aria-labelledby="builder-questions" className="flex flex-col gap-4">
      <h2 id="builder-questions" className="sr-only">Questions</h2>
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 font-sans">
        <legend className="mb-1 p-0 text-body font-medium text-ink">How do you want to add questions?</legend>
        <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-3">
          {SOURCES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-touch cursor-pointer items-start gap-3 rounded-control border p-3 text-body",
                source === option.value ? "border-primary-600 bg-primary-50" : "border-line-strong bg-surface hover:bg-primary-50",
              )}
            >
              <input type="radio" name="question-source" value={option.value} checked={source === option.value} onChange={() => onSource(option.value)} className="mt-0.5 size-5 shrink-0 accent-primary-600" />
              <span className="flex flex-col">
                <span className="font-semibold text-ink">{option.label}</span>
                <span className="text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {source === "use" ? (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 sm:p-5">
          <QuestionSetPicker subjectId={subjectId} value={setId} onChange={onSetId} error={setError} />
          {hasDrafts && <p className="m-0 text-body text-muted">The questions you wrote stay here while this page is open, but the assessment uses the set you choose.</p>}
        </div>
      ) : (
        <>
          {source === "import" && (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
              <p className="m-0 text-body text-ink">
                Upload your Word, Excel, or CSV file, or paste the questions. They open below for you to check before you save; the file is not kept.
              </p>
              <Button className="self-start" icon={<FileUp aria-hidden className="size-4" />} onClick={onOpenImport}>
                {hasDrafts ? "Import more questions" : "Choose a file or paste text"}
              </Button>
            </div>
          )}
          {imported && <ImportSummary result={imported} onDismiss={onDismissImport} />}
          {(source === "write" || hasDrafts) && (
            <QuestionEditor ref={editorRef} sections={sections} onChange={onSections} errors={errors} reveal={reveal} onImport={source === "write" ? onOpenImport : undefined} />
          )}
        </>
      )}
    </section>
  );
}
