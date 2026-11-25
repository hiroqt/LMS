import { CloudOff, FileX2, Maximize2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { formatBytes } from "../../api/assignments";
import { describeApiError, isApiError } from "../../api/http";
import { dataSaverOn, previewPlan, previewWaits, TEXT_PREVIEW_BYTES, type MaterialFile } from "../../api/materials";
import type { Viewer } from "../../api/viewer";
import { useMaterialFile } from "../../hooks/useMaterialFile";
import { useObjectUrl } from "../../hooks/useObjectUrl";
import { Button } from "../../ui/Button";
import { Dialog, DialogContent } from "../../ui/Dialog";
import { IconButton } from "../../ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../ui/Skeleton";

const PdfPages = lazy(() => import("./PdfPages"));

export interface MaterialPreviewProps {
  viewer: Viewer;
  classId: string;
  materialId: number | string;
  /** The material's title: the preview's accessible name and an image's description. */
  title: string;
  file: MaterialFile;
  /** Told the page count once a PDF drawn here is read. */
  onPageCount?: (count: number) => void;
}

/**
 * The preview of a material's file, the same for students and instructors (D-067). PDFs, images,
 * and text are shown as they are; a Word, PowerPoint, or Excel file shows the PDF copy the server
 * made. Big files, and phones with data saver on, wait for a tap that says the size. Downloading is
 * the page's own button, beside this.
 */
export function MaterialPreview({ viewer, classId, materialId, title, file, onPageCount }: MaterialPreviewProps) {
  const plan = previewPlan(file);
  const [requested, setRequested] = useState(false);
  const [saveData] = useState(dataSaverOn);
  const waits = previewWaits(file, plan, saveData) && !requested;
  const query = useMaterialFile(viewer, classId, materialId, file.id, plan.kind === "none" ? "file" : plan.source, plan.kind !== "none" && !waits);
  const url = useObjectUrl(query.data);
  const [full, setFull] = useState(false);

  if (plan.kind === "none") {
    const reason =
      plan.reason === "off"
        ? "Previews of Word, PowerPoint, and Excel files are turned off on this server."
        : plan.reason === "failed"
          ? "A preview couldn’t be made for this file."
          : "This file type can’t be previewed.";
    return <PreviewNotice icon={<FileX2 />} title={reason} detail="Download the file to open it." />;
  }

  if (waits) {
    return (
      <PreviewNotice
        icon={<CloudOff />}
        title={`This file is ${formatBytes(file.size)}.`}
        detail={saveData ? "Data saver is on, so the preview waits until you ask for it." : "Large files wait until you ask, so they don’t use your data by surprise."}
        action={<Button variant="secondary" onClick={() => setRequested(true)}>Load preview ({formatBytes(file.size)})</Button>}
      />
    );
  }

  if (query.isError) {
    const offline = isApiError(query.error) && query.error.kind === "network" && typeof navigator !== "undefined" && navigator.onLine === false;
    const { title: problem } = describeApiError(query.error);
    return (
      <PreviewNotice
        icon={<CloudOff />}
        title={offline ? "The preview needs a connection." : "The preview didn’t load."}
        detail={offline ? "It loads when you’re back online." : problem}
        action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}
      />
    );
  }

  if (!query.data || !url) {
    return (
      <SkeletonGroup label="Loading the preview">
        <Skeleton className="aspect-[4/3] w-full" />
      </SkeletonGroup>
    );
  }

  const content = (expanded: boolean) =>
    plan.kind === "image" ? (
      <img src={url} alt={title} className={`mx-auto block w-auto max-w-full rounded-control border border-line bg-surface object-contain ${expanded ? "max-h-[80dvh]" : "max-h-[75dvh]"}`} />
    ) : plan.kind === "text" ? (
      <TextPreview blob={query.data} title={title} />
    ) : nativePdfViewer() ? (
      <iframe src={url} title={`Preview of ${title}`} className={`block w-full rounded-control border border-line bg-surface ${expanded ? "h-[80dvh]" : "h-[75dvh]"}`} />
    ) : (
      <Suspense fallback={<SkeletonGroup label="Loading the PDF viewer"><Skeleton className="aspect-[3/4] w-full" /></SkeletonGroup>}>
        <PdfPages blob={query.data} title={title} tall={expanded} onPageCount={expanded ? undefined : onPageCount} />
      </Suspense>
    );

  // Text reads fine in place; a PDF drawn here and an image get more room in a full-screen view.
  const expandable = plan.kind === "image" || (plan.kind === "pdf" && !nativePdfViewer());
  return (
    <div className="flex flex-col gap-2">
      {expandable && (
        <div className="flex justify-end">
          <IconButton label={`Open ${title} full screen`} variant="secondary" onClick={() => setFull(true)}>
            <Maximize2 />
          </IconButton>
        </div>
      )}
      {content(false)}
      {expandable && (
        <Dialog open={full} onOpenChange={setFull}>
          {full && (
            <DialogContent title={title} className="h-[100dvh] max-h-[100dvh] sm:h-[94dvh] sm:max-h-[94dvh] sm:max-w-[min(94vw,80rem)]">
              {content(true)}
            </DialogContent>
          )}
        </Dialog>
      )}
    </div>
  );
}

/**
 * Computers' browsers show a PDF well in a frame. Phones and tablets don't (Android has no
 * viewer, and an iPhone frame shows one page as a picture), so there the pages are drawn here.
 */
function nativePdfViewer(): boolean {
  if (typeof navigator === "undefined" || navigator.pdfViewerEnabled !== true) return false;
  return typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** The start of a text file, as written; the rest is a download away. */
function TextPreview({ blob, title }: { blob: Blob; title: string }) {
  const [text, setText] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    void blob.slice(0, TEXT_PREVIEW_BYTES).text().then((value) => !cancelled && setText(value));
    return () => {
      cancelled = true;
    };
  }, [blob]);
  if (text === undefined) return null;
  return (
    <div className="flex flex-col gap-2">
      <pre
        role="region"
        aria-label={`Preview of ${title}`}
        tabIndex={0}
        className="m-0 max-h-[75dvh] overflow-auto rounded-control border border-line bg-surface p-4 font-mono text-body break-words whitespace-pre-wrap text-ink focus-visible:outline-3 focus-visible:outline-focus"
      >
        {text}
      </pre>
      {blob.size > TEXT_PREVIEW_BYTES && <p className="m-0 text-body text-muted">Showing the first {formatBytes(TEXT_PREVIEW_BYTES)}. Download the file for the rest.</p>}
    </div>
  );
}

export function PreviewNotice({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-5">
      <span aria-hidden className="grid size-10 place-items-center rounded-control bg-primary-50 text-primary-700 [&>svg]:size-5">{icon}</span>
      <div className="flex flex-col gap-1">
        <p className="m-0 text-body-lg font-semibold text-ink">{title}</p>
        <p className="m-0 text-body text-muted">{detail}</p>
      </div>
      {action}
    </div>
  );
}
