import { useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { focusStudentWork, gradedMissingSentence, studentsLabel, useGradeEveryoneMissing } from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";

/**
 * "Give N to everyone who didn't hand in" (D-036) for this assignment: a confirmation with the
 * points. Before the last day the server's sentence is shown instead. Excused students are not
 * counted; a student whose own last day has not passed is skipped, and the toast says how many.
 */
export function GradeEveryoneMissing({ classId, activity, missing, refusal }: { classId: string; activity: Activity; missing: number; refusal: string | null }) {
  const toast = useToast();
  const gradeMissing = useGradeEveryoneMissing(classId, activity.id);
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("0");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  if (missing === 0) return null;

  const giveAll = async () => {
    const value = Number(points);
    if (points.trim() === "" || Number.isNaN(value) || value < 0 || value > activity.maxScore) {
      setError(`Enter a score from 0 to ${activity.maxScore}.`);
      return;
    }
    setSaving(true);
    const result = await gradeMissing(value);
    setSaving(false);
    if (!result.ok) {
      setError(result.fieldErrors?.points?.[0]);
      toast.show({ title: "Could not save the grades", description: result.message, tone: "danger" });
      return;
    }
    setOpen(false);
    // Usually nobody is missing any more, so this section and its button are gone; focus goes to the work shown (L-015).
    requestAnimationFrame(focusStudentWork);
    toast.show({ title: result.graded ? "Grades saved" : "No grades given", description: gradedMissingSentence(result.graded, result.waiting, `${value} / ${activity.maxScore}`), tone: "success" });
  };

  return (
    <section aria-labelledby="missing-heading" className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-4">
      <h2 id="missing-heading" className="m-0 text-card-title font-semibold">Didn't hand in</h2>
      <p className="m-0 text-body">{studentsLabel(missing)} handed in nothing and {missing === 1 ? "has" : "have"} no grade.</p>
      {refusal ? (
        <p className="m-0 text-body text-muted">{refusal}</p>
      ) : (
        <Button variant="secondary" className="max-w-full shrink self-start whitespace-normal" onClick={() => { setPoints("0"); setError(undefined); setOpen(true); }}>
          Give 0 to everyone who didn't hand in
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent
            title="Grade everyone who didn't hand in?"
            description={`${studentsLabel(missing)} with nothing handed in for “${activity.title}” get this score. Work already handed in is not changed.`}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button loading={saving} onClick={() => void giveAll()}>Give the grade</Button>
              </>
            }
          >
            <Field label={`Points for each student (0–${activity.maxScore})`} required error={error}>
              <Input type="number" inputMode="decimal" min={0} max={activity.maxScore} value={points} onChange={(event) => { setPoints(event.target.value); setError(undefined); }} />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
