import { useState, type FormEvent } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Select } from "../../../../shared/ui/Field";
import { handOffImport } from "../../api/importHandoff";
import { useQuestionSetActions, type ImportResult } from "../../api/questionSets";

export interface SaveImportDialogProps {
  /** The import to turn into a new set; null when closed. */
  result: ImportResult | null;
  /** The subjects the instructor teaches: ISMS subject id → label. */
  subjects: Map<number, string>;
  onClose: () => void;
  /** The new set's id; it opens with the imported questions unsaved. */
  onCreated: (id: number) => void;
}

/** After an import on the Question sets page: name the new set and choose its subject. */
export function SaveImportDialog({ result, subjects, onClose, onCreated }: SaveImportDialogProps) {
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      {result && <SaveImportForm key={result.title ?? ""} result={result} subjects={subjects} onCreated={onCreated} />}
    </Dialog>
  );
}

function SaveImportForm({ result, subjects, onCreated }: Omit<SaveImportDialogProps, "result" | "onClose"> & { result: ImportResult }) {
  const actions = useQuestionSetActions();
  const options = [...subjects.entries()];
  const [title, setTitle] = useState(result.title ?? "");
  const [subjectId, setSubjectId] = useState(options.length === 1 ? String(options[0]![0]) : "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const count = result.questions.length;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = { title: title.trim() ? undefined : "Enter a title.", subjectId: subjectId ? undefined : "Choose a subject." };
    setErrors(next);
    if (next.title || next.subjectId) return;
    setSaving(true);
    const created = await actions.create(title, Number(subjectId));
    setSaving(false);
    if (!created.ok || created.id === undefined) {
      setErrors({ title: created.fieldErrors?.title?.[0] ?? created.message, subjectId: created.fieldErrors?.subjectId?.[0] });
      return;
    }
    handOffImport(created.id, result);
    onCreated(created.id);
  };

  return (
    <DialogContent
      title="Make a set from the import"
      description={`${count} ${count === 1 ? "question was" : "questions were"} read. The set opens with them unsaved, so you can check them first.`}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Set title" required error={errors.title}>
          <Input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Subject" required hint="Exams in your classes for this subject can use the set." error={errors.subjectId}>
          <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Choose a subject</option>
            {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </Field>
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          <Button type="submit" loading={saving} loadingLabel="Creating…">Open the new set</Button>
        </div>
      </form>
    </DialogContent>
  );
}
