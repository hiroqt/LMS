import { CalendarClock, CalendarX, UserCheck, UserX } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { formatDue } from "../../../../shared/lib/format";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { focusStudentWork, useStudentExceptions, type StudentRow } from "../../api/assignmentGrading";
import { extendedDue, extensionProblems, extensionStart, ownDatesLabel, type ExtensionForm } from "../../api/exceptions";
import type { Activity } from "../../api/types";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";

/** "Give this student more time": their own due date and, when the assignment has one, their own last day (contract §11). */
function ExtensionDialog({ classId, activity, row, open, onOpenChange }: { classId: string; activity: Activity; row: StudentRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const terms = useStudentExceptions(classId, activity.id);
  const [form, setForm] = useState<ExtensionForm>(() => extensionStart(activity, row.exception));
  const [errors, setErrors] = useState<Partial<Record<keyof ExtensionForm, string>>>({});
  const [refusal, setRefusal] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const saved = useRef(false);
  const lastDay = Boolean(activity.allowLate && activity.closeAt);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const problems = extensionProblems(form, { dueAt: activity.dueAt, closeAt: activity.closeAt, allowLate: activity.allowLate });
    setErrors(problems);
    setRefusal(undefined);
    if (Object.keys(problems).length) return;
    setSaving(true);
    const result = await terms.extend(row.studentId, form);
    setSaving(false);
    if (!result.ok) {
      const fields = { dueAt: result.fieldErrors?.dueAt?.[0], closeAt: result.fieldErrors?.closeAt?.[0] };
      setErrors(fields);
      if (!fields.dueAt && !fields.closeAt) setRefusal(result.message);
      toast.show({ title: "Could not give more time", description: result.message, tone: "danger" });
      return;
    }
    saved.current = true;
    onOpenChange(false);
    toast.show({ title: "More time given", description: `${row.name} · Own due date ${formatDue(new Date(form.dueAt))}.`, tone: "success" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          title={`More time for ${row.name}`}
          description={`The class's due date is ${activity.dueAt ? formatDue(activity.dueAt) : "not set"}${activity.closeAt ? `, and late work is accepted until ${formatDue(activity.closeAt)}` : ""}. Their own dates decide whether their work is late.`}
          onCloseAutoFocus={(event) => {
            if (!saved.current) return;
            saved.current = false;
            event.preventDefault();
            requestAnimationFrame(focusStudentWork);
          }}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" form="extension-form" loading={saving}>Give more time</Button>
            </>
          }
        >
          <form id="extension-form" noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <Field label="Their own due date" required error={errors.dueAt}>
              <Input type="datetime-local" value={form.dueAt} onChange={(event) => { setForm((current) => ({ ...current, dueAt: event.target.value })); setErrors((current) => ({ ...current, dueAt: undefined })); }} />
            </Field>
            {lastDay && (
              <Field label="Their own last day for late work" hint="Optional. Never earlier than the class's last day." error={errors.closeAt}>
                <Input type="datetime-local" value={form.closeAt} onChange={(event) => { setForm((current) => ({ ...current, closeAt: event.target.value })); setErrors((current) => ({ ...current, closeAt: undefined })); }} />
              </Field>
            )}
            {refusal && <p role="alert" className="m-0 text-body font-medium text-danger">{refusal}</p>}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

/**
 * One student's own terms for this assignment: their own dates, and whether they are excused.
 * Each change is asked first and shows the server's sentence when it is refused.
 */
export function StudentTerms({ classId, activity, row }: { classId: string; activity: Activity; row: StudentRow }) {
  const toast = useToast();
  const terms = useStudentExceptions(classId, activity.id);
  const [extending, setExtending] = useState(false);
  const [opened, setOpened] = useState(0);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  const own = extendedDue(activity, row.exception);
  const dates = ownDatesLabel(activity, row.exception);

  const change = (request: Omit<ConfirmRequest, "run">, write: () => Promise<{ ok: boolean; message?: string }>, done: string, failed: string) =>
    setConfirming({
      ...request,
      run: async () => {
        const result = await write();
        if (!result.ok) {
          toast.show({ title: failed, description: result.message, tone: "danger" });
          return false;
        }
        toast.show({ title: done, description: row.name, tone: "success" });
        return true;
      },
    });

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="m-0 text-card-title font-semibold">Dates for {row.name}</h3>
      <p className="m-0 text-body">
        {dates ?? (activity.dueAt ? `Due ${formatDue(activity.dueAt)}, the same as the class.` : "This assignment has no due date, so there is no time to give.")}
      </p>
      {row.excused && <p className="m-0 text-body">Excused. {row.name} can't hand in, and this assignment is left out of their average.</p>}
      <div className="flex flex-wrap gap-2">
        {activity.dueAt && !row.excused && (
          <Button variant="secondary" className="max-w-full shrink whitespace-normal" icon={<CalendarClock aria-hidden className="size-4" />} onClick={() => { setOpened((count) => count + 1); setExtending(true); }}>
            {own ? "Change their own dates" : "Give this student more time"}
          </Button>
        )}
        {own && (
          <Button
            variant="secondary"
            className="max-w-full shrink whitespace-normal"
            icon={<CalendarX aria-hidden className="size-4" />}
            onClick={() => change(
              { title: `Remove ${row.name}'s own dates?`, description: `${row.name} goes back to the class's due date${activity.closeAt ? " and last day" : ""}. Work they handed in after it becomes late.`, confirm: "Remove their own dates", tone: "danger" },
              () => terms.removeExtension(row.studentId),
              "Back to the class's dates",
              "Could not remove their own dates",
            )}
          >
            Remove their own dates
          </Button>
        )}
        {row.excused ? (
          <Button
            variant="secondary"
            className="max-w-full shrink whitespace-normal"
            icon={<UserCheck aria-hidden className="size-4" />}
            onClick={() => change(
              { title: `${row.name} no longer excused?`, description: `${row.name} can hand in again under the usual rules, and this assignment counts in their average.`, confirm: "No longer excused" },
              () => terms.removeExcuse(row.studentId),
              "No longer excused",
              "Could not change the excuse",
            )}
          >
            No longer excused
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="max-w-full shrink whitespace-normal"
            icon={<UserX aria-hidden className="size-4" />}
            onClick={() => change(
              { title: `Excuse ${row.name} from “${activity.title}”?`, description: `${row.name} can't hand in, can't be graded, and this assignment is left out of their average. Work already handed in stays here.`, confirm: "Excuse" },
              () => terms.excuse(row.studentId),
              "Excused",
              "Could not excuse the student",
            )}
          >
            Excuse from this assignment
          </Button>
        )}
      </div>
      {/* Kept mounted so focus can be placed after it closes; a new key on each opening starts the form afresh. */}
      <ExtensionDialog key={opened} classId={classId} activity={activity} row={row} open={extending} onOpenChange={setExtending} />
      <ConfirmDialog request={confirming} onClose={() => setConfirming(null)} />
    </div>
  );
}
