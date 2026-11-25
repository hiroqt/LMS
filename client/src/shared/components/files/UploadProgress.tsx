import { Button } from "../../ui/Button";

export interface UploadProgressProps {
  name: string;
  /** 0 to 1 as the bytes leave the browser. */
  fraction: number;
  /** What the server is doing once every byte is sent, e.g. "Checking the file". */
  finishing: string;
  onCancel: () => void;
}

/**
 * An upload on its way: how far, then what the server is doing. It can be stopped while the bytes
 * are sent; once they all are, the server finishes the job, so stopping then would only hide it.
 */
export function UploadProgress({ name, fraction, finishing, onCancel }: UploadProgressProps) {
  const percent = Math.round(fraction * 100);
  const sent = fraction >= 1;
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="m-0 min-w-0 flex-1 basis-48 text-body break-words text-ink">
          {sent ? `${finishing}…` : `Uploading ${name}: ${percent}%`}
        </p>
        {!sent && <Button variant="ghost" className="max-w-full shrink whitespace-normal" onClick={onCancel}>Cancel upload</Button>}
      </div>
      <div role="progressbar" aria-label={`Uploading ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-primary-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
