import { useId, type FormEvent, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";

/**
 * A create form in a dialog (a bottom sheet on phones). Validation messages are
 * shown in the form, which stays open until the record is valid.
 */
export function FormDialog({ open, onOpenChange, title, description, error, submitLabel = "Save record", onSubmit, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; error?: string; submitLabel?: string; onSubmit: () => void; children: ReactNode }) {
  const formId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
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
            <Button type="submit" form={formId}>{submitLabel}</Button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
          {children}
          {error && <p role="alert" className="m-0 rounded-control bg-danger-soft p-3 text-body font-medium text-danger">{error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
