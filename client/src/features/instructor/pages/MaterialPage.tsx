import { Archive, ArchiveRestore, FileUp, FileX2, RefreshCw, Trash2, Unlink } from "lucide-react";
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { fetchMaterialFile, MATERIAL_ACCEPT, materialFileRefusal } from "../../../shared/api/materials";
import type { Viewer } from "../../../shared/api/viewer";
import { BackLink } from "../../../shared/components/BackLink";
import { AttachedFile } from "../../../shared/components/files/AttachedFile";
import { UploadProgress } from "../../../shared/components/files/UploadProgress";
import { MaterialLayout } from "../../../shared/components/materials/MaterialLayout";
import { MaterialPreview, PreviewNotice } from "../../../shared/components/materials/MaterialPreview";
import { formatDay } from "../../../shared/lib/format";
import { modulePath } from "../../../shared/lib/moduleTree";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { useToast } from "../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../api/actions";
import { classContent, subjectOf } from "../api/selectors";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

/**
 * One class material as the instructor sees it (D-067): the same preview students get, and the
 * instructor's changes: upload or replace the file, remove it, archive or restore, delete.
 */
export default function MaterialPage() {
  const { classId = "", materialId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const actions = useInstructorActions();
  const { store, instructor, rooms } = useInstructorWorkspace();
  const [pages, setPages] = useState<number>();
  const [confirm, setConfirm] = useState<"remove" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; fraction: number; office: boolean } | null>(null);
  const upload = useRef<AbortController | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const room = rooms.find((item) => item.id === classId);
  const content = room ? classContent(store, room.id) : null;
  const material = content?.materials.find((item) => item.id === materialId);
  if (!room || !content) return <Navigate to={instructorPaths.classes()} replace />;
  if (!material) return <Navigate to={instructorPaths.classPage(room.id, "Materials")} replace />;

  const viewer: Viewer = { id: instructor.id, role: "instructor" };
  const subject = subjectOf(store, room);
  const archived = material.status === "archived";
  const file = material.file ?? null;
  const backToMaterials = () => navigate(instructorPaths.classPage(room.id, "Materials"));

  const send = async (picked: File) => {
    const refusal = materialFileRefusal(picked);
    if (refusal) {
      toast.show({ title: "Could not add the file", description: refusal, tone: "danger" });
      return;
    }
    upload.current = new AbortController();
    setProgress({ name: picked.name, fraction: 0, office: /\.(docx|pptx|xlsx)$/i.test(picked.name) });
    const result = await actions.replaceMaterialFile(room.id, material.id, picked, {
      onProgress: (fraction) => setProgress((current) => (current ? { ...current, fraction } : current)),
      signal: upload.current.signal,
    });
    setProgress(null);
    upload.current = null;
    if (result.cancelled) return;
    toast.show(result.ok ? { title: file ? "File replaced" : "File added", description: picked.name, tone: "success" } : { title: "Could not add the file", description: result.message, tone: "danger" });
  };

  const run = async (change: () => Promise<{ ok: boolean; message?: string }>, done: string, failed: string) => {
    setBusy(true);
    const result = await change();
    setBusy(false);
    setConfirm(null);
    toast.show(result.ok ? { title: done, description: material.title, tone: "success" } : { title: failed, description: result.message, tone: "danger" });
    return result.ok;
  };

  const preview = file ? (
    <MaterialPreview key={file.id} viewer={viewer} classId={room.id} materialId={material.id} title={material.title} file={file} onPageCount={setPages} />
  ) : (
    <PreviewNotice
      icon={<FileX2 />}
      title={material.fileName ? `Only the name “${material.fileName}” was saved, before files could be uploaded.` : "No file is attached yet."}
      detail="Upload the file so students can open it."
    />
  );

  const fileSection = (
    <>
      {file ? (
        <AttachedFile
          file={file}
          viewer={viewer}
          fetchFile={() => fetchMaterialFile(viewer, room.id, material.id, "file")}
          detail={pages ? pageCount(pages, file.type === "powerpoint" ? "slide" : "page") : undefined}
        />
      ) : (
        <p className="m-0 text-body text-muted">No file attached.</p>
      )}
      {progress && (
        <UploadProgress name={progress.name} fraction={progress.fraction} finishing={progress.office ? "Checking the file and making its preview" : "Checking the file"} onCancel={() => upload.current?.abort()} />
      )}
      <input
        ref={picker}
        type="file"
        accept={MATERIAL_ACCEPT}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (picked) void send(picked);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={Boolean(progress)} icon={file ? <RefreshCw aria-hidden className="size-4" /> : <FileUp aria-hidden className="size-4" />} onClick={() => picker.current?.click()}>
          {file ? "Replace file" : "Upload file"}
        </Button>
        {file && (
          <Button variant="ghost" disabled={Boolean(progress)} icon={<Unlink aria-hidden className="size-4" />} onClick={() => setConfirm("remove")}>Remove file</Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button
          variant="ghost"
          loading={busy && confirm === null}
          icon={archived ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
          onClick={() => void run(() => actions.setMaterialArchived(room.id, material.id, !archived), archived ? "Material restored" : "Material archived", "Could not change the material")}
        >
          {archived ? "Restore" : "Archive"}
        </Button>
        <Button variant="ghost" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setConfirm("delete")}>Delete material</Button>
      </div>
      {archived && <p className="m-0 text-body text-muted">Archived: students don’t see this material or its file.</p>}
    </>
  );

  return (
    <>
      <BackLink label="Back to materials" onBack={backToMaterials} />
      <MaterialLayout
        title={material.title}
        path={[`${subject?.title ?? "Class"} · ${room.section}`, modulePath(content.modules, material.moduleId)].filter(Boolean).join(" › ")}
        facts={[material.kind ?? "Class material", material.createdAt ? `Added ${formatDay(material.createdAt)}` : null].filter(Boolean).join(" · ")}
        status={archived ? <Badge tone="warning">Archived</Badge> : undefined}
        preview={preview}
        file={fileSection}
        description={material.description}
      />

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && !busy && setConfirm(null)}>
        {confirm === "remove" && file && (
          <DialogContent
            title="Remove this file?"
            description={`“${file.name}” will be taken off “${material.title}”. The material stays; students see it without a file.`}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep file</Button></DialogClose>
                <Button variant="danger" loading={busy} onClick={() => void run(() => actions.removeMaterialFile(room.id, material.id), "File removed", "Could not remove the file")}>Remove file</Button>
              </>
            }
          />
        )}
        {confirm === "delete" && (
          <DialogContent
            title="Delete this material?"
            description={`“${material.title}”${file ? " and its file" : ""} will be removed from this class for you and your students. This cannot be undone.`}
            onCloseAutoFocus={(event) => event.preventDefault()}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep material</Button></DialogClose>
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={async () => {
                    if (await run(() => actions.deleteMaterial(room.id, material.id), "Material deleted", "Could not delete the material")) backToMaterials();
                  }}
                >
                  Delete material
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </>
  );
}

/** "1 page", "12 slides" */
const pageCount = (count: number, noun: "page" | "slide") => `${count} ${noun}${count === 1 ? "" : "s"}`;
