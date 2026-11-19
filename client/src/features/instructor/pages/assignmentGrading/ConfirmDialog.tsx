import { useRef, useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { focusStudentWork } from "../../api/assignmentGrading";

export interface ConfirmRequest {
  title: string;
  description: string;
  confirm: string;
  tone?: "primary" | "danger";
  /** Runs the change; true when it was stored (the dialog then closes). */
  run: () => Promise<boolean>;
}

/**
 * Asks before a change to one student's terms (C-013). The button that opened it is replaced by
 * its opposite once the change is stored, so focus then goes to the student's work (L-015).
 */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  const confirm = async () => {
    if (!request || busy) return;
    setBusy(true);
    const ok = await request.run();
    setBusy(false);
    if (!ok) return;
    done.current = true;
    onClose();
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {request && (
        <DialogContent
          title={request.title}
          description={request.description}
          onCloseAutoFocus={(event) => {
            if (!done.current) return;
            done.current = false;
            event.preventDefault();
            requestAnimationFrame(focusStudentWork);
          }}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button variant={request.tone ?? "primary"} loading={busy} onClick={() => void confirm()}>{request.confirm}</Button>
            </>
          }
        />
      )}
    </Dialog>
  );
}
