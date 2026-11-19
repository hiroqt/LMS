import { ExternalLink, Paperclip } from "lucide-react";
import type { Submission } from "../../../../shared/api/overview";
import type { Viewer } from "../../../../shared/api/viewer";
import { AttachedFile } from "../../../../shared/components/files/AttachedFile";

/**
 * What one draft or version holds: the written answer, the link, and each file (with its receipt
 * code when `showCodes`). Read-only; a typed file name from before real uploads is shown as it was.
 */
export function WorkContents({ work, viewer, showCodes }: { work: Pick<Submission, "text" | "link" | "files" | "fileName">; viewer: Viewer; showCodes?: boolean }) {
  const text = work.text?.trim();
  return (
    <div className="flex flex-col gap-3">
      {text && (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-body font-medium text-ink">Written answer</p>
          <p className="m-0 max-w-prose rounded-control bg-canvas p-3 text-body break-words whitespace-pre-line">{text}</p>
        </div>
      )}
      {work.link && (
        <p className="m-0 flex flex-wrap items-center gap-x-2 text-body">
          <span className="font-medium">Link</span>
          <a href={work.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-touch min-w-0 items-center gap-1 font-medium break-all text-primary-700 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-focus">
            {work.link}<ExternalLink aria-hidden className="size-4 shrink-0" /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {work.fileName && (
        <p className="m-0 flex items-center gap-2 text-body"><Paperclip aria-hidden className="size-4 shrink-0 text-muted" />File name: {work.fileName}</p>
      )}
      {work.files.length > 0 && (
        <ul aria-label="Files" className="m-0 flex flex-col gap-2 p-0">
          {work.files.map((file) => <li key={file.id} className="list-none"><AttachedFile file={file} viewer={viewer} showCode={showCodes} /></li>)}
        </ul>
      )}
    </div>
  );
}
