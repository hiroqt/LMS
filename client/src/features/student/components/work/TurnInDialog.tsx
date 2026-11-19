import { AlertTriangle, Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import type { ConfirmItem } from "../../api/work";

export interface TurnInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exactly what will be handed in (`turnInContents`). */
  items: ConfirmItem[];
  /** Turning in now would be late (the server's `turnIn.late`). */
  late: boolean;
  /** When late and the assignment has a penalty: what turning in now would lose (`latePenaltyNow`). */
  latePenalty?: string | null;
  /** The assignment asks the student to confirm "This is my own work". */
  honorStatement: boolean;
  /** Whether this replaces work already turned in. */
  newVersion: boolean;
  busy: boolean;
  onConfirm: (honorStatement: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

/** Asks before turning in, listing what goes to the instructor, and the honor statement when asked. */
export function TurnInDialog({ open, onOpenChange, items, late, latePenalty, honorStatement, newVersion, busy, onConfirm, onCloseAutoFocus }: TurnInDialogProps) {
  const [ownWork, setOwnWork] = useState(false);
  const checkboxId = useId();
  // Each opening asks again: the box starts unticked.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOwnWork(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={newVersion ? "Turn in this new version?" : "Turn in your work?"}
        description="Your instructor will see exactly this."
        onCloseAutoFocus={onCloseAutoFocus}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Keep working</Button></DialogClose>
            <Button onClick={() => onConfirm(ownWork)} loading={busy} loadingLabel="Turning in…" disabled={honorStatement && !ownWork}>
              <Send aria-hidden className="size-4" />Turn in
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <dl className="m-0 flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.label} className="flex flex-wrap gap-x-2">
                <dt className="font-medium">{item.label}:</dt>
                <dd className="m-0 min-w-0 break-words">{item.value}</dd>
              </div>
            ))}
          </dl>
          {late && (
            <p className="m-0 flex items-start gap-2 rounded-control bg-warning-soft p-3 text-body text-ink">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" /><span>The due date has passed. This turn-in will be marked late.{latePenalty && <> {latePenalty}</>}</span>
            </p>
          )}
          {honorStatement && (
            <label htmlFor={checkboxId} className="flex min-h-touch cursor-pointer items-center gap-3 text-body font-medium">
              <input id={checkboxId} type="checkbox" checked={ownWork} onChange={(event) => setOwnWork(event.target.checked)} className="size-5 shrink-0 accent-primary-600" />
              This is my own work
            </label>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
