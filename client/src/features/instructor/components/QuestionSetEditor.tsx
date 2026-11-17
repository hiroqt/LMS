import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Field, Input } from "../../../shared/ui/Field";
import { useToast } from "../../../shared/ui/toast/useToast";
import type { ActionResult } from "../api/actions";
import { clearImport, peekImport } from "../api/importHandoff";
import { appendSections, applySaved, firstErrorKey, fromImport, mapFieldErrors, summarize, toDraftSections, untypedQuestions, type DraftSection } from "../api/questionDrafts";
import { QUESTION_TYPE_LABELS, type ImportResult, type QuestionSet } from "../api/questionSets";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { ImportDialog } from "./questionEditor/ImportDialog";
import { ImportSummary } from "./questionEditor/ImportSummary";
import { QuestionEditor, type QuestionEditorHandle } from "./questionEditor/QuestionEditor";

export interface QuestionSetEditorProps {
  set: QuestionSet;
  onSave: (title: string, sections: DraftSection[]) => Promise<ActionResult & { saved?: QuestionSet }>;
}

const time = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Edits an unlocked set's title, sections, and questions; the whole set is saved at once (D-040). */
export function QuestionSetEditor({ set, onSave }: QuestionSetEditorProps) {
  const toast = useToast();
  const editor = useRef<QuestionEditorHandle>(null);
  // Drafts imported from the Question sets page arrive unsaved (see importHandoff).
  const [handedOver] = useState(() => peekImport(set.id));
  const [title, setTitle] = useState(set.title);
  const [sections, setSections] = useState<DraftSection[]>(() => {
    const saved = toDraftSections(set);
    return handedOver ? appendSections(saved, fromImport(handedOver)) : saved;
  });
  const [imported, setImported] = useState<ImportResult | null>(handedOver ?? null);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(Boolean(handedOver));
  const [reveal, setReveal] = useState(() => Boolean(handedOver) || set.questions.some((question) => question.incomplete));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  useUnsavedChanges(dirty);
  useEffect(() => clearImport(set.id), [set.id]);

  const errors = mapFieldErrors(fieldErrors, sections);
  const summary = summarize(sections);
  const change = (next: DraftSection[]) => {
    setSections(next);
    setDirty(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setReveal(true);
    if (!title.trim()) {
      setFieldErrors({ title: ["Enter a title."] });
      return;
    }
    const untyped = untypedQuestions(sections);
    if (untyped.length) {
      const next = Object.fromEntries(untyped.map((n) => [`questions[${n - 1}].type`, ["Choose the type."]]));
      setFieldErrors(next);
      const key = firstErrorKey(mapFieldErrors(next, sections), sections);
      if (key) editor.current?.jumpTo(key, "type");
      return;
    }
    setSaving(true);
    const result = await onSave(title, sections);
    setSaving(false);
    setFieldErrors(result.fieldErrors ?? {});
    if (!result.ok) {
      toast.show({ title: "Could not save the question set", description: result.message, tone: "danger" });
      const mapped = mapFieldErrors(result.fieldErrors, sections);
      const key = firstErrorKey(mapped, sections);
      if (key) editor.current?.jumpTo(key, (mapped.questions[key] ?? mapped.sections[key])?.[0]?.field);
      return;
    }
    if (result.saved) setSections((current) => applySaved(current, result.saved!));
    setDirty(false);
    setStatus(`All changes saved at ${time()}.`);
    toast.show({ title: "Question set saved", description: title.trim(), tone: "success" });
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Edit question set" className="flex flex-col gap-4">
      <Field label="Set title" required error={fieldErrors.title?.[0]}>
        <Input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} />
      </Field>
      {imported && <ImportSummary result={imported} onDismiss={() => setImported(null)} />}
      <QuestionEditor
        ref={editor}
        sections={sections}
        onChange={change}
        errors={errors}
        reveal={reveal}
        onImport={() => setImporting(true)}
      />
      {!summary.count && <p className="m-0 text-body text-muted">This set has no questions. An exam that uses it cannot be published until it has one.</p>}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-line bg-canvas px-1 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col text-body">
          <p className="m-0 text-ink">
            {summary.count} {summary.count === 1 ? "question" : "questions"} · {summary.totalPoints} {summary.totalPoints === 1 ? "point" : "points"}
            {summary.attention.length > 0 && <> · <span className="font-semibold text-warning">{summary.attention.length} {summary.attention.length === 1 ? "needs" : "need"} attention</span></>}
          </p>
          <p role="status" className="m-0 text-muted">{dirty ? "" : status}</p>
          {dirty && <p className="m-0 text-muted">Unsaved changes</p>}
        </div>
        <Button type="submit" loading={saving} loadingLabel="Saving…">Save question set</Button>
      </div>
      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onImported={(result) => {
          setSections((current) => appendSections(current, fromImport(result)));
          setImported(result);
          setReveal(true);
          setDirty(true);
          toast.show({ title: "Questions imported", description: "Check them, then save the set.", tone: "success" });
        }}
      />
    </form>
  );
}

/** A locked set's questions, read-only, with the correct answers in text. */
export function QuestionSetView({ set }: { set: QuestionSet }) {
  if (!set.questions.length) return <p className="m-0 text-body text-muted">This set has no questions.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {set.questions.map((question, index) => (
        <li key={question.id}>
          <Card className="flex flex-col gap-2 p-4 font-sans">
            <p className="m-0 text-body text-muted">Question {index + 1} · {QUESTION_TYPE_LABELS[question.type] ?? question.type} · {question.points} {question.points === 1 ? "point" : "points"}</p>
            <p className="m-0 text-body-lg text-ink">{question.prompt}</p>
            {question.type === "modified_true_false" && question.underlined && <p className="m-0 text-body">Underlined: {question.underlined}</p>}
            {(question.type === "multiple_choice" || question.type === "true_false" || question.type === "modified_true_false") && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
                {question.options.map((option) => (
                  <li key={option.id} className={option.isCorrect ? "font-semibold text-primary-700" : "text-ink"}>
                    {option.text}{option.isCorrect ? " (correct answer)" : ""}
                  </li>
                ))}
              </ul>
            )}
            {(question.type === "enumeration" || question.type === "identification" || (question.type === "modified_true_false" && question.expectedAnswers.length > 0)) && (
              <p className="m-0 text-body">Accepted answers: {question.expectedAnswers.join(", ")}</p>
            )}
            {question.type === "matching" && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
                {question.pairs.map((pair) => <li key={`${pair.left}-${pair.right}`}>{pair.left} → {pair.right}</li>)}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}
