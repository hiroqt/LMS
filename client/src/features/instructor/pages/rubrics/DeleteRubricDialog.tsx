import { CircleAlert } from "lucide-react";
import { useRef, useState } from "react";
import type { Rubric } from "../../../../shared/api/rubrics";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { useToast } from "../../../../shared/ui/toast/useToast";
import type { RubricResult } from "../../api/rubrics";

/**
 * Confirms deleting a rubric, naming it (C-013). The server refuses one an assignment uses or a
 * grade has used (409); its sentence is shown here and the dialog stays open. After a delete the
 * card that opened it is gone, so focus goes to `onGone` (the page heading).
 */
export function DeleteRubricDialog({ rubric, onClose, onDelete, onGone }: { rubric: Rubric | null; onClose: () => void; onDelete: (id: number) => Promise<RubricResult>; onGone: () => void }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [refused, setRefused] = useState("");
  // A ref, not state: the closing content runs the handler it last rendered with.
  const deleted = useRef(false);

  const close = () => {
    setRefused("");
    onClose();
  };

  const remove = async () => {
    if (!rubric || deleting) return;
    setDeleting(true);
    const result = await onDelete(rubric.id);
    setDeleting(false);
    if (!result.ok) {
      setRefused(result.message ?? "The rubric was not deleted.");
      toast.show({ title: "Could not delete the rubric", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Rubric deleted", description: rubric.title, tone: "success" });
    deleted.current = true;
    close();
  };

  return (
    <Dialog open={rubric !== null} onOpenChange={(open) => !open && close()}>
      {rubric && (
        <DialogContent
          title={`Delete “${rubric.title}”?`}
          description="It is removed from this class's rubrics. This can't be undone."
          onCloseAutoFocus={(event) => {
            if (!deleted.current) return;
            event.preventDefault();
            deleted.current = false;
            onGone();
          }}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button variant="danger" loading={deleting} loadingLabel="Deleting…" onClick={() => void remove()}>Delete rubric</Button>
            </>
          }
        >
          {refused && (
            <p role="alert" className="m-0 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3 font-medium text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {refused}
            </p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
