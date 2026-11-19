import { Camera, FolderOpen, Send, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { acceptFor, draftFailureMessage, fileTypeList, refusalBeforeUpload, removeDraftFile, saveDraft, turnInDraft, uploadDraftFile } from "../../../../shared/api/assignments";
import type { Submission, SubmittedFile, TurnIn } from "../../../../shared/api/overview";
import { AttachedFile } from "../../../../shared/components/files/AttachedFile";
import type { HandInSettings } from "../../../../shared/lib/assignmentRules";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { studentKeys } from "../../api/student";
import { canRetry, filesLeftLabel, hasWork, isWebAddress, shouldRetrySave, turnInContents, withRow } from "../../api/work";
import { useAutosave } from "../../hooks/useAutosave";
import { pendingCount } from "../../hooks/uploadQueue";
import { useUploadQueue } from "../../hooks/useUploadQueue";
import { useStudentViewer } from "../../hooks/useStudentCatalog";
import { SaveStatusNote } from "../SaveStatusNote";
import { TurnInDialog } from "./TurnInDialog";
import { UploadRow } from "./UploadRow";

interface DraftChange {
  text: string;
  link: string;
}

export interface DraftEditorProps {
  classId: string;
  assessmentId: string;
  settings: HandInSettings;
  turnIn: TurnIn;
  /** The draft, or undefined before the first save or upload creates it. */
  draft: Submission | undefined;
  /** Work is already turned in, so this draft is a new version. */
  newVersion: boolean;
  online: boolean;
  setRows: (change: (rows: Submission[] | undefined) => Submission[]) => void;
  /** Refreshes the overview, so `turnIn` and the rest of the workspace are current. */
  refresh: () => Promise<void>;
  /** Called once the work is turned in; the receipt is on the page then. */
  onTurnedIn: () => void;
}

const PHOTO_ACCEPT = ".jpg,.jpeg,.png";

/** A file input inside a label styled as a button, so the input itself carries the name and focus. */
function FileButton({ label, icon, accept, multiple, capture, disabled, onFiles, className }: {
  label: string; icon: ReactNode; accept: string; multiple?: boolean; capture?: "environment"; disabled: boolean; onFiles: (files: File[]) => void; className?: string;
}) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    // Clear the input, so choosing the same file again (after Remove) still reports a change.
    event.target.value = "";
    if (files.length) onFiles(files);
  };
  return (
    <label className={cn(
      "inline-flex min-h-touch items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-sans text-body font-medium text-ink",
      "focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-focus",
      disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-primary-50",
      className,
    )}>
      {icon}
      {label}
      <input type="file" className="sr-only" accept={accept} multiple={multiple} capture={capture} disabled={disabled} onChange={choose} />
    </label>
  );
}

/**
 * The draft: a written answer and a link that save themselves, files that upload one by one, and
 * Turn in. Opening the page creates nothing; the first save or upload creates the draft.
 */
export function DraftEditor({ classId, assessmentId, settings, turnIn, draft, newVersion, online, setRows, refresh, onTurnedIn }: DraftEditorProps) {
  const viewer = useStudentViewer();
  const toast = useToast();
  const queryClient = useQueryClient();
  const kinds = settings.submissionKinds;
  // Until the draft exists, whichever request arrives first creates it and a second one at the
  // same moment is refused. So the first upload and a save never overlap: the upload waits for
  // the save in flight, and a save waits for the first upload (L-086).
  const hasDraft = useRef(Boolean(draft));
  useLayoutEffect(() => {
    hasDraft.current = Boolean(draft);
  });
  const firstUpload = useRef<Promise<unknown> | null>(null);
  const headingId = useId();
  const [text, setText] = useState(draft?.text ?? "");
  const [link, setLink] = useState(draft?.link ?? "");
  const [linkError, setLinkError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [turningIn, setTurningIn] = useState(false);
  const [removing, setRemoving] = useState<SubmittedFile | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  // After a removal its Remove button is gone, so focus goes to the Files heading; after
  // "Keep file" Radix returns it to the Remove button as usual.
  const removed = useRef(false);

  /** A draft row just answered by the server: into the list, and the overview refreshed when it was new. */
  const stored = (row: Submission) => {
    setRows((rows) => withRow(rows, row));
    if (!draft) void refresh();
  };

  const body = (change: DraftChange) => ({
    text: kinds.includes("text") && change.text.trim() ? change.text : null,
    // An address that isn't valid yet keeps the saved one, so the written answer still saves.
    link: !kinds.includes("link") || !change.link.trim() ? null : isWebAddress(change.link) ? change.link.trim() : (draft?.link ?? null),
  });

  const { status, announcement, autosaver } = useAutosave<DraftChange>({
    keyOf: () => "draft",
    save: async (changes) => {
      const last = changes[changes.length - 1];
      if (!last) return;
      if (firstUpload.current) await firstUpload.current.catch(() => undefined);
      stored(await saveDraft(viewer, classId, assessmentId, body(last)));
    },
    shouldRetry: shouldRetrySave,
    onFailure: (failure) => toast.show({ title: "Your work was not saved", description: draftFailureMessage(failure), tone: "danger" }),
  });

  const uploads = useUploadQueue({
    upload: async (file, options) => {
      // The draft's text goes first; see `firstUpload` above for the other direction.
      await autosaver.flush();
      const sending = uploadDraftFile(viewer, classId, assessmentId, file, options);
      if (!hasDraft.current) {
        firstUpload.current = sending;
        void sending.catch(() => undefined).finally(() => {
          if (firstUpload.current === sending) firstUpload.current = null;
        });
      }
      return sending;
    },
    onStored: (row, file) => {
      stored(row);
      toast.show({ title: "File added", description: file.name, tone: "success" });
    },
    describe: (failure) => ({ message: draftFailureMessage(failure), retryable: canRetry(failure) }),
    onFailed: (file, message) => toast.show({ title: `Could not add ${file.name}`, description: message, tone: "danger" }),
    // A cancel can land after the server stored the file; reading the draft again shows what is really on it.
    onCancelled: () => void queryClient.invalidateQueries({ queryKey: studentKeys.work(viewer.id, assessmentId) }),
  }, !online);

  const files = draft?.files ?? [];
  const used = files.length + pendingCount(uploads.queue);
  const roomLeft = settings.maxFiles - used;
  const busyUploading = uploads.queue.some((item) => item.status !== "failed");
  const linkValid = !link.trim() || isWebAddress(link);
  const ready = hasWork({ text: kinds.includes("text") ? text : null, link: kinds.includes("link") && linkValid ? link.trim() || null : null, files });

  const edit = (next: Partial<DraftChange>) => {
    const change = { text, link, ...next };
    if (next.text !== undefined) setText(next.text);
    if (next.link !== undefined) {
      setLink(next.link);
      if (linkError && (!next.link.trim() || isWebAddress(next.link))) setLinkError("");
    }
    autosaver.change(change, false);
  };

  const choose = (chosen: File[]) => {
    uploads.add(chosen.map((file) => ({ file, refusal: refusalBeforeUpload(file, settings.allowedFileTypes) })));
  };

  const openTurnIn = async () => {
    if (!(await autosaver.flush())) {
      toast.show({ title: "Your work is not saved yet", description: "Wait for “Saved”, then turn in.", tone: "danger" });
      return;
    }
    setConfirming(true);
  };

  const turnInNow = async (honorStatement: boolean) => {
    setTurningIn(true);
    await autosaver.stop();
    try {
      const { submission, receipt } = await turnInDraft(viewer, classId, assessmentId, honorStatement);
      setConfirming(false);
      setRows((rows) => withRow(rows, submission));
      toast.show({ title: newVersion ? "New version turned in" : "Turned in", description: `Version ${receipt.attemptNumber}${receipt.late ? " · Late" : ""}`, tone: "success" });
      onTurnedIn();
      void refresh();
    } catch (failure) {
      autosaver.resume();
      toast.show({ title: "Could not turn in your work", description: draftFailureMessage(failure), tone: "danger" });
    } finally {
      setTurningIn(false);
    }
  };

  const removeFile = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const row = await removeDraftFile(viewer, classId, assessmentId, removing.id);
      setRows((rows) => withRow(rows, row));
      toast.show({ title: "File removed", description: removing.name, tone: "success" });
      removed.current = true;
      setRemoving(null);
    } catch (failure) {
      toast.show({ title: `Could not remove ${removing.name}`, description: draftFailureMessage(failure), tone: "danger" });
    } finally {
      setRemoveBusy(false);
    }
  };

  const focusFiles = (event: Event) => {
    if (!removed.current) return;
    removed.current = false;
    event.preventDefault();
    requestAnimationFrame(() => document.getElementById(`${headingId}-files`)?.focus());
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} tabIndex={-1} className="m-0 font-sans text-card-title font-semibold outline-none">{newVersion ? "New version" : "Your draft"}</h3>

      {kinds.includes("text") && (
        <Field label="Written answer" hint="Plain text. It saves as you type.">
          <Textarea value={text} onChange={(event) => edit({ text: event.target.value })} rows={6} maxLength={20_000} readOnly={turningIn} />
        </Field>
      )}
      {kinds.includes("link") && (
        <Field label="Link" hint="A full web address, for example https://docs.example.com/my-work." error={linkError || undefined}>
          <Input type="url" inputMode="url" autoComplete="url" value={link} readOnly={turningIn} onChange={(event) => edit({ link: event.target.value })}
            onBlur={() => setLinkError(linkValid ? "" : "Enter a full web address that starts with https:// or http://.")} maxLength={2_000} />
        </Field>
      )}
      {(kinds.includes("text") || kinds.includes("link")) && <SaveStatusNote status={status} announcement={announcement} />}

      {kinds.includes("file") && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h4 id={`${headingId}-files`} tabIndex={-1} className="m-0 font-sans text-body font-semibold outline-none">Files</h4>
            <p className="m-0 text-body text-muted">{fileTypeList(settings.allowedFileTypes)}. {filesLeftLabel(settings.maxFiles, used)}</p>
          </div>
          {files.length > 0 && (
            <ul aria-label="Files on your draft" className="m-0 flex flex-col gap-2 p-0">
              {files.map((file) => (
                <li key={file.id} className="list-none">
                  <AttachedFile file={file} viewer={viewer} onRemove={() => setRemoving(file)} />
                </li>
              ))}
            </ul>
          )}
          {uploads.queue.length > 0 && (
            <ul aria-label="Uploads" className="m-0 flex flex-col gap-2 p-0">
              {uploads.queue.map((item) => (
                <li key={item.key} className="list-none">
                  <UploadRow upload={item} online={online} onCancel={() => uploads.cancel(item.key)} onRetry={() => uploads.retry(item.key)} onRemove={() => uploads.remove(item.key)} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <FileButton label="Choose files" icon={<FolderOpen aria-hidden className="size-4" />} accept={acceptFor(settings.allowedFileTypes)} multiple disabled={!online || roomLeft <= 0} onFiles={choose} />
            {settings.allowedFileTypes.includes("image") && (
              <FileButton label="Take a photo" icon={<Camera aria-hidden className="size-4" />} accept={PHOTO_ACCEPT} capture="environment" disabled={!online || roomLeft <= 0} onFiles={choose} className="hidden pointer-coarse:inline-flex" />
            )}
          </div>
        </div>
      )}

      {!online && (
        <p role="status" className="m-0 flex items-center gap-2 text-body font-medium text-ink">
          <WifiOff aria-hidden className="size-4 shrink-0" />You’re offline. Uploading files and turning in need a connection.{(kinds.includes("text") || kinds.includes("link")) && " Your typing stays here and saves when you reconnect."}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        {turnIn.late && <p className="m-0 text-body text-ink">The due date has passed. Work turned in now is marked late.</p>}
        {!ready && <p className="m-0 text-body text-muted">Add your work to turn it in.</p>}
        <Button onClick={() => void openTurnIn()} disabled={!online || !ready || busyUploading || !linkValid} className="self-start">
          <Send aria-hidden className="size-4" />{newVersion ? "Turn in new version" : "Turn in"}
        </Button>
      </div>

      <TurnInDialog
        open={confirming}
        // While the turn-in is on its way the dialog stays, and the answer can't be edited: nothing typed then could be saved.
        onOpenChange={(open) => !turningIn && setConfirming(open)}
        items={turnInContents(draft, kinds)}
        late={turnIn.late}
        honorStatement={settings.honorStatement}
        newVersion={newVersion}
        busy={turningIn}
        onConfirm={(honor) => void turnInNow(honor)}
      />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent
          title={removing ? `Remove ${removing.name}?` : "Remove file?"}
          description="It comes off your draft. Work you already turned in keeps its files."
          onCloseAutoFocus={focusFiles}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Keep file</Button></DialogClose>
              <Button variant="danger" onClick={() => void removeFile()} loading={removeBusy} loadingLabel="Removing…">Remove file</Button>
            </>
          }
        />
      </Dialog>
    </section>
  );
}
