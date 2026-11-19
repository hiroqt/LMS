import { AlertCircle, File as FileIcon, RotateCcw, X } from "lucide-react";
import { formatBytes } from "../../../../shared/api/assignments";
import { Button } from "../../../../shared/ui/Button";
import type { QueuedUpload } from "../../hooks/uploadQueue";

export interface UploadRowProps {
  upload: QueuedUpload;
  online: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}

/**
 * A chosen file that is not on the draft yet: waiting, uploading with its progress and Cancel, or
 * failed with the reason and Retry (when trying again could help) and Remove.
 */
export function UploadRow({ upload, online, onCancel, onRetry, onRemove }: UploadRowProps) {
  const { file, status } = upload;
  const percent = Math.round(upload.progress * 100);
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        {status === "failed" ? <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" /> : <FileIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body font-medium break-words text-ink">{file.name}</span>
          <span className="text-body text-muted">
            {formatBytes(file.size)} · {status === "uploading" ? `Uploading, ${percent}%` : status === "waiting" ? (online ? "Waiting to upload" : "Waiting for a connection") : "Not added"}
          </span>
        </div>
      </div>
      {status === "uploading" && (
        <progress value={upload.progress} max={1} aria-label={`Uploading ${file.name}`} className="h-2 w-full accent-primary-600" />
      )}
      {upload.error && <p className="m-0 text-body font-medium text-danger">{upload.error}</p>}
      <div className="flex flex-wrap gap-2">
        {status !== "failed" && (
          <Button variant="secondary" onClick={onCancel} aria-label={`Cancel ${file.name}`}><X aria-hidden className="size-4" />Cancel</Button>
        )}
        {status === "failed" && upload.retryable && (
          <Button variant="secondary" onClick={onRetry} disabled={!online} aria-label={`Retry ${file.name}`}><RotateCcw aria-hidden className="size-4" />Retry</Button>
        )}
        {status === "failed" && (
          <Button variant="secondary" onClick={onRemove} aria-label={`Remove ${file.name}`}><X aria-hidden className="size-4" />Remove</Button>
        )}
      </div>
    </div>
  );
}
