import { Field, Input } from "../../../../shared/ui/Field";
import { GRADE_RELEASE_OPTIONS, closeAtApplies } from "../../api/assignments";
import { Check, Group, RadioGroup, type TabPartProps } from "./parts";

/** When it opens and is due, late work and its last day, resubmission, and when grades show. */
export function DatesTab({ form, errors, onChange }: TabPartProps) {
  const hasDue = Boolean(form.dueAt);
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
          label="Allow resubmission"
          hint={hasDue ? "Students can take their work back and turn in a new version before the due date." : "Students can take their work back and turn in a new version."}
          checked={form.allowResubmission}
          onChange={(allowResubmission) => onChange({ allowResubmission })}
          focus="assignment:allowResubmission"
        />
      </Group>
      <Group title="Grades">
        <RadioGroup
          legend="Students see their grade"
          name="gradeRelease"
          value={form.gradeRelease}
          options={GRADE_RELEASE_OPTIONS}
          onChange={(gradeRelease) => onChange({ gradeRelease })}
          error={errors.gradeRelease}
          focus="assignment:gradeRelease"
        />
      </Group>
    </section>
  );
}
