import { ListChecks } from "lucide-react";
import type { Rubric } from "../../../../shared/api/rubrics";
import { RubricView } from "../../../../shared/components/assignment/RubricView";
import { Button } from "../../../../shared/ui/Button";
import { Field, Input, Select } from "../../../../shared/ui/Field";
import { GRADE_RELEASE_OPTIONS, closeAtApplies, penaltyApplies } from "../../api/assignments";
import { pointsLabel } from "../../api/rubrics";
import { Check, Group, RadioGroup, type TabPartProps } from "./parts";

/** The class's rubrics as the builder has them: still loading, failed, or the list. */
export interface RubricChoices {
  status: "pending" | "error" | "success";
  list: Rubric[];
  /** Why the list could not be read, in plain words. */
  error?: string;
  onRetry: () => void;
  /** Opens the class's rubrics page (through the unsaved-changes guard). */
  onManage: () => void;
}

/** Why the late penalty is unavailable, or null when it is available. */
function penaltyBlocked(hasDue: boolean, allowLate: boolean): string | null {
  if (!hasDue) return "Set a due date and accept late work first: only late work can lose points.";
  if (!allowLate) return "Accept late work first: only late work can lose points.";
  return null;
}

/** When it opens and is due, late work, its last day and its penalty, resubmission, when grades show, and the rubric. */
export function DatesTab({ form, errors, onChange, rubrics }: TabPartProps & { rubrics: RubricChoices }) {
  const hasDue = Boolean(form.dueAt);
  const blocked = penaltyBlocked(hasDue, form.allowLate);
  const penaltyShown = penaltyApplies(form) && form.latePenalty;
  const chosen = rubrics.list.find((item) => String(item.id) === form.rubricId);
  const penaltyError = errors.latePenalty ?? (!penaltyShown ? errors.latePenaltyPercentPerDay ?? errors.latePenaltyMaxPercent : undefined);
  return (
    <section aria-labelledby="assignment-dates" className="flex flex-col gap-4">
      <h2 id="assignment-dates" className="sr-only">Dates and grading</h2>
      <Group title="Dates">
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Field label="Available from" hint="Leave empty to make it available when you publish." error={errors.availableFrom}>
            <Input data-focus="assignment:availableFrom" type="datetime-local" value={form.availableFrom} onChange={(event) => onChange({ availableFrom: event.target.value })} />
          </Field>
          <Field label="Due date" hint="Leave empty for no due date." error={errors.dueAt}>
            <Input data-focus="assignment:dueAt" type="datetime-local" value={form.dueAt} onChange={(event) => onChange({ dueAt: event.target.value })} />
          </Field>
        </div>
      </Group>
      <Group title="Late work and resubmission">
        <Check
          label="Accept late work"
          hint={hasDue ? "Work handed in after the due date is marked late." : "Set a due date first: without one, nothing is late."}
          checked={hasDue && form.allowLate}
          disabled={!hasDue}
          onChange={(allowLate) => onChange({ allowLate })}
          focus="assignment:allowLate"
        />
        {closeAtApplies(form) && (
          <Field label="Accept late work until" hint="Leave empty to accept late work at any time." error={errors.closeAt} className="max-w-md">
            <Input data-focus="assignment:closeAt" type="datetime-local" value={form.closeAt} min={form.dueAt} onChange={(event) => onChange({ closeAt: event.target.value })} />
          </Field>
        )}
        {/* A server error on the last day while it is hidden still needs a place to show. */}
        {!closeAtApplies(form) && errors.closeAt && <p className="m-0 text-body font-medium text-danger">{errors.closeAt}</p>}
        <Check
          label="Take points off late work"
          hint={blocked ?? "A percent of the score is taken off for each calendar day late."}
          checked={!blocked && form.latePenalty}
          disabled={Boolean(blocked)}
          onChange={(latePenalty) => onChange({ latePenalty })}
          focus="assignment:latePenalty"
        />
        {penaltyShown && (
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
            <Field label="Percent per day" hint="A whole number from 1 to 100." error={errors.latePenaltyPercentPerDay}>
              <Input
                data-focus="assignment:latePenaltyPercentPerDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={form.latePenaltyPercentPerDay}
                onChange={(event) => onChange({ latePenaltyPercentPerDay: event.target.value })}
              />
            </Field>
            <Field label="Up to" hint="The most it can take off, in percent. 100 means all of it." error={errors.latePenaltyMaxPercent}>
              <Input
                data-focus="assignment:latePenaltyMaxPercent"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={form.latePenaltyMaxPercent}
                onChange={(event) => onChange({ latePenaltyMaxPercent: event.target.value })}
              />
            </Field>
          </div>
        )}
        {penaltyError && <p className="m-0 text-body font-medium text-danger">{penaltyError}</p>}
        <Check
          label="Allow resubmission"
          hint={hasDue ? "Students can take their work back and turn in a new version before the due date." : "Students can take their work back and turn in a new version."}
          checked={form.allowResubmission}
          onChange={(allowResubmission) => onChange({ allowResubmission })}
          focus="assignment:allowResubmission"
        />
      </Group>
      <Group title="Grading">
        <RadioGroup
          legend="Students see their grade"
          name="gradeRelease"
          value={form.gradeRelease}
          options={GRADE_RELEASE_OPTIONS}
          onChange={(gradeRelease) => onChange({ gradeRelease })}
          error={errors.gradeRelease}
          focus="assignment:gradeRelease"
        />
        <Field
          label="Grade with a rubric"
          hint={
            rubrics.status === "pending"
              ? "Loading this class's rubrics…"
              : rubrics.status === "error"
                ? rubrics.error
                : rubrics.list.length
                  ? "With a rubric, you choose a level for each criterion, and the assignment is worth the rubric's total."
                  : "This class has no rubrics yet. Write one on the rubrics page."
          }
          error={errors.rubricId}
          className="max-w-md"
        >
          <Select
            data-focus="assignment:rubricId"
            value={form.rubricId}
            disabled={rubrics.status !== "success" && !form.rubricId}
            // The points the instructor typed are kept for when the rubric is taken off again; with a rubric they are not sent.
            onChange={(event) => onChange({ rubricId: event.target.value })}
          >
            <option value="">No rubric</option>
            {/* A saved choice stays listed while the list loads or fails. */}
            {form.rubricId && !chosen && <option value={form.rubricId}>The chosen rubric</option>}
            {rubrics.list.map((item) => <option key={item.id} value={String(item.id)}>{`${item.title} · ${pointsLabel(item.totalPoints)}`}</option>)}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          {rubrics.status === "error" && <Button variant="secondary" onClick={rubrics.onRetry}>Try again</Button>}
          <Button variant="secondary" className="max-w-full shrink whitespace-normal" icon={<ListChecks aria-hidden className="size-4" />} onClick={rubrics.onManage}>
            Manage rubrics
          </Button>
        </div>
        {chosen && (
          <section aria-labelledby="assignment-rubric" className="@container flex flex-col gap-3 border-t border-line pt-4">
            <h4 id="assignment-rubric" className="m-0 font-sans text-body font-semibold text-ink">{chosen.title}</h4>
            <RubricView rubric={chosen} name="builder-rubric" />
          </section>
        )}
      </Group>
    </section>
  );
}
