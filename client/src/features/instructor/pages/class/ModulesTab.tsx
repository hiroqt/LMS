import { ArrowDown, ArrowUp, BookOpen, ClipboardList, FolderTree, GraduationCap, MoveRight, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { moduleChoices, moduleTree, reorderSiblings } from "../../../../shared/lib/moduleTree";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Field, Input, Select } from "../../../../shared/ui/Field";
import { IconButton } from "../../../../shared/ui/IconButton";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import { contentByModule, type ModuleItem } from "../../api/selectors";
import type { Module } from "../../api/types";
import type { ClassTabProps } from "./shared";

type Editing = { mode: "add"; parent: Module } | { mode: "rename"; module: Module };

const icons = { material: BookOpen, activity: ClipboardList, exam: GraduationCap } as const;

function ContentList({ label, items, onMove }: { label: string; items: ModuleItem[]; onMove: (item: ModuleItem) => void }) {
  if (!items.length) return <p className="m-0 text-body text-muted">No content in {label} yet.</p>;
  return (
    <ul aria-label={`Content in ${label}`} className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => {
        const Icon = icons[item.kind];
        return (
          <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface p-3 font-sans">
            <Icon aria-hidden className="size-5 shrink-0 text-primary-700" />
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="text-body font-semibold">{item.title}</strong>
              <span className="text-body text-muted">{item.label}</span>
            </span>
            {item.archived && <Badge>Archived</Badge>}
            <Button variant="ghost" icon={<MoveRight aria-hidden className="size-4" />} aria-label={`Move ${item.title}`} onClick={() => onMove(item)}>Move</Button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The class's modules with their submodules and the content placed in each
 * (D-033). Instructors add, rename, and reorder submodules here and move
 * content between modules and submodules.
 */
export function ModulesTab({ room, content, goTab }: ClassTabProps) {
  const toast = useToast();
  const actions = useInstructorActions();
  const tree = moduleTree(content.modules);
  const placed = contentByModule(content);
  const choices = moduleChoices(content.modules);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [moving, setMoving] = useState<ModuleItem | null>(null);
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);

  const openEdit = (next: Editing) => {
    setEditing(next);
    setTitle(next.mode === "rename" ? next.module.title : "");
    setTitleError(undefined);
  };

  const saveTitle = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    const text = title.trim();
    if (!text) return setTitleError("Enter a title.");
    setSaving(true);
    const result = editing.mode === "add" ? await actions.createSubmodule(room.id, editing.parent.id, text) : await actions.renameModule(room.id, editing.module.id, text);
    setSaving(false);
    if (!result.ok) {
      setTitleError(result.fieldErrors?.title?.[0] ?? result.fieldErrors?.parentModuleId?.[0]);
      toast.show({ title: editing.mode === "add" ? "Could not add the submodule" : "Could not rename the submodule", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: editing.mode === "add" ? "Submodule added" : "Submodule renamed", description: text, tone: "success" });
    setEditing(null);
  };

  const reorder = async (siblings: Module[], module: Module, direction: -1 | 1) => {
    const changes = reorderSiblings(siblings, module.id, direction);
    if (!changes.length || reordering) return;
    setReordering(module.id);
    const result = await actions.reorderModules(room.id, changes);
    setReordering(null);
    toast.show(result.ok ? { title: `Moved ${module.title} ${direction < 0 ? "up" : "down"}`, tone: "success" } : { title: "Could not reorder", description: result.message, tone: "danger" });
  };

  const openMove = (item: ModuleItem) => {
    setMoving(item);
    setTarget(choices.find((choice) => placed.get(choice.id)?.some((entry) => entry.kind === item.kind && entry.id === item.id))?.id ?? choices[0]?.id ?? "");
  };

  const saveMove = async (event: FormEvent) => {
    event.preventDefault();
    if (!moving || saving) return;
    setSaving(true);
    const result = await actions.moveContent(room.id, moving, target);
    setSaving(false);
    const where = choices.find((choice) => choice.id === target)?.label ?? "";
    toast.show(result.ok ? { title: `Moved ${moving.title}`, description: `Now in ${where}`, tone: "success" } : { title: "Could not move", description: result.message, tone: "danger" });
    if (result.ok) setMoving(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Modules" description="Units and submodules" count={tree.length} />
      {tree.length ? (
        <div className="flex flex-col gap-4">
          {tree.map(({ module, submodules }) => (
            <Card key={module.id} className="p-5">
              <section aria-labelledby={`module-${module.id}`} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 id={`module-${module.id}`} className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold">
                    <FolderTree aria-hidden className="size-5 text-primary-700" />
                    {module.title}
                  </h3>
                  <Button variant="secondary" icon={<Plus aria-hidden className="size-4" />} aria-label={`Add submodule to ${module.title}`} onClick={() => openEdit({ mode: "add", parent: module })}>
                    Add submodule
                  </Button>
                </div>
                <ContentList label={module.title} items={placed.get(module.id) ?? []} onMove={openMove} />
                {submodules.length > 0 && (
                  <ol aria-label={`Submodules of ${module.title}`} className="m-0 flex list-none flex-col gap-3 border-l-2 border-primary-200 p-0 pl-4">
                    {submodules.map((sub, index) => (
                      <li key={sub.id}>
                        <section aria-labelledby={`module-${sub.id}`} className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 id={`module-${sub.id}`} className="m-0 font-sans text-body-lg font-semibold">{sub.title}</h4>
                            <div className="flex flex-wrap gap-1">
                              <IconButton label={`Move ${sub.title} up`} disabled={index === 0 || Boolean(reordering)} onClick={() => reorder(submodules, sub, -1)}><ArrowUp /></IconButton>
                              <IconButton label={`Move ${sub.title} down`} disabled={index === submodules.length - 1 || Boolean(reordering)} onClick={() => reorder(submodules, sub, 1)}><ArrowDown /></IconButton>
                              <Button variant="ghost" icon={<Pencil aria-hidden className="size-4" />} aria-label={`Rename ${sub.title}`} onClick={() => openEdit({ mode: "rename", module: sub })}>Rename</Button>
                            </div>
                          </div>
                          <ContentList label={sub.title} items={placed.get(sub.id) ?? []} onMove={openMove} />
                        </section>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<FolderTree />} title="No modules yet" action={<Button variant="secondary" onClick={() => goTab("Create content")}>Create content</Button>} />
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.mode === "add" ? `Add a submodule to ${editing.parent.title}` : `Rename ${editing.module.title}`}
            description={editing.mode === "add" ? "Submodules sit one level under a module." : undefined}
          >
            <form onSubmit={saveTitle} noValidate className="flex flex-col gap-4">
              <Field label="Submodule title" required error={titleError}>
                <Input value={title} maxLength={250} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" loading={saving} loadingLabel="Saving…">{editing.mode === "add" ? "Add submodule" : "Save name"}</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(moving)} onOpenChange={(open) => !open && setMoving(null)}>
        {moving && (
          <DialogContent title={`Move ${moving.title}`} description="Choose the module or submodule it belongs to.">
            <form onSubmit={saveMove} noValidate className="flex flex-col gap-4">
              <Field label="Module or submodule">
                <Select value={target} onChange={(event) => setTarget(event.target.value)}>
                  {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
                </Select>
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" loading={saving} loadingLabel="Moving…">Move here</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
