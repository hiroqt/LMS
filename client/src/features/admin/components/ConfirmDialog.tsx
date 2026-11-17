import type { ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";

/** Confirms a destructive action and names what it affects (C-013). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: ReactNode; confirmLabel: string; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
