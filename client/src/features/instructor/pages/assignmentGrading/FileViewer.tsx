import { useState } from "react";
import { draftFailureMessage } from "../../../../shared/api/assignments";
import type { SubmittedFile } from "../../../../shared/api/overview";
import type { Viewer } from "../../../../shared/api/viewer";
import { Button } from "../../../../shared/ui/Button";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import type { Viewable } from "../../api/assignmentGrading";
import { useStoredFile } from "./useStoredFile";

/**
 * Shows one handed-in file from a blob: a photo as an image, a PDF in the browser's own viewer,
 * a `.txt` as plain text (never as HTML). Word, PowerPoint and Excel never reach here.
 */
export function FileViewer({ file, kind, viewer }: { file: Pick<SubmittedFile, "id" | "name" | "contentType">; kind: Viewable; viewer: Viewer }) {
  const [attempt, setAttempt] = useState(0);
  const state = useStoredFile(viewer, file, kind, attempt);

  return (
    <section aria-label={`Viewer: ${file.name}`} className="flex min-w-0 flex-col gap-2 rounded-control border border-line bg-canvas p-3">
      <h4 className="m-0 text-card-title font-semibold break-words">{file.name}</h4>
      {state.status === "loading" ? (
        <SkeletonGroup label={`Loading ${file.name}`} className="flex flex-col gap-2"><Skeleton className="h-48 w-full" /></SkeletonGroup>
      ) : state.status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-body">
          <p className="m-0 text-danger">Could not open the file. {draftFailureMessage(state.error)}</p>
          <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
        </div>
      ) : "text" in state ? (
        <pre tabIndex={0} role="region" aria-label={`Text of ${file.name}`} className="m-0 max-h-96 overflow-y-auto rounded-control border border-line bg-surface p-3 font-mono text-body break-words whitespace-pre-wrap focus-visible:outline-3 focus-visible:outline-focus">
          {state.text || "This file is empty."}
        </pre>
      ) : kind === "image" ? (
        <img src={state.url} alt={file.name} className="h-auto max-h-[70vh] max-w-full self-start rounded-control border border-line bg-surface object-contain" />
      ) : (
        <iframe src={state.url} title={`PDF: ${file.name}`} className="h-[70vh] min-h-80 w-full rounded-control border border-line bg-surface" />
      )}
    </section>
  );
}
