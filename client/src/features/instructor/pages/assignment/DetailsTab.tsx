import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { Group, type TabPartProps } from "./parts";

/** Module, title, short description, instructions, and points. */
export function DetailsTab({ form, errors, onChange, modules }: TabPartProps & { modules: Array<{ id: string; label: string }> }) {
  return (
    <section aria-labelledby="assignment-details" className="flex flex-col gap-4">
      <h2 id="assignment-details" className="sr-only">Details</h2>
      <Group title="About the assignment">
        <Field label="Assignment title" required error={errors.title}>
          <Input data-focus="assignment:title" value={form.title} maxLength={250} onChange={(event) => onChange({ title: event.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Field label="Module" hint="A module, or one of its submodules." error={errors.moduleId}>
            <Select data-focus="assignment:moduleId" value={form.moduleId} onChange={(event) => onChange({ moduleId: event.target.value })}>
              {!form.moduleId && <option value="">Choose a module</option>}
              {modules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Points" required hint="More than 0, at most 1,000." error={errors.points}>
            <Input data-focus="assignment:points" type="number" inputMode="decimal" min={0} max={1000} step="any" value={form.points} onChange={(event) => onChange({ points: event.target.value })} />
          </Field>
        </div>
        <Field label="Short description" hint="One or two sentences shown in lists. At most 1,000 characters." error={errors.description}>
          <Textarea data-focus="assignment:description" value={form.description} rows={2} maxLength={1000} onChange={(event) => onChange({ description: event.target.value })} />
        </Field>
        <Field label="Instructions" hint="What to do and how it is graded. Shown on the assignment page." error={errors.instructions}>
          <Textarea data-focus="assignment:instructions" value={form.instructions} rows={6} onChange={(event) => onChange({ instructions: event.target.value })} />
        </Field>
      </Group>
    </section>
  );
}
