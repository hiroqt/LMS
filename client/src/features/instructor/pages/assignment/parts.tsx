import { useId, type ReactNode } from "react";
import type { AssignmentErrors, AssignmentForm } from "../../api/assignments";

export interface TabPartProps {
  form: AssignmentForm;
  errors: AssignmentErrors;
  onChange: (change: Partial<AssignmentForm>) => void;
}

/** A titled card of fields on a builder tab. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
      <h3 className="m-0 font-sans text-card-title font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

const box = "mt-0.5 size-5 shrink-0 accent-primary-600 disabled:cursor-not-allowed";

/** One checkbox with a label and an optional hint (the reason when it is disabled). */
export function Check({ label, hint, checked, onChange, disabled, focus }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; focus?: string }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2 font-sans text-body text-ink has-disabled:cursor-not-allowed">
      <input type="checkbox" data-focus={focus} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className={box} />
      <span className="flex flex-col">
        <span>{label}</span>
        {hint && <span className="text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Several checkboxes under one legend, with the group's error linked to it. */
export function CheckGroup<T extends string>({ legend, hint, options, value, onChange, error, focus }: { legend: string; hint?: string; options: Array<{ value: T; label: string; hint?: string }>; value: T[]; onChange: (value: T[]) => void; error?: string; focus: string }) {
  const id = useId();
  const described = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset aria-describedby={described} aria-invalid={error ? true : undefined} className="m-0 flex min-w-0 flex-col border-0 p-0 font-sans">
      <legend className="mb-1 p-0 text-body font-medium text-ink">{legend}</legend>
      {hint && <p id={`${id}-hint`} className="m-0 text-body text-muted">{hint}</p>}
      {options.map((option, index) => (
        <label key={option.value} className="flex min-h-touch cursor-pointer items-start gap-3 py-2 text-body text-ink">
          <input
            type="checkbox"
            data-focus={index === 0 ? focus : undefined}
            checked={value.includes(option.value)}
            onChange={(event) => onChange(event.target.checked ? options.map((item) => item.value).filter((item) => item === option.value || value.includes(item)) : value.filter((item) => item !== option.value))}
            className={box}
          />
          <span className="flex flex-col">
            <span>{option.label}</span>
            {option.hint && <span className="text-muted">{option.hint}</span>}
          </span>
        </label>
      ))}
      {error && <p id={`${id}-error`} className="m-0 text-body font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

/** Radio buttons under one legend; the checked one carries the focus marker. */
export function RadioGroup<T extends string>({ legend, name, value, options, onChange, error, focus }: { legend: string; name: string; value: T; options: Array<{ value: T; label: string; hint?: string }>; onChange: (value: T) => void; error?: string; focus: string }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0 font-sans">
      <legend className="mb-1 p-0 text-body font-medium text-ink">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-touch cursor-pointer items-start gap-3 py-2 text-body text-ink">
          <input type="radio" name={name} value={option.value} data-focus={value === option.value ? focus : undefined} checked={value === option.value} onChange={() => onChange(option.value)} className={box} />
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
