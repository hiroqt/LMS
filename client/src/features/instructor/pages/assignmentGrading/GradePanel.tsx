import { useRef, useState, type FormEvent } from "react";
import { describeApiError } from "../../../../shared/api/http";
import type { Submission } from "../../../../shared/api/overview";
import { chosenLevels, rubricTotal } from "../../../../shared/api/rubrics";
import { RubricView } from "../../../../shared/components/assignment/RubricView";
import { latePenaltyRule } from "../../../../shared/lib/assignmentRules";
import { Button } from "../../../../shared/ui/Button";
import { Field, Input } from "../../../../shared/ui/Field";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import {
  hasLatePenalty,
  penaltySum,
  rubricErrorsFrom,
  rubricProblems,
  useAssignmentRubric,
  useGradeWork,
  useRefreshAssignmentGrading,
  type StudentRow,
} from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";
import { FeedbackField } from "./FeedbackField";

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

/**
 * Points (or a rubric) and feedback for a student's latest version, or their "not handed in"
 * grade. The points are the raw points; late work on an assignment with a penalty shows the sum
 * and can have the penalty waived (contract §10). With a rubric, a level for every criterion
 * (§12); a "not handed in" grade still takes plain points.
 */
export function GradeForm({ classId, activity, row, latest, next, onNext }: GradeFormProps) {
  const toast = useToast();
  const grade = useGradeWork(classId, activity.id);
  const byRubric = Boolean(activity.rubricId) && !latest.notHandedIn;
  const rubric = useAssignmentRubric(classId, activity.id, byRubric ? activity.rubricId : undefined);
  const [score, setScore] = useState(latest.rawScore === null ? (latest.score === null ? "" : String(latest.score)) : String(latest.rawScore));
  const [chosen, setChosen] = useState<Record<number, number>>(() => chosenLevels(latest.rubricScores));
  const [feedback, setFeedback] = useState(latest.feedback ?? "");
  const [waived, setWaived] = useState(latest.penaltyWaived);
  const [errors, setErrors] = useState<{ points?: string; feedback?: string; rubric?: Record<number, string | undefined> }>({});
  const [saving, setSaving] = useState<"save" | "next" | null>(null);
  const rubricRef = useRef<HTMLDivElement>(null);

  const late = !latest.notHandedIn && latest.daysLate > 0;
  const penalised = late && hasLatePenalty(activity);
  const raw = byRubric ? (rubric.data ? rubricTotal(rubric.data, chosen).points : null) : score.trim() === "" || Number.isNaN(Number(score)) ? null : Number(score);
  const sum = penalised && raw !== null ? penaltySum(activity, { raw, daysLate: latest.daysLate, waived }) : null;

  const save = async (andNext: boolean) => {
    if (saving) return;
    let input: { points?: number; rubric?: Record<number, number> };
    if (byRubric) {
      if (!rubric.data) return;
      const problems = rubricProblems(rubric.data, chosen);
      if (Object.keys(problems).length) {
        setErrors({ rubric: problems });
        // The first criterion without a level, once its message is on screen.
        requestAnimationFrame(() => rubricRef.current?.querySelector<HTMLInputElement>("fieldset[aria-describedby] input")?.focus());
        return;
      }
      input = { rubric: chosen };
    } else {
      const problem = scoreProblem(score, activity.maxScore);
      if (problem) {
        setErrors({ points: problem });
        return;
      }
      input = { points: Number(score) };
    }
    setSaving(andNext ? "next" : "save");
    const result = await grade(latest.id, { ...input, feedback, ...(penalised ? { waivePenalty: waived } : {}) });
    setSaving(null);
    if (!result.ok) {
      setErrors({ points: result.fieldErrors?.points?.[0], feedback: result.fieldErrors?.feedback?.[0], rubric: rubricErrorsFrom(result.fieldErrors) });
      toast.show({ title: "Could not save the grade", description: result.message, tone: "danger" });
      return;
    }
    setErrors({});
    const after = result.saved?.score ?? raw ?? 0;
    const penalty = result.saved && result.saved.penaltyPercent > 0 ? ` after the ${result.saved.penaltyPercent}% late penalty` : "";
    const held = activity.gradeRelease === "returned" ? " Not returned yet." : "";
    const last = andNext && !next ? " No one else needs grading." : "";
    toast.show({ title: "Grade saved", description: `${row.name} · ${after} / ${activity.maxScore}${penalty}.${held}${last}`, tone: "success" });
    if (andNext && next) onNext(next.studentId);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  let points;
  if (!byRubric) {
    points = (
      <Field
        label={`Score (0–${activity.maxScore})`}
        required
        hint={penalised ? "The points you give, before the late penalty." : undefined}
        error={errors.points}
      >
        <Input type="number" inputMode="decimal" min={0} max={activity.maxScore} value={score} onChange={(event) => { setScore(event.target.value); setErrors((current) => ({ ...current, points: undefined })); }} />
      </Field>
    );
  } else if (rubric.isPending) {
    points = <SkeletonGroup label="Loading the rubric" className="flex flex-col gap-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24 w-full" /></SkeletonGroup>;
  } else if (rubric.isError) {
    const { title, detail } = describeApiError(rubric.error);
    points = (
      <div role="alert" className="flex flex-col gap-2 rounded-control bg-canvas p-3 text-body">
        <p className="m-0">{title}. {detail}</p>
        <Button variant="secondary" className="self-start" onClick={() => void rubric.refetch()}>Try again</Button>
      </div>
    );
  } else {
    points = (
      <div ref={rubricRef} className="@container flex flex-col gap-2">
        <h4 className="m-0 text-card-title font-semibold">Rubric: {rubric.data.title}</h4>
        <RubricView
          rubric={rubric.data}
          chosen={chosen}
          name={`grade-${latest.id}`}
          errors={errors.rubric}
          disabled={saving !== null}
          onChoose={(criterionId, levelId) => {
            setChosen((current) => ({ ...current, [criterionId]: levelId }));
            setErrors((current) => ({ ...current, rubric: { ...current.rubric, [criterionId]: undefined } }));
          }}
        />
      </div>
    );
  }

  const rule = latePenaltyRule({ dueAt: activity.dueAt ?? null, allowLate: Boolean(activity.allowLate), latePenaltyPercentPerDay: activity.latePenaltyPercentPerDay ?? 0, latePenaltyMaxPercent: activity.latePenaltyMaxPercent ?? 100 });

  return (
    <form onSubmit={submit} noValidate aria-label={`Grade for ${row.name}`} className="flex min-w-0 flex-col gap-4">
      {points}
      {penalised && (
        <div className="flex flex-col gap-2 rounded-control bg-canvas p-3">
          {rule && <p className="m-0 text-body">{rule}</p>}
          <p className="m-0 text-body font-semibold" aria-live="polite">{sum ?? (byRubric ? "Choose the levels to see the score after the penalty." : "Enter the points to see the score after the penalty.")}</p>
          <label className="flex min-h-touch cursor-pointer items-center gap-3 font-sans text-body text-ink">
            <input type="checkbox" checked={waived} onChange={(event) => setWaived(event.target.checked)} className="size-5 shrink-0 accent-primary-600" />
            <span>Waive the late penalty for this student</span>
          </label>
        </div>
      )}
      <FeedbackField
        value={feedback}
        onChange={(value) => { setFeedback(value); setErrors((current) => ({ ...current, feedback: undefined })); }}
        error={errors.feedback}
        hint={activity.gradeRelease === "returned" ? "Optional. The student sees it once you return their work." : "Optional. The student sees it with their grade."}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" variant="secondary" loading={saving === "save"} disabled={saving !== null || (byRubric && !rubric.data)}>Save</Button>
        <Button onClick={() => void save(true)} loading={saving === "next"} disabled={saving !== null || (byRubric && !rubric.data)}>Save and next</Button>
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
