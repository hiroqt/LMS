import { BookOpen, ClipboardList, FileUp, GraduationCap, ListChecks, Pencil, Plus, X } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { moduleChoices } from "../../../../shared/lib/moduleTree";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import { instructorPaths, type ContentType } from "../../paths";
import { RESOURCE_TYPES } from "./classUtils";
import type { ClassTabProps } from "./shared";

type Errors = Record<string, string | undefined>;

/** The inline form is for materials only; assignments and assessments have builder pages (D-040, D-059). */
function MaterialForm({ room, content, onDone }: Pick<ClassTabProps, "room" | "content"> & { onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const choices = moduleChoices(content.modules);
  const [values, setValues] = useState<Record<string, string>>({ moduleId: choices[0]?.id ?? "", kind: "Study guide" });
  const [file, setFile] = useState<{ name: string; type: string; size: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const set = (key: string) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const v = (key: string) => values[key] ?? "";

  const actions = useInstructorActions();
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const next: Errors = { title: v("title").trim() ? undefined : "Enter a title." };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    const result = await actions.createMaterial(room.id, { moduleId: v("moduleId"), title: v("title"), kind: v("kind"), description: v("description"), fileName: file?.name, fileType: file?.type, fileSize: file?.size });
    setSaving(false);
    if (!result.ok) {
      // Show the server's messages on the matching fields.
      setErrors(Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([field, messages]) => [field, messages[0]])));
      toast.show({ title: "Could not publish", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Material published", description: v("title").trim(), tone: "success" });
    onDone(true);
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="content-form-title" className="flex flex-col gap-4 rounded-card border border-primary-200 bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 id="content-form-title" className="m-0 font-sans text-section font-semibold">Upload class material</h3>
        <p className="m-0 text-body text-muted">This content will be shared with {room.section}.</p>
      </div>
      <Field label="Curriculum Unit / Module" hint="A module, or one of its submodules.">
        <Select value={v("moduleId")} onChange={set("moduleId")}>
          {choices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Select>
      </Field>
      <Field label="Material title" required error={errors.title}>
        <Input value={v("title")} onChange={set("title")} />
      </Field>
      <Field label="Resource type">
        <Select value={v("kind")} onChange={set("kind")}>
          {RESOURCE_TYPES.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </Select>
      </Field>
      <Field label="Description & Learning Objectives">
        <Textarea value={v("description")} onChange={set("description")} rows={3} />
      </Field>
      <Field label="Attach file / document" hint="PDF, DOCX, PPTX, TXT, or ZIP. The demo keeps the file name and size only.">
        <Input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
          className="py-2.5 file:mr-3 file:rounded-control file:border-0 file:bg-primary-100 file:px-3 file:py-1.5 file:font-sans file:text-body file:font-semibold file:text-primary-700"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (!picked) return;
            const size = (picked.size / (1024 * 1024)).toFixed(1);
            setFile({ name: picked.name, type: picked.name.split(".").pop()?.toLowerCase() || "pdf", size: `${Number(size) > 0 ? size : "0.5"} MB` });
            if (!v("title")) setValues((current) => ({ ...current, title: picked.name.replace(/\.[^/.]+$/, "") }));
          }}
        />
      </Field>
      {file && (
        <p className="m-0 flex items-center gap-2 rounded-control bg-canvas p-2 text-body">
          <FileUp aria-hidden className="size-4 text-primary-700" />
          <span className="flex-1">{file.name} ({file.size})</span>
          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFile(null)} className="grid size-touch place-items-center rounded-control border-0 bg-transparent text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus"><X aria-hidden className="size-4" /></button>
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => onDone(false)}>Cancel</Button>
        <Button type="submit">Save and publish</Button>
      </div>
    </form>
  );
}

interface CategoryItem {
  key: string;
  label: string;
  /** A draft opens in its builder. */
  onEdit?: () => void;
}

function Category({ title, note, icon, type, items, onCreate }: { title: string; note: string; icon: ReactNode; type: ContentType; items: CategoryItem[]; onCreate: (type: ContentType) => void }) {
  const noun = type === "material" ? "material" : type === "activity" ? "assignment" : "assessment";
  return (
    <Card className="flex flex-col">
      {/* Wraps: at 320px "Assessments" and Create can't share a row, and a fixed row pushed Create past the card. */}
      <header className="flex flex-wrap items-start gap-3 border-b border-line p-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-primary-100 text-primary-700 [&>svg]:size-5">{icon}</span>
        <div className="flex min-w-0 flex-1 basis-32 flex-col">
          <h3 className="m-0 font-sans text-card-title font-semibold break-words">{title} <span className="font-normal text-muted">· {items.length}</span></h3>
          <p className="m-0 text-body text-muted">{note}</p>
        </div>
        <Button variant="secondary" aria-label={`Create ${noun}`} onClick={() => onCreate(type)} icon={<Plus aria-hidden className="size-4" />}>Create</Button>
      </header>
      {items.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-4">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-x-3 text-body">
              <span className="min-w-0">{item.label}</span>
              {item.onEdit && (
                <Button variant="ghost" className="max-w-full shrink whitespace-normal" icon={<Pencil aria-hidden className="size-4" />} onClick={item.onEdit}>
                  Edit draft{" "}<span className="sr-only">{item.label}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 p-4 text-body text-muted">No {noun}s added yet.</p>
      )}
    </Card>
  );
}

export function CreateContentTab({ room, content, goTab, open }: ClassTabProps & { open?: ContentType }) {
  const navigate = useNavigate();
  // Assignments and assessments have their own builders (D-040, D-059); the old ?create= links still lead there.
  if (open === "exam") return <Navigate to={instructorPaths.assessmentNew(room.id)} replace />;
  if (open === "activity") return <Navigate to={instructorPaths.assignmentNew(room.id)} replace />;
  const create = (type: ContentType) =>
    type === "exam" ? navigate(instructorPaths.assessmentNew(room.id)) : type === "activity" ? navigate(instructorPaths.assignmentNew(room.id)) : goTab("Create content", { create: type });
  const listed = (item: { id: string; title: string; draft?: boolean }, edit: (id: string) => string): CategoryItem => ({
    key: item.id,
    label: item.draft ? `${item.title} · Draft` : item.title,
    onEdit: item.draft ? () => navigate(edit(item.id)) : undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Create and organize" />
      <p className="m-0 -mt-2 text-body text-muted">Choose what you want to share with this class.</p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Category title="Materials" note="Readings, guides, lecture slides, and files" icon={<BookOpen />} type="material" items={content.materials.map((item) => ({ key: item.id, label: `${item.title} · ${item.kind ?? "Material"}` }))} onCreate={create} />
        <Category title="Assignments" note="Collect student work and provide feedback" icon={<ClipboardList />} type="activity" items={content.activities.map((item) => listed(item, (id) => instructorPaths.assignmentEdit(room.id, id)))} onCreate={create} />
        <Category title="Assessments" note="Build and publish a quiz or exam" icon={<GraduationCap />} type="exam" items={content.exams.map((item) => listed(item, (id) => instructorPaths.assessmentEdit(room.id, id)))} onCreate={create} />
      </div>
      {/* Rubrics belong to the class and are chosen on an assignment (D-063). */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4">
        <p className="m-0 min-w-0 flex-1 basis-60 text-body text-ink">Rubrics list the criteria an assignment is graded on, with points for each level.</p>
        <Button variant="secondary" className="max-w-full shrink whitespace-normal" icon={<ListChecks aria-hidden className="size-4" />} onClick={() => navigate(instructorPaths.rubrics(room.id))}>
          Manage rubrics
        </Button>
      </div>
      {open === "material" && <MaterialForm key={open} room={room} content={content} onDone={(saved) => goTab(saved ? "Materials" : "Create content")} />}
    </div>
  );
}
