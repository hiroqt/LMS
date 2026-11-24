import { useRef, useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { focusStudentWork, studentsLabel, useReturnGrades } from "../../api/assignmentGrading";

export interface ReturnRequest {
  /** One student's name, or null for "Return selected" and "Return all graded". */
  name: string | null;
  /** Students to return to (one, or those selected); undefined returns every graded student. */
  studentIds?: string[];
  count: number;
}

/** Confirms a Return, saying how many students will see their grade, then reports how many did. */
export function ReturnDialog({ classId, assignmentId, title, request, onClose, onReturned }: { classId: string; assignmentId: string; title: string; request: ReturnRequest | null; onClose: () => void; onReturned?: () => void }) {
  const toast = useToast();
  const giveBack = useReturnGrades(classId, assignmentId);
  const [saving, setSaving] = useState(false);
  // After a Return its button is gone or disabled, so focus can't go back to it (L-015).
  const returned = useRef(false);

  const confirm = async () => {
    if (!request) return;
    setSaving(true);
    const result = await giveBack(request.studentIds);
    setSaving(false);
    if (!result.ok) {
      toast.show({ title: "Could not return the work", description: result.message, tone: "danger" });
      return;
    }
    returned.current = true;
    onReturned?.();
    onClose();
    toast.show({ title: `Returned to ${studentsLabel(result.returned)}`, description: result.returned ? "They can now see their grade and feedback." : "Nothing was graded and waiting to be returned.", tone: "success" });
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {request && (
        <DialogContent
          title={request.name ? `Return ${request.name}'s work?` : request.studentIds ? "Return the selected work?" : "Return all graded work?"}
          description={`${studentsLabel(request.count)} will see their grade and feedback for “${title}”.`}
          onCloseAutoFocus={(event) => {
            if (!returned.current) return;
            returned.current = false;
            event.preventDefault();
            requestAnimationFrame(focusStudentWork);
          }}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button loading={saving} onClick={() => void confirm()}>{request.name ? "Return" : `Return to ${studentsLabel(request.count)}`}</Button>
            </>
          }
        />
      )}
    </Dialog>
  );
}
