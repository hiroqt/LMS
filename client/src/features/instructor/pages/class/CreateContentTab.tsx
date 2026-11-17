import { BookOpen, ClipboardList, FileUp, GraduationCap, Plus, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { moduleChoices } from "../../../../shared/lib/moduleTree";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import { QuestionSetPicker } from "../../components/QuestionSetPicker";
import type { ContentType } from "../../paths";
import { RESOURCE_TYPES } from "./classUtils";
import type { ClassTabProps } from "./shared";

type Errors = Record<string, string | undefined>;

type QuestionSource = "new" | "existing";

/** Write new questions (the default) or reuse one of the instructor's question sets (D-034). */
function SourceChoice({ value, onChange }: { value: QuestionSource; onChange: (value: QuestionSource) => void }) {
  const choices: Array<[QuestionSource, string]> = [["new", "Write new questions"], ["existing", "Use an existing question set"]];
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 font-sans">
      <legend className="mb-1 p-0 text-body font-medium text-ink">Questions</legend>
      {choices.map(([id, label]) => (
        <label key={id} className="flex min-h-touch cursor-pointer items-center gap-3 text-body text-ink">
          <input type="radio" name="question-source" value={id} checked={value === id} onChange={() => onChange(id)} className="size-5 accent-primary-600" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 font-sans text-body text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-primary-600" />
      {label}
    </label>
  );
}

const titles: Record<ContentType, string> = { material: "Upload class material", activity: "Create an assignment", exam: "Create an assessment" };

function ContentForm({ type, room, content, onDone }: Pick<ClassTabProps, "room" | "content"> & { type: ContentType; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const choices = moduleChoices(content.modules);
  const [values, setValues] = useState<Record<string, string>>({ moduleId: choices[0]?.id ?? "", kind: "Study guide", points: "10", timeLimit: "0", attempts: "1", correctIndex: "0", questionSetId: "" });
  const [flags, setFlags] = useState({ allowLate: false, allowResubmission: false });
  const [file, setFile] = useState<{ name: string; type: string; size: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [source, setSource] = useState<QuestionSource>("new");
  const reuse = type === "exam" && source === "existing";
  const set = (key: string) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const v = (key: string) => values[key] ?? "";

  const validate = (): Errors => {
    const next: Errors = { title: v("title").trim() ? undefined : "Enter a title." };
    if (type !== "material" && !reuse) {
      const points = Number(v("points"));
      next.points = v("points") && points > 0 ? undefined : "Enter points greater than 0.";
    }
    if (type === "exam") {
      const attempts = Number(v("attempts"));
      next.attempts = Number.isInteger(attempts) && attempts >= 1 && attempts <= 20 ? undefined : "Allow 1 to 20 attempts.";
    }
    if (reuse) next.questionSetId = v("questionSetId") ? undefined : "Choose a question set.";
    else if (type === "exam") {
      next.prompt = v("prompt").trim() ? undefined : "Enter the question.";
      for (const n of [1, 2, 3, 4]) next[`option${n}`] = v(`option${n}`).trim() ? undefined : `Enter answer choice ${n}.`;
    }
    return next;
  };

  const actions = useInstructorActions();
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const common = { moduleId: v("moduleId"), title: v("title"), instructions: v("instructions"), dueAt: v("dueAt"), points: Number(v("points")) };
    setSaving(true);
    const result =
      type === "material"
        ? await actions.createMaterial(room.id, { moduleId: v("moduleId"), title: v("title"), kind: v("kind"), description: v("description"), fileName: file?.name, fileType: file?.type, fileSize: file?.size })
        : type === "activity"
          ? await actions.createActivity(room.id, { ...common, ...flags })
          : await actions.createExam(room.id, {
              ...common,
              timeLimit: Number(v("timeLimit")),
              attempts: Number(v("attempts")),
              ...(reuse
                ? { source: "existing" as const, questionSetId: Number(v("questionSetId")) }
                : { source: "new" as const, subjectId: room.ismsSubjectId, prompt: v("prompt"), options: [1, 2, 3, 4].map((n) => v(`option${n}`)), correctIndex: Number(v("correctIndex")) }),
            });
    setSaving(false);
    if (!result.ok) {
      // Show the server's messages on the matching fields.
      setErrors(Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([field, messages]) => [field === "maxPoints" ? "points" : field === "questionnaireId" ? "questionSetId" : field === "maxAttempts" ? "attempts" : field, messages[0]])));
      toast.show({ title: "Could not publish", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: `${type === "material" ? "Material" : type === "activity" ? "Assignment" : "Assessment"} published`, description: v("title").trim(), tone: "success" });
    onDone(true);
  };

  const label = type === "material" ? "Material title" : type === "activity" ? "Assignment title" : "Assessment title";
  return (
    <form onSubmit={submit} noValidate aria-labelledby="content-form-title" className="flex flex-col gap-4 rounded-card border border-primary-200 bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 id="content-form-title" className="m-0 font-sans text-section font-semibold">{titles[type]}</h3>
        <p className="m-0 text-body text-muted">This content will be shared with {room.section}.</p>
      </div>
      <Field label="Curriculum Unit / Module" hint="A module, or one of its submodules.">
        <Select value={v("moduleId")} onChange={set("moduleId")}>
          {choices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Select>
      </Field>
      <Field label={label} required error={errors.title}>
        <Input value={v("title")} onChange={set("title")} />
      </Field>
      {type === "material" ? (
        <>
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
        </>
      ) : (
        <>
          <Field label="Instructions">
            <Textarea value={v("instructions")} onChange={set("instructions")} rows={3} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Due date" hint="Leave empty for no due date.">
              <Input type="datetime-local" value={v("dueAt")} onChange={set("dueAt")} />
            </Field>
            {!reuse && (
              <Field label="Points" required error={errors.points}>
                <Input type="number" inputMode="numeric" min={1} value={v("points")} onChange={set("points")} />
              </Field>
            )}
          </div>
          {type === "activity" ? (
            <div className="flex flex-col">
              <Check label="Accept late work" checked={flags.allowLate} onChange={(value) => setFlags((current) => ({ ...current, allowLate: value }))} />
              <Check label="Allow resubmission" checked={flags.allowResubmission} onChange={(value) => setFlags((current) => ({ ...current, allowResubmission: value }))} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Time limit (minutes, 0 for none)">
                  <Input type="number" inputMode="numeric" min={0} value={v("timeLimit")} onChange={set("timeLimit")} />
                </Field>
                <Field label="Attempts allowed" required error={errors.attempts}>
                  <Input type="number" inputMode="numeric" min={1} max={20} value={v("attempts")} onChange={set("attempts")} />
                </Field>
              </div>
              <SourceChoice value={source} onChange={setSource} />
              {reuse ? (
                <QuestionSetPicker
                  subjectId={room.ismsSubjectId}
                  value={v("questionSetId")}
                  onChange={(value) => setValues((current) => ({ ...current, questionSetId: value }))}
                  error={errors.questionSetId}
                />
              ) : (
              <>
              <Field label="Question" required error={errors.prompt}>
                <Input value={v("prompt")} onChange={set("prompt")} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((n) => (
                  <Field key={n} label={`Answer choice ${n}`} required error={errors[`option${n}`]}>
                    <Input value={v(`option${n}`)} onChange={set(`option${n}`)} />
                  </Field>
                ))}
              </div>
              <Field label="Correct answer">
                <Select value={v("correctIndex")} onChange={set("correctIndex")}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n - 1}>Answer choice {n}</option>)}
                </Select>
              </Field>
              </>
              )}
            </>
          )}
        </>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => onDone(false)}>Cancel</Button>
        <Button type="submit">Save and publish</Button>
      </div>
    </form>
  );
}

function Category({ title, note, icon, type, items, onCreate }: { title: string; note: string; icon: ReactNode; type: ContentType; items: string[]; onCreate: (type: ContentType) => void }) {
  const noun = type === "material" ? "material" : type === "activity" ? "assignment" : "assessment";
  return (
    <Card className="flex flex-col">
      <header className="flex items-start gap-3 border-b border-line p-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-primary-100 text-primary-700 [&>svg]:size-5">{icon}</span>
        <div className="flex flex-1 flex-col">
          <h3 className="m-0 font-sans text-card-title font-semibold">{title} <span className="font-normal text-muted">· {items.length}</span></h3>
          <p className="m-0 text-body text-muted">{note}</p>
        </div>
        <Button variant="secondary" aria-label={`Create ${noun}`} onClick={() => onCreate(type)} icon={<Plus aria-hidden className="size-4" />}>Create</Button>
      </header>
      {items.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-4">
          {items.map((item) => <li key={item} className="text-body">{item}</li>)}
        </ul>
      ) : (
        <p className="m-0 p-4 text-body text-muted">No {noun}s added yet.</p>
      )}
    </Card>
  );
}

export function CreateContentTab({ room, content, goTab, open }: ClassTabProps & { open?: ContentType }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Create and organize" />
      <p className="m-0 -mt-2 text-body text-muted">Choose what you want to share with this class.</p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Category title="Materials" note="Readings, guides, lecture slides, and files" icon={<BookOpen />} type="material" items={content.materials.map((item) => `${item.title} · ${item.kind ?? "Material"}`)} onCreate={(type) => goTab("Create content", { create: type })} />
        <Category title="Assignments" note="Collect student work and provide feedback" icon={<ClipboardList />} type="activity" items={content.activities.map((item) => item.title)} onCreate={(type) => goTab("Create content", { create: type })} />
        <Category title="Assessments" note="Build and publish a quiz or exam" icon={<GraduationCap />} type="exam" items={content.exams.map((item) => item.title)} onCreate={(type) => goTab("Create content", { create: type })} />
      </div>
      {open && (
        <ContentForm
          key={open}
          type={open}
          room={room}
          content={content}
          onDone={(saved) => goTab(saved ? (open === "material" ? "Materials" : "Classwork") : "Create content")}
        />
      )}
    </div>
  );
}
