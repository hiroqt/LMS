import { CloudAlert, CloudCheck, CloudUpload, ShieldCheck } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { SAVE_STATUS_LABELS, type SaveStatus } from "../hooks/autosave";

const ICONS: Record<SaveStatus, typeof ShieldCheck> = { idle: ShieldCheck, saving: CloudUpload, saved: CloudCheck, retrying: CloudAlert, failed: CloudAlert };

/**
 * The autosave state on screen, with a polite status for screen readers that
 * says only "Saved" or "Not saved…" when that changes (never "Saving…" after
 * each pause in typing).
 */
export function SaveStatusNote({ status, announcement }: { status: SaveStatus; announcement: string }) {
  const Icon = ICONS[status];
  const problem = status === "retrying" || status === "failed";
  return (
    <p className={cn("m-0 flex items-center gap-2 text-body", problem ? "font-semibold text-danger" : "text-muted")}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {/* Screen readers hear the status below instead, except for the opening line. */}
      <span aria-hidden={status === "idle" ? undefined : true}>{SAVE_STATUS_LABELS[status]}</span>
      <span role="status" className="sr-only">{announcement}</span>
    </p>
  );
}
