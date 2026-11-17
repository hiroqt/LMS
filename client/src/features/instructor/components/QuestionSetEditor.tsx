import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Field, Input, Select, Textarea } from "../../../shared/ui/Field";
import { useToast } from "../../../shared/ui/toast/useToast";
import type { ActionResult } from "../api/actions";
import { newQuestion, QUESTION_TYPE_LABELS, questionErrors, toDraft, type DraftQuestion, type QuestionSet } from "../api/questionSets";

export interface QuestionSetEditorProps {
  set: QuestionSet;
  onSave: (title: string, questions: DraftQuestion[]) => Promise<ActionResult>;
}

/** Edits an unlocked set's title and questions; the whole list is saved at once. */
export function QuestionSetEditor({ set, onSave }: QuestionSetEditorProps) {
  const toast = useToast();
  const [title, setTitle] = useState(set.title);
  const [drafts, setDrafts] = useState<DraftQuestion[]>(() => set.questions.map(toDraft));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const patch = (index: number, change: Partial<DraftQuestion>) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...change } : draft)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) {
      setFieldErrors({ title: ["Enter a title."] });
      return;
    }
    setSaving(true);
    const result = await onSave(title, drafts);
    setSaving(false);
    setFieldErrors(result.fieldErrors ?? {});
    if (result.ok) toast.show({ title: "Question set saved", description: title.trim(), tone: "success" });
    else toast.show({ title: "Could not save the question set", description: result.message, tone: "danger" });
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Edit question set" className="flex flex-col gap-4">
      <Field label="Set title" required error={fieldErrors.title?.[0]}>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      {fieldErrors.questions && <p role="alert" className="m-0 text-body font-medium text-danger">{fieldErrors.questions[0]}</p>}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {drafts.map((draft, index) => (
          <li key={draft.key}>
            <DraftCard
              draft={draft}
              number={index + 1}
              errors={questionErrors(fieldErrors, index)}
              onChange={(change) => patch(index, change)}
              onRemove={() => setDrafts((current) => current.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ol>
      {!drafts.length && <p className="m-0 text-body text-muted">This set has no questions. An exam that uses it cannot be published until it has one.</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="secondary" icon={<Plus aria-hidden className="size-4" />} onClick={() => setDrafts((current) => [...current, newQuestion()])}>
          Add a multiple-choice question
        </Button>
        <Button type="submit" loading={saving} loadingLabel="Saving…">Save question set</Button>
      </div>
    </form>
  );
}

function DraftCard({ draft, number, errors, onChange, onRemove }: { draft: DraftQuestion; number: number; errors: string[]; onChange: (change: Partial<DraftQuestion>) => void; onRemove: () => void }) {
  return (
    <Card className="p-4">
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0 font-sans">
        <legend className="mb-1 p-0 text-card-title font-semibold text-ink">Question {number} · {QUESTION_TYPE_LABELS[draft.type]}</legend>
        <Field label={`Question ${number}`} required>
          <Textarea rows={2} value={draft.prompt} onChange={(event) => onChange({ prompt: event.target.value })} />
        </Field>
        <Field label={`Points for question ${number}`} required className="sm:max-w-48">
          <Input type="number" inputMode="decimal" min={0} value={draft.points} onChange={(event) => onChange({ points: event.target.value })} />
        </Field>
        {draft.type === "multiple_choice" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {draft.options.map((option, k) => (
                <Field key={k} label={`Question ${number}, choice ${k + 1}`} required>
                  <Input value={option.text} onChange={(event) => onChange({ options: draft.options.map((o, i) => (i === k ? { ...o, text: event.target.value } : o)) })} />
                </Field>
              ))}
            </div>
            <Field label={`Correct choice for question ${number}`}>
              <Select
                value={String(Math.max(0, draft.options.findIndex((o) => o.isCorrect)))}
                onChange={(event) => onChange({ options: draft.options.map((o, i) => ({ ...o, isCorrect: i === Number(event.target.value) })) })}
              >
                {draft.options.map((_, k) => <option key={k} value={k}>Choice {k + 1}</option>)}
              </Select>
            </Field>
          </>
        )}
        {draft.type === "true_false" && (
          <Field label={`Answer to question ${number}`}>
            <Select value={draft.correctAnswer ? "true" : "false"} onChange={(event) => onChange({ correctAnswer: event.target.value === "true" })}>
              <option value="true">True</option>
              <option value="false">False</option>
            </Select>
          </Field>
        )}
        {draft.type === "enumeration" && (
          <Field label={`Accepted answers for question ${number}`} hint="One per line. Matched in any order, ignoring capitals.">
            <Textarea rows={3} value={draft.expectedAnswers} onChange={(event) => onChange({ expectedAnswers: event.target.value })} />
          </Field>
        )}
        {draft.type === "matching" && (
          <div className="flex flex-col gap-3">
            {draft.pairs.map((pair, k) => (
              <div key={k} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={`Question ${number}, pair ${k + 1}, left item`} required>
                  <Input value={pair.left} onChange={(event) => onChange({ pairs: draft.pairs.map((p, i) => (i === k ? { ...p, left: event.target.value } : p)) })} />
                </Field>
                <Field label={`Question ${number}, pair ${k + 1}, matching item`} required>
                  <Input value={pair.right} onChange={(event) => onChange({ pairs: draft.pairs.map((p, i) => (i === k ? { ...p, right: event.target.value } : p)) })} />
                </Field>
              </div>
            ))}
          </div>
        )}
        {draft.type === "essay" && <p className="m-0 text-body text-muted">You grade essay answers yourself.</p>}
        {errors.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body font-medium text-danger">
            {errors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
        <Button variant="ghost" className="self-start" icon={<Trash2 aria-hidden className="size-4" />} onClick={onRemove}>
          Remove question {number}
        </Button>
      </fieldset>
    </Card>
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
            <p className="m-0 text-body text-muted">Question {index + 1} · {QUESTION_TYPE_LABELS[question.type]} · {question.points} {question.points === 1 ? "point" : "points"}</p>
            <p className="m-0 text-body-lg text-ink">{question.prompt}</p>
            {(question.type === "multiple_choice" || question.type === "true_false") && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
                {question.options.map((option) => (
                  <li key={option.id} className={option.isCorrect ? "font-semibold text-primary-700" : "text-ink"}>
                    {option.text}{option.isCorrect ? " (correct answer)" : ""}
                  </li>
                ))}
              </ul>
            )}
            {question.type === "enumeration" && <p className="m-0 text-body">Accepted answers: {question.expectedAnswers.join(", ")}</p>}
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
