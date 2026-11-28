import { ArrowLeft, ArrowRight, FileX2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { fetchMaterialFile, pageCountLabel } from "../../../shared/api/materials";
import { BackLink } from "../../../shared/components/BackLink";
import { ClassDiscussion, PrivateComments } from "../../../shared/components/discussion/Comments";
import { AttachedFile } from "../../../shared/components/files/AttachedFile";
import { MaterialLayout } from "../../../shared/components/materials/MaterialLayout";
import { MaterialPreview, PreviewNotice } from "../../../shared/components/materials/MaterialPreview";
import { modulePath } from "../../../shared/lib/moduleTree";
import { materialSequence } from "../api/selectors";
import type { Material } from "../api/types";
import { useStudentCatalog, useStudentViewer } from "../hooks/useStudentCatalog";
import { studentPaths } from "../paths";

/**
 * One class material: a learning guide to come back to (D-067). The file's preview, its details
 * and Download, what the instructor wrote about it, and the materials before and after it.
 */
export default function MaterialPage() {
  const { materialId = "" } = useParams();
  const navigate = useNavigate();
  const catalog = useStudentCatalog();
  const viewer = useStudentViewer();
  // Kept with the file it was counted from: Previous and Next reuse this page for another material.
  const [pages, setPages] = useState<{ file: number; count: number }>();
  const material = catalog.materials.find((item) => item.id === materialId);
  if (!material) return <Navigate to={studentPaths.classes} replace />;

  const course = catalog.courses.find((item) => item.id === material.courseId);
  const modules = catalog.modules.filter((item) => item.courseId === material.courseId);
  const sequence = materialSequence(catalog, material.courseId);
  const at = sequence.findIndex((item) => item.id === material.id);
  const previous = at > 0 ? sequence[at - 1] : undefined;
  const next = at >= 0 ? sequence[at + 1] : undefined;
  const file = material.file;
  const commentTarget = { classId: material.courseId, kind: "material" as const, id: material.id };

  return (
    <>
      <BackLink label={`Back to ${course?.name ?? "class"}`} onBack={() => navigate(course ? studentPaths.classPage(course.id, "Materials") : studentPaths.classes)} />
      <MaterialLayout
        title={material.title}
        path={[course?.name, material.moduleId ? modulePath(modules, material.moduleId) : undefined].filter(Boolean).join(" › ")}
        facts={[material.kind, `Added ${material.added}${course?.teacher ? ` by ${course.teacher}` : ""}`].join(" · ")}
        preview={
          file ? (
            // Keyed by the file, so a replaced file starts its preview afresh.
            <MaterialPreview key={file.id} viewer={viewer} classId={material.courseId} materialId={material.id} title={material.title} file={file} onPageCount={(count) => setPages({ file: file.id, count })} />
          ) : (
            <PreviewNotice icon={<FileX2 />} title="No file is attached to this material." detail="Your instructor hasn’t added a file to it." />
          )
        }
        file={
          file ? (
            <AttachedFile
              file={file}
              viewer={viewer}
              fetchFile={() => fetchMaterialFile(viewer, material.courseId, material.id, "file")}
              detail={pages?.file === file.id ? pageCountLabel(pages.count, file.type) : undefined}
            />
          ) : (
            <p className="m-0 text-body text-muted">No file attached.</p>
          )
        }
        description={material.summary}
        discussion={<ClassDiscussion viewer={viewer} target={commentTarget} />}
        aside={<PrivateComments viewer={viewer} target={commentTarget} />}
        nav={(previous || next) && <SiblingLinks previous={previous} next={next} onOpen={(item) => navigate(studentPaths.material(item.id))} />}
      />
    </>
  );
}

/** The materials just before and after this one, in the class's module order. */
function SiblingLinks({ previous, next, onOpen }: { previous?: Material; next?: Material; onOpen: (item: Material) => void }) {
  const link = "flex min-h-touch min-w-0 flex-1 basis-60 items-center gap-3 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus";
  return (
    <nav aria-label="Other materials in this class" className="flex flex-wrap gap-3">
      {previous && (
        <button type="button" className={link} onClick={() => onOpen(previous)}>
          <ArrowLeft aria-hidden className="size-5 shrink-0 text-primary-700" />
          <span className="flex min-w-0 flex-col">
            <span className="text-body text-muted">Previous</span>
            <span className="text-body font-semibold break-words">{previous.title}</span>
          </span>
        </button>
      )}
      {next && (
        <button type="button" className={`${link} justify-end text-right`} onClick={() => onOpen(next)}>
          <span className="flex min-w-0 flex-col">
            <span className="text-body text-muted">Next</span>
            <span className="text-body font-semibold break-words">{next.title}</span>
          </span>
          <ArrowRight aria-hidden className="size-5 shrink-0 text-primary-700" />
        </button>
      )}
    </nav>
  );
}
