import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { describeApiError } from "../../../shared/api/http";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { Field, Input, Textarea } from "../../../shared/ui/Field";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { hasKey, keyChanges, keyProblem, regradeSummary, toKeyDraft, typeLabel, useFixAnswerKey, useKeySet, type KeyDraft, type KeySet, type KeyedQuestion } from "../api/grading";
import { QuestionPrompt } from "./AnswerBesideKey";

const radio = "flex min-h-touch cursor-pointer items-center gap-3 rounded-control border border-line bg-surface px-3 text-body has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50 has-[:checked]:font-semibold";

function Choice({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={radio}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="size-5 shrink-0 accent-primary-600" />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}

/** The key editor for one question: only what its type's key is made of. */
function KeyFields({ question, number, draft, error, onChange }: { question: KeyedQuestion; number: number; draft: KeyDraft; error?: string; onChange: (draft: KeyDraft) => void }) {
  const name = `key-${question.id}`;
  const trueFalse = (legend: string) => (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-body font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Choice name={name} label="True" checked={draft.correctAnswer} onChange={() => onChange({ ...draft, correctAnswer: true })} />
        <Choice name={name} label="False" checked={!draft.correctAnswer} onChange={() => onChange({ ...draft, correctAnswer: false })} />
      </div>
    </fieldset>
  );
  const lines = (label: string) => (
    <Field label={label} hint="One per line." error={error}>
      <Textarea rows={3} value={draft.expectedAnswers} onChange={(event) => onChange({ ...draft, expectedAnswers: event.target.value })} />
    </Field>
  );

  switch (question.type) {
    case "multiple_choice":
      return (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-body font-medium">Correct choice for question {number}</legend>
          {question.options.map((option) => (
            <Choice key={option.id} name={name} label={option.text} checked={draft.correctOptionId === option.id} onChange={() => onChange({ ...draft, correctOptionId: option.id })} />
          ))}
          {error && <p className="m-0 text-body font-medium text-danger">{error}</p>}
        </fieldset>
      );
    case "true_false":
      return trueFalse(`Correct answer for question ${number}`);
    case "identification":
      return lines(`Accepted answers for question ${number}`);
    case "enumeration":
      return lines(`Accepted items for question ${number}`);
    case "modified_true_false":
      return (
        <>
          {trueFalse(`The statement in question ${number} is`)}
          {!draft.correctAnswer && lines(`Accepted corrections for question ${number}`)}
        </>
      );
    case "matching":
      return (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-body font-medium">Matches for question {number}</legend>
          {question.pairs.map((pair, index) => (
            <Field key={`${pair.left}-${index}`} label={`Match for “${pair.left}”`}>
              <Input
                value={draft.rights[index] ?? ""}
                onChange={(event) => {
                  const rights = [...draft.rights];
                  rights[index] = event.target.value;
                  onChange({ ...draft, rights });
                }}
              />
            </Field>
          ))}
          {error && <p className="m-0 text-body font-medium text-danger">{error}</p>}
        </fieldset>
      );
    default:
      return null;
  }
}

function KeyEditor({ set, questionId, onClose }: { set: KeySet; questionId?: number; onClose: () => void }) {
  const toast = useToast();
  const fixKey = useFixAnswerKey();
  const numbered = set.questions.map((question, index) => ({ question, number: index + 1 })).filter(({ question }) => hasKey(question) && (questionId === undefined || question.id === questionId));
  const [drafts, setDrafts] = useState<Record<number, KeyDraft>>(() => Object.fromEntries(numbered.map(({ question }) => [question.id, toKeyDraft(question)])));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const changes = keyChanges(numbered.map(({ question }) => question), drafts);
  const single = numbered.length === 1 ? numbered[0] : undefined;
  const title = single ? `Fix the key for question ${single.number}` : "Fix the answer key";

  const review = () => {
    const problems: Record<number, string> = {};
    for (const { question } of numbered) {
      const problem = drafts[question.id] ? keyProblem(drafts[question.id]!) : null;
      if (problem) problems[question.id] = problem;
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
    if (!changes.length) {
      setNotice("Nothing has changed yet. Change a correct answer first.");
      return;
    }
    setNotice("");
    setStep("confirm");
  };

  const save = async () => {
    setSaving(true);
    const outcome = await fixKey(set.id, changes);
    setSaving(false);
    if (!outcome.ok || !outcome.result) {
      toast.show({ title: "Could not save the answer key", description: outcome.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Answer key saved", description: regradeSummary(outcome.result), tone: "success" });
    onClose();
  };

  if (step === "confirm") {
    return (
      <DialogContent
        title="Re-score every attempt?"
        description={`${changes.length} ${changes.length === 1 ? "question's key changes" : "questions' keys change"} in “${set.title}”.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStep("edit")}>Back</Button>
            <Button loading={saving} loadingLabel="Re-scoring…" onClick={() => void save()}>Save and re-score</Button>
          </>
        }
      >
        <p className="m-0 flex items-start gap-2 rounded-control bg-warning-soft p-3 text-body text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          Every submitted attempt will be re-scored. Students whose score changes will see a note.
        </p>
      </DialogContent>
    );
  }

  return (
    <DialogContent
      title={title}
      description="Change only the correct answers. Questions, choices, and points stay as they are."
      footer={
        <>
          <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          <Button onClick={review}>Review changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {notice && <p role="alert" className="m-0 text-body font-medium text-danger">{notice}</p>}
        {numbered.length ? (
          numbered.map(({ question, number }) => (
            <section key={question.id} aria-labelledby={`key-heading-${question.id}`} className="flex flex-col gap-3 rounded-control border border-line p-3">
              <div className="flex flex-col gap-0.5">
                <h3 id={`key-heading-${question.id}`} className="m-0 text-card-title font-semibold">Question {number} · {typeLabel(question.type)}</h3>
                <p className="m-0 text-body text-ink"><QuestionPrompt question={question} /></p>
              </div>
              <KeyFields
                question={question}
                number={number}
                draft={drafts[question.id] ?? toKeyDraft(question)}
                error={errors[question.id]}
                onChange={(draft) => {
                  setDrafts((current) => ({ ...current, [question.id]: draft }));
                  setNotice("");
                }}
              />
            </section>
          ))
        ) : (
          <p className="m-0 text-body text-muted">This set has no questions with an answer key. Essays are scored by hand.</p>
        )}
      </div>
    </DialogContent>
  );
}

export interface AnswerKeyDialogProps {
  /** The question set whose key is fixed. */
  setId: number | null | undefined;
  /** Limit the dialog to one question (from item analysis). */
  questionId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fix a set's answer key, even when it is locked; every submitted attempt is re-scored (D-042). */
export function AnswerKeyDialog({ setId, questionId, open, onOpenChange }: AnswerKeyDialogProps) {
  const set = useKeySet(setId, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open &&
        (set.data ? (
          <KeyEditor key={`${set.data.id}-${questionId ?? "all"}`} set={set.data} questionId={questionId} onClose={() => onOpenChange(false)} />
        ) : (
          <DialogContent title="Fix the answer key">
            {set.isError ? (
              <p role="alert" className="m-0 text-body text-danger">
                {describeApiError(set.error).title}.{" "}
                <button type="button" onClick={() => void set.refetch()} className="min-h-touch border-0 bg-transparent font-sans font-semibold text-primary-700 underline">Try again</button>
              </p>
            ) : (
              <SkeletonGroup label="Loading the answer key" className="flex flex-col gap-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /></SkeletonGroup>
            )}
          </DialogContent>
        ))}
    </Dialog>
  );
}
