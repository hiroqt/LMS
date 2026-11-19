import { useState, type FormEvent } from "react";
import type { Submission } from "../../../../shared/api/overview";
import { Button } from "../../../../shared/ui/Button";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import { useRefreshAssignmentGrading, type StudentRow } from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";

const scoreProblem = (value: string, max: number) => {
  const number = Number(value);
  return value.trim() === "" || Number.isNaN(number) || number < 0 || number > max ? `Enter a score from 0 to ${max}.` : null;
};

interface GradeFormProps {
  classId: string;
  activity: Activity;
  row: StudentRow;
  latest: Submission;
  /** The next student who needs grading, for "Save and next"; absent when there is none. */
  next?: StudentRow;
  onNext: (studentId: string) => void;
}

/** Points and feedback for a student's latest version (or their "not handed in" grade). */
export function GradeForm({ classId, activity, row, latest, next, onNext }: GradeFormProps) {
  const toast = useToast();
  const actions = useInstructorActions();
  const refresh = useRefreshAssignmentGrading();
  const [score, setScore] = useState(latest.score === null ? "" : String(latest.score));
  const [feedback, setFeedback] = useState(latest.feedback ?? "");
  const [errors, setErrors] = useState<{ points?: string; feedback?: string }>({});
  const [saving, setSaving] = useState<"save" | "next" | null>(null);

  const save = async (andNext: boolean) => {
    if (saving) return;
    const problem = scoreProblem(score, activity.maxScore);
    if (problem) {
      setErrors({ points: problem });
      return;
    }
    setSaving(andNext ? "next" : "save");
    const value = Number(score);
    const result = await actions.saveGrade(
      { id: String(latest.id), kind: "activity", classroomId: classId, courseworkId: activity.id, title: activity.title, maxScore: activity.maxScore },
      value,
      feedback,
    );
    await refresh();
    setSaving(null);
    if (!result.ok) {
      setErrors({ points: result.fieldErrors?.points?.[0], feedback: result.fieldErrors?.feedback?.[0] });
      toast.show({ title: "Could not save the grade", description: result.message, tone: "danger" });
      return;
    }
    setErrors({});
    const held = activity.gradeRelease === "returned" ? " Not returned yet." : "";
    const last = andNext && !next ? " No one else needs grading." : "";
    toast.show({ title: "Grade saved", description: `${row.name} · ${value} / ${activity.maxScore}.${held}${last}`, tone: "success" });
    if (andNext && next) onNext(next.studentId);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  return (
    <form onSubmit={submit} noValidate aria-label={`Grade for ${row.name}`} className="flex min-w-0 flex-col gap-4">
      <Field label={`Score (0–${activity.maxScore})`} required error={errors.points}>
        <Input type="number" inputMode="decimal" min={0} max={activity.maxScore} value={score} onChange={(event) => { setScore(event.target.value); setErrors((current) => ({ ...current, points: undefined })); }} />
      </Field>
      <Field label="Feedback" hint={activity.gradeRelease === "returned" ? "Optional. The student sees it once you return their work." : "Optional. The student sees it with their grade."} error={errors.feedback}>
        <Textarea rows={4} value={feedback} onChange={(event) => { setFeedback(event.target.value); setErrors((current) => ({ ...current, feedback: undefined })); }} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" variant="secondary" loading={saving === "save"} disabled={saving !== null}>Save</Button>
        <Button onClick={() => void save(true)} loading={saving === "next"} disabled={saving !== null}>Save and next</Button>
      </div>
    </form>
  );
}

/**
 * A grade for a student who handed in nothing (D-036). The server refuses it until the last day;
 * before then its sentence is shown instead of the form.
 */
export function NoWorkGradeForm({ classId, activity, row, refusal }: { classId: string; activity: Activity; row: StudentRow; refusal: string | null }) {
  const toast = useToast();
  const actions = useInstructorActions();
  const refresh = useRefreshAssignmentGrading();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState("0");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  if (refusal) return <p className="m-0 rounded-control bg-canvas p-3 text-body">{refusal}</p>;
  if (!open) {
    return <Button variant="secondary" className="max-w-full shrink self-start whitespace-normal" onClick={() => setOpen(true)}>Give a grade without work</Button>;
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = scoreProblem(score, activity.maxScore);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const value = Number(score);
    const result = await actions.gradeNotHandedIn(classId, activity.id, row.studentId, value);
    await refresh();
    setSaving(false);
    if (!result.ok) {
      setError(result.fieldErrors?.points?.[0]);
      toast.show({ title: "Could not save the grade", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Grade saved", description: `${row.name} · Not handed in · ${value} / ${activity.maxScore}`, tone: "success" });
  };

  return (
    <form onSubmit={save} noValidate aria-label={`Grade without work for ${row.name}`} className="flex flex-col gap-3">
      <Field label={`Score for ${row.name} (0–${activity.maxScore})`} required error={error}>
        <Input type="number" inputMode="decimal" min={0} max={activity.maxScore} value={score} onChange={(event) => { setScore(event.target.value); setError(undefined); }} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" loading={saving}>Save grade</Button>
      </div>
    </form>
  );
}
