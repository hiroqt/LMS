import { useState, type FormEvent } from "react";
import { describeApiError } from "../../../../shared/api/http";
import { Button } from "../../../../shared/ui/Button";
import { Field, Input } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { writeContent } from "../../api/content";
import type { Classroom, User } from "../../api/types";

export function ModuleForm({ room, instructor }: { room: Classroom; instructor: User }) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !title.trim()) return;
    setPending(true);
    try {
      await writeContent(room.id, instructor.id, "/modules", { title: title.trim(), sortOrder: 0 });
      setTitle("");
      toast.show({ title: "Module created" });
    } catch (error) {
      toast.show({ title: "Could not create module", description: describeApiError(error).detail, tone: "danger" });
    } finally { setPending(false); }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4">
      <fieldset disabled={pending} className="contents">
      <Field label="New module title"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={250} required /></Field>
      <Button type="submit" loading={pending}>Create module</Button>
    </fieldset>
    </form>
  );
}
