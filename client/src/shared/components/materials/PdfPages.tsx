import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Skeleton, SkeletonGroup } from "../../ui/Skeleton";

/*
 * pdf.js draws a PDF's pages where the browser has no PDF viewer of its own (phones, D-067).
 * This module is the only one that imports it, and it is loaded with React.lazy, so pdf.js and
 * its worker are downloaded only by someone who opens a PDF here. The budget exception and the
 * install-cache exclusion are in scripts/bundle-budget.ts and vite.config.ts.
 */
GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPagesProps {
  blob: Blob;
  title: string;
  /** Told how many pages there are once the PDF is read. */
  onPageCount?: (count: number) => void;
  /** In the full-screen view: use more of the height. */
  tall?: boolean;
}

/** Every page, fitted to the width, drawn when it comes near the screen, with a text layer for reading aloud and selecting. */
export default function PdfPages({ blob, title, onPageCount, tall = false }: PdfPagesProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const width = useContentWidth(frame);
  // Kept in a ref: a new callback each render must not reload the PDF.
  const reportCount = useRef(onPageCount);
  useEffect(() => {
    reportCount.current = onPageCount;
  });

  useEffect(() => {
    let cancelled = false;
    const loading = blob.arrayBuffer().then((data) => getDocument({ data: new Uint8Array(data), enableXfa: false }));
    loading
      .then((task) => task.promise)
      .then((loaded) => {
        if (cancelled) return;
        setDoc(loaded);
        reportCount.current?.(loaded.numPages);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      void loading.then((task) => task.destroy()).catch(() => undefined);
    };
  }, [blob]);

  if (failed) return <p role="alert" className="m-0 rounded-control border border-line bg-surface p-4 text-body">This PDF can’t be shown here. Download it to open it.</p>;

  return (
    <div
      ref={frame}
      role="region"
      aria-label={`Preview of ${title}`}
      tabIndex={0}
      className={`flex flex-col gap-3 overflow-y-auto rounded-control border border-line bg-canvas p-2 focus-visible:outline-3 focus-visible:outline-focus sm:p-3 ${tall ? "max-h-[80dvh]" : "max-h-[75dvh]"}`}
    >
      {doc && width > 0 ? (
        Array.from({ length: doc.numPages }, (_, index) => <PdfPage key={index} doc={doc} number={index + 1} count={doc.numPages} width={width} />)
      ) : (
        <SkeletonGroup label="Loading the pages">
          <Skeleton className="aspect-[3/4] w-full" />
        </SkeletonGroup>
      )}
    </div>
  );
}

function PdfPage({ doc, number, count, width }: { doc: PDFDocumentProxy; number: number; count: number; width: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  // The first pages draw at once; the rest when scrolled near (all at once without IntersectionObserver).
  const [near, setNear] = useState(() => number <= 2 || typeof IntersectionObserver === "undefined");
  const [box, setBox] = useState<{ height: number; scale: number }>();

  useEffect(() => {
    if (near || !holder.current) return;
    const watcher = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    watcher.observe(holder.current);
    return () => watcher.disconnect();
  }, [near]);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | undefined;
    void (async () => {
      const page = await doc.getPage(number);
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      if (cancelled) return;
      setBox({ height: viewport.height, scale });
      if (!near || !canvas.current || !text.current) return;
      // Sharp on high-density screens: draw at the device's pixel ratio, show at CSS size.
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.current.width = Math.floor(viewport.width * ratio);
      canvas.current.height = Math.floor(viewport.height * ratio);
      task = page.render({ canvas: canvas.current, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (cancelled) return;
      text.current.replaceChildren();
      await new TextLayer({ textContentSource: page.streamTextContent(), container: text.current, viewport }).render();
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, number, width, near]);

  // pdf.js sizes the text layer from these (its own viewer sets them on each page).
  const style = { width, height: box?.height ?? (width * 4) / 3, "--total-scale-factor": box?.scale ?? 1, "--scale-round-x": "1px", "--scale-round-y": "1px" } as CSSProperties;
  return (
    <div ref={holder} role="group" aria-label={`Page ${number} of ${count}`} className="relative shrink-0 self-center overflow-hidden border border-line bg-surface" style={style}>
      <canvas ref={canvas} aria-hidden className="block size-full" />
      <div ref={text} className="pdf-text-layer" />
    </div>
  );
}

/** The inner width of the scrolling frame, kept up to date as it resizes. */
function useContentWidth(frame: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      // Whole pixels, so a scrollbar appearing doesn't redraw every page by a fraction.
      setWidth(Math.floor(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame]);
  return width;
}
