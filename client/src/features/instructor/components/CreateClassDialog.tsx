import { useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { Field, Input, Select } from "../../../shared/ui/Field";
import { useToast } from "../../../shared/ui/toast/useToast";
import type { Subject } from "../api/types";

export interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  onCreate: (input: { subjectId: string; yearLevel: number; section: string }) => string | null;
}

/** Subject, year level, and section. Creates the room, a starter module, and default weights. */
export function CreateClassDialog({ open, onOpenChange, subjects, onCreate }: CreateClassDialogProps) {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [yearLevel, setYearLevel] = useState("1");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!section.trim()) {
      setError("Enter a section, for example Section A.");
      return;
    }
    if (!onCreate({ subjectId: subjectId || subjects[0]?.id || "", yearLevel: Number(yearLevel), section })) {
      toast.show({ title: "Could not create the class", description: "Browser storage is full or blocked.", tone: "danger" });
      return;
    }
    setSection("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setError(""); }}>
      <DialogContent title="Create a class" description="Add a course room to your instructor workspace. Students join after an admin enrolls them.">
        <form id="create-class-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label="Subject">
            <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.title}</option>)}
            </Select>
          </Field>
          <Field label="Year level">
            <Select value={yearLevel} onChange={(event) => setYearLevel(event.target.value)}>
              {[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}
            </Select>
          </Field>
          <Field label="Section" required error={error || undefined}>
            <Input value={section} onChange={(event) => setSection(event.target.value)} placeholder={`Year ${yearLevel} · Section A`} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit">Create class</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
