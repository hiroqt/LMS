import type { ReactNode } from "react";
import { Field, Input } from "../../../../shared/ui/Field";
import { ANSWER_REVIEW_OPTIONS, SPELLING_OPTIONS } from "../../api/assessments";
import type { SettingsPartProps } from "./DetailsSection";

function RadioGroup<T extends string>({ legend, name, value, options, onChange, error }: { legend: string; name: string; value: T; options: Array<{ value: T; label: string; hint?: string }>; onChange: (value: T) => void; error?: string }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 font-sans">
      <legend className="mb-1 p-0 text-body font-medium text-ink">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-touch cursor-pointer items-start gap-3 py-2 text-body text-ink">
          <input type="radio" name={name} value={option.value} data-focus={value === option.value ? `settings:${name}` : undefined} checked={value === option.value} onChange={() => onChange(option.value)} className="mt-0.5 size-5 shrink-0 accent-primary-600" />
          <span className="flex flex-col">
            <span>{option.label}</span>
            {option.hint && <span className="text-muted">{option.hint}</span>}
          </span>
        </label>
      ))}
      {error && <p className="m-0 text-body font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

function Check({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2 font-sans text-body text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary-600" />
      <span className="flex flex-col"><span>{label}</span><span className="text-muted">{hint}</span></span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
      <h3 className="m-0 font-sans text-card-title font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

/** Dates and limits, what students see after submitting, spelling, and shuffling. */
export function SettingsSection({ settings, errors, onChange }: SettingsPartProps) {
  return (
    <section aria-labelledby="builder-settings" className="flex flex-col gap-4">
      <h2 id="builder-settings" className="sr-only">Settings</h2>
      <Group title="Dates and limits">
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Field label="Available from" hint="Leave empty to make it available when you publish." error={errors.availableFrom}>
            <Input data-focus="settings:availableFrom" type="datetime-local" value={settings.availableFrom} onChange={(event) => onChange({ availableFrom: event.target.value })} />
          </Field>
          <Field label="Due date" hint="Leave empty for no due date." error={errors.dueAt}>
            <Input data-focus="settings:dueAt" type="datetime-local" value={settings.dueAt} onChange={(event) => onChange({ dueAt: event.target.value })} />
          </Field>
          <Field label="Attempts allowed" required hint="1 to 20." error={errors.attempts}>
            <Input data-focus="settings:attempts" type="number" inputMode="numeric" min={1} max={20} value={settings.attempts} onChange={(event) => onChange({ attempts: event.target.value })} />
          </Field>
          <Field label="Time limit in minutes" hint="0 means no limit." error={errors.timeLimit}>
            <Input data-focus="settings:timeLimit" type="number" inputMode="numeric" min={0} max={600} value={settings.timeLimit} onChange={(event) => onChange({ timeLimit: event.target.value })} />
          </Field>
        </div>
      </Group>
      <Group title="Results and answers">
        <RadioGroup legend="After submitting, students see" name="answerReview" value={settings.answerReview} options={ANSWER_REVIEW_OPTIONS} onChange={(answerReview) => onChange({ answerReview })} error={errors.answerReview} />
        <RadioGroup legend="Spelling in typed answers" name="spellingMode" value={settings.spellingMode} options={SPELLING_OPTIONS} onChange={(spellingMode) => onChange({ spellingMode })} error={errors.spellingMode} />
      </Group>
      <Group title="Order">
        <div className="flex flex-col">
          <Check label="Shuffle questions" hint="Each student gets the questions of each section in a different order." checked={settings.shuffleQuestions} onChange={(shuffleQuestions) => onChange({ shuffleQuestions })} />
          <Check label="Shuffle choices" hint="Multiple-choice options appear in a different order for each student." checked={settings.shuffleChoices} onChange={(shuffleChoices) => onChange({ shuffleChoices })} />
        </div>
      </Group>
    </section>
  );
}
