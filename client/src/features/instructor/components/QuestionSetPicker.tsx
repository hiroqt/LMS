import { describeApiError } from "../../../shared/api/http";
import { Button } from "../../../shared/ui/Button";
import { Field, Select } from "../../../shared/ui/Field";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { setFacts, setsForSubject, useQuestionSets } from "../api/questionSets";

export interface QuestionSetPickerProps {
  /** The class's ISMS subject: only that subject's sets are offered. */
  subjectId: number | undefined;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Picks one of the instructor's question sets for a new exam (D-034). */
export function QuestionSetPicker({ subjectId, value, onChange, error }: QuestionSetPickerProps) {
  const sets = useQuestionSets();
  if (sets.isPending) {
    return (
      <SkeletonGroup label="Loading your question sets" className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-11 w-full" />
      </SkeletonGroup>
    );
  }
  if (sets.isError) {
    const { title, detail } = describeApiError(sets.error);
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-card border border-danger/30 bg-danger-soft p-3 text-body text-danger">
        <p className="m-0 font-semibold">{title}</p>
        <p className="m-0">{detail}</p>
        <Button variant="secondary" onClick={() => void sets.refetch()}>Try again</Button>
      </div>
    );
  }

  const options = setsForSubject(sets.data, subjectId);
  if (!options.length) {
    return (
      <p role="status" className="m-0 rounded-card border border-line bg-canvas p-3 text-body text-muted">
        You have no question sets for this subject yet. Choose “Write questions” to create one.
      </p>
    );
  }

  const chosen = options.find((set) => String(set.id) === value);
  const hint = chosen
    ? `${setFacts(chosen)}. The exam is worth the set’s points.${chosen.locked ? " The set is locked, so its questions stay as they are." : ""}`
    : "The exam uses the set’s questions; dates, attempts, and time limit are this exam’s own.";
  return (
    <Field label="Question set" required error={error} hint={hint}>
      <Select data-focus="settings:questions" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a question set</option>
        {options.map((set) => (
          <option key={set.id} value={set.id}>{set.title} · {setFacts(set)}</option>
        ))}
      </Select>
    </Field>
  );
}
