import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { CATEGORY_PRESETS, type AssessmentSettings, type SettingsErrors } from "../../api/assessments";

const OTHER = "other";

export interface SettingsPartProps {
  settings: AssessmentSettings;
  errors: SettingsErrors;
  onChange: (change: Partial<AssessmentSettings>) => void;
}

/** Title, module, category label, and instructions. */
export function DetailsSection({ settings, errors, onChange, modules }: SettingsPartProps & { modules: Array<{ id: string; label: string }> }) {
  const preset = (CATEGORY_PRESETS as readonly string[]).includes(settings.category) ? settings.category : OTHER;
  return (
    <section aria-labelledby="builder-details" className="flex flex-col gap-4">
      <h2 id="builder-details" className="sr-only">Details</h2>
      <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5">
        <Field label="Assessment title" required error={errors.title}>
          <Input data-focus="settings:title" value={settings.title} maxLength={200} onChange={(event) => onChange({ title: event.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Field label="Module" hint="A module, or one of its submodules." error={errors.moduleId}>
            <Select data-focus="settings:moduleId" value={settings.moduleId} onChange={(event) => onChange({ moduleId: event.target.value })}>
              {!settings.moduleId && <option value="">Choose a module</option>}
              {modules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Category" hint="How students see it listed." error={preset === OTHER ? undefined : errors.category}>
            <Select data-focus={preset === OTHER ? undefined : "settings:category"} value={preset} onChange={(event) => onChange({ category: event.target.value === OTHER ? "" : event.target.value })}>
              {CATEGORY_PRESETS.map((label) => <option key={label} value={label}>{label}</option>)}
              <option value={OTHER}>Another label</option>
            </Select>
          </Field>
        </div>
        {preset === OTHER && (
          <Field label="Category label" hint="For example, “Practical exam”. At most 40 characters." error={errors.category}>
            <Input data-focus="settings:category" value={settings.category} maxLength={40} onChange={(event) => onChange({ category: event.target.value })} />
          </Field>
        )}
        <Field label="Instructions" hint="Shown to students before they start." error={errors.instructions}>
          <Textarea data-focus="settings:instructions" value={settings.instructions} rows={3} onChange={(event) => onChange({ instructions: event.target.value })} />
        </Field>
      </div>
    </section>
  );
}
