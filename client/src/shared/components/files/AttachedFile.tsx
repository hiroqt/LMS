import { Download, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { draftFailureMessage, fetchStoredFile, fileKindLabel, fileTypeOf, formatBytes, saveBlob } from "../../api/assignments";
import type { SubmittedFile } from "../../api/overview";
import type { Viewer } from "../../api/viewer";
import { IconButton } from "../../ui/IconButton";
import { useToast } from "../../ui/toast/useToast";
import { FileTypeIcon } from "./FileTypeIcon";

export interface AttachedFileProps {
  file: Pick<SubmittedFile, "id" | "name" | "contentType" | "size"> & { code?: string };
  /** Who downloads it; the server checks they may. */
  viewer: Viewer;
  /** Where the bytes come from; a turn-in file (`/api/files/{id}`) when not given. A class material passes its own route. */
  fetchFile?: () => Promise<{ blob: Blob }>;
  /** One more fact after the size, e.g. "12 pages". */
  detail?: string;
  /** Shows the file's receipt code ("9F2C-41AB") after its size. */
  showCode?: boolean;
  /** Extra facts on the second line, e.g. a "Same file as another student" badge. */
  note?: ReactNode;
  /** Shows a Remove button; the caller confirms and removes. */
  onRemove?: () => void;
  removing?: boolean;
}

/**
 * One uploaded file: what it is, how big, and a Download button. The bytes are fetched with the
 * viewer's headers and saved from a blob, because a link to the API can't carry them (L-075).
 * Used on the student's work card, the receipt, the instructor's grading page, and a class
 * material's page.
 */
export function AttachedFile({ file, viewer, fetchFile, detail, showCode, note, onRemove, removing }: AttachedFileProps) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { blob } = await (fetchFile ? fetchFile() : fetchStoredFile(viewer, file.id));
      saveBlob(blob, file.name);
    } catch (failure) {
      toast.show({ title: "Could not download the file", description: draftFailureMessage(failure), tone: "danger" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-surface py-1 pr-1 pl-3">
      <FileTypeIcon type={fileTypeOf(file.contentType)} className="size-5 shrink-0 text-muted" />
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className="text-body font-medium break-words text-ink">{file.name}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-body text-muted">
          <span>{fileKindLabel(file)} · {formatBytes(file.size)}{detail && <> · {detail}</>}{showCode && <> · Code {file.code}</>}</span>
          {note}
        </span>
      </div>
      <IconButton label={`Download ${file.name}`} onClick={download} loading={downloading}><Download /></IconButton>
      {onRemove && <IconButton label={`Remove ${file.name}`} onClick={onRemove} loading={removing}><Trash2 /></IconButton>}
    </div>
  );
}
