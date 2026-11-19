import { FILE_TYPE_KEYS, FILE_TYPES, MAX_FILES } from "../../../../shared/api/assignments";
import { Field, Select } from "../../../../shared/ui/Field";
import { SUBMISSION_KINDS, filesApply } from "../../api/assignments";
import { Check, CheckGroup, Group, type TabPartProps } from "./parts";

const FILE_TYPE_OPTIONS = FILE_TYPE_KEYS.map((key) => ({ value: key, label: FILE_TYPES[key].label }));

/** What students hand in; which files and how many; the "This is my own work" statement. */
export function HandInTab({ form, errors, onChange }: TabPartProps) {
  const files = filesApply(form);
  return (
    <section aria-labelledby="assignment-hand-in" className="flex flex-col gap-4">
      <h2 id="assignment-hand-in" className="sr-only">Hand-in</h2>
      <Group title="What students hand in">
        <CheckGroup
          legend="Students can hand in"
          hint="Choose at least one."
          options={SUBMISSION_KINDS}
          value={form.submissionKinds}
          onChange={(submissionKinds) => onChange({ submissionKinds })}
          error={errors.submissionKinds}
          focus="assignment:submissionKinds"
        />
      </Group>
      <Group title="Files">
        {files ? (
          <>
            <CheckGroup
              legend="File types accepted"
              hint="Each file can be up to 25 MB. Old Office formats (.doc, .xls, .ppt) are refused."
              options={FILE_TYPE_OPTIONS}
              value={form.allowedFileTypes}
              onChange={(allowedFileTypes) => onChange({ allowedFileTypes })}
              error={errors.allowedFileTypes}
              focus="assignment:allowedFileTypes"
            />
            <Field label="Files per turn-in" hint={`1 to ${MAX_FILES}.`} error={errors.maxFiles} className="max-w-xs">
              <Select data-focus="assignment:maxFiles" value={String(form.maxFiles)} onChange={(event) => onChange({ maxFiles: Number(event.target.value) })}>
                {Array.from({ length: MAX_FILES }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count === 1 ? "1 file" : `Up to ${count} files`}</option>)}
              </Select>
            </Field>
          </>
        ) : (
          <p className="m-0 text-body text-muted">Students don’t hand in files. Choose Files above to set the file types and how many.</p>
        )}
      </Group>
      <Group title="Own work">
        <Check
          label="Students confirm “This is my own work”"
          hint="They tick it before they can turn in."
          checked={form.honorStatement}
          onChange={(honorStatement) => onChange({ honorStatement })}
          focus="assignment:honorStatement"
        />
      </Group>
    </section>
  );
}
