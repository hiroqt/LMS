import { Archive, ArchiveRestore, Download, FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { moduleChoices, modulePath } from "../../../../shared/lib/moduleTree";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Field, Select } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import type { Material } from "../../api/types";
import { RESOURCE_TYPES } from "./classUtils";
import { ListSearch, type ClassTabProps } from "./shared";

/** Demo download: a text summary named like the file (no file contents are stored). */
function download(material: Material, context: { section: string; subject: string; module: string }) {
  const fileName = material.fileName || `${material.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.${material.fileType || "pdf"}`;
  const body = [
    "TMCC LEARNING MATERIAL",
    "=====================================",
    `Classroom: ${context.section}`,
    `Subject: ${context.subject}`,
    `Unit: ${context.module}`,
    `Title: ${material.title}`,
    `Type: ${material.kind ?? "Class material"}`,
    "",
    material.description || "Classroom learning reference and study material.",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function MaterialsTab({ room, subject, instructor, content, goTab }: ClassTabProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [moduleId, setModuleId] = useState("all");
  const [kind, setKind] = useState("all");
  const [inspect, setInspect] = useState<Material | null>(null);
  const [removing, setRemoving] = useState<Material | null>(null);
  const q = query.trim().toLowerCase();
  const parentOf = new Map(content.modules.map((item) => [item.id, item.parentId]));
  const shown = content.materials.filter(
    (item) =>
      (!q || `${item.title} ${item.description ?? ""} ${item.fileName ?? ""}`.toLowerCase().includes(q)) &&
      // A module shows its submodules' materials too.
      (moduleId === "all" || item.moduleId === moduleId || parentOf.get(item.moduleId) === moduleId) &&
      (kind === "all" || item.kind === kind),
  );
  const moduleTitle = (id: string) => modulePath(content.modules, id) ?? "Unit";
  const filtered = Boolean(q) || moduleId !== "all" || kind !== "all";

  const actions = useInstructorActions();
  const archive = async (item: Material) => {
    const archived = item.status !== "archived";
    const result = await actions.setMaterialArchived(room.id, item.id, archived);
    toast.show(result.ok ? { title: archived ? "Material archived" : "Material restored", description: item.title } : { title: "Could not change the material", description: result.message, tone: "danger" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading eyebrow="Readings, guides, and files" title="Class materials" count={shown.length} />
        <Button onClick={() => goTab("Create content", { create: "material" })} icon={<Plus aria-hidden className="size-4" />}>Add material</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-3 sm:items-end">
        <ListSearch label="Search materials" placeholder="Search materials or files..." value={query} onChange={setQuery} />
        <Field label="Unit / module">
          <Select value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
            <option value="all">All units &amp; modules</option>
            {moduleChoices(content.modules).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </Field>
        <Field label="Resource type">
          <Select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">All resource types</option>
            {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </Field>
        {filtered && <Button variant="ghost" className="sm:col-span-3 sm:justify-self-start" onClick={() => { setQuery(""); setModuleId("all"); setKind("all"); }}>Clear filters</Button>}
      </div>
      {shown.length ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => {
            const archived = item.status === "archived";
            return (
              <li key={item.id} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 font-sans">
                <div className="flex items-start justify-between gap-2">
                  <span aria-hidden className="grid size-10 place-items-center rounded-control bg-info-soft text-info"><FileText className="size-5" /></span>
                  <span className="flex flex-wrap justify-end gap-1">
                    <Badge>{(item.fileType ?? "pdf").toUpperCase()}</Badge>
                    {archived && <Badge tone="warning">Archived</Badge>}
                  </span>
                </div>
                <span className="text-label font-semibold tracking-wide text-primary-700 uppercase">{item.kind ?? "Class material"}</span>
                <button type="button" onClick={() => setInspect(item)} className="self-start rounded-control border-0 bg-transparent p-0 text-left text-card-title font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus">
                  {item.title}
                </button>
                <p className="m-0 line-clamp-2 text-body text-muted">{item.description || "Classroom learning reference and study material."}</p>
                <p className="m-0 text-body text-muted">{item.fileSize ?? "1.8 MB"} · {item.downloads ?? 0} downloads · {moduleTitle(item.moduleId)}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button variant="secondary" icon={<Download aria-hidden className="size-4" />} aria-label={`Download ${item.title}`} onClick={() => download(item, { section: room.section, subject: subject?.title ?? "", module: moduleTitle(item.moduleId) })}>Download</Button>
                  <Button variant="ghost" icon={archived ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />} aria-label={`${archived ? "Restore" : "Archive"} ${item.title}`} onClick={() => archive(item)}>
                    {archived ? "Restore" : "Archive"}
                  </Button>
                  <Button variant="ghost" icon={<Trash2 aria-hidden className="size-4" />} aria-label={`Delete ${item.title}`} onClick={() => setRemoving(item)}>Delete</Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<FileText />}
          title={content.materials.length ? "No materials match these filters" : "No materials yet"}
          action={<Button variant="secondary" onClick={() => goTab("Create content", { create: "material" })}>Add material</Button>}
        />
      )}

      <Dialog open={Boolean(inspect)} onOpenChange={(open) => !open && setInspect(null)}>
        {inspect && (
          <DialogContent title={inspect.title} description={inspect.kind ?? "Class material"}>
            <dl className="m-0 grid grid-cols-2 gap-3">
              {[
                ["Curriculum module", moduleTitle(inspect.moduleId)],
                ["File name", inspect.fileName ?? "—"],
                ["File size", inspect.fileSize ?? "1.8 MB"],
                ["Uploaded by", inspect.uploadedBy ?? `${instructor.firstName} ${instructor.lastName}`],
                ["Downloads", String(inspect.downloads ?? 0)],
                ["Status", inspect.status === "archived" ? "Archived" : "Active"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col"><dt className="text-body text-muted">{label}</dt><dd className="m-0 text-body font-medium">{value}</dd></div>
              ))}
            </dl>
            <p className="m-0 mt-3 text-body">{inspect.description || "Classroom learning reference and study material."}</p>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        {removing && (
          <DialogContent
            title="Delete this material?"
            description={`“${removing.title}” will be removed from this class for you and your students. This cannot be undone.`}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep material</Button></DialogClose>
                <Button
                  variant="danger"
                  onClick={async () => {
                    const result = await actions.deleteMaterial(room.id, removing.id);
                    toast.show(result.ok ? { title: "Material deleted", description: removing.title } : { title: "Could not delete the material", description: result.message, tone: "danger" });
                    setRemoving(null);
                  }}
                >
                  Delete material
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </div>
  );
}
