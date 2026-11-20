import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../../shared/ui/Button";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { IconButton } from "../../../../shared/ui/IconButton";
import { LIMITS, criterionFormMax, pointsLabel, type CriterionForm, type LevelForm, type RubricErrors } from "../../api/rubrics";

export interface CriterionEditorProps {
  criterion: CriterionForm;
  index: number;
  count: number;
  errors: RubricErrors;
  onChange: (change: Partial<Pick<CriterionForm, "title" | "description">>) => void;
  onChangeLevel: (levelIndex: number, change: Partial<Omit<LevelForm, "key">>) => void;
  onAddLevel: () => void;
  onRemoveLevel: (levelIndex: number) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One criterion of the rubric editor: its title and description, and 2 to 6 levels, each with a
 * title, points, and a description. Every input carries `data-focus="rubric:<server path>"`, so
 * an error from the server (`criteria[1].levels[0].points`) focuses the input it is about.
 */
export function CriterionEditor({ criterion, index, count, errors, onChange, onChangeLevel, onAddLevel, onRemoveLevel, onMove, onRemove }: CriterionEditorProps) {
  const at = `criteria[${index}]`;
  const number = index + 1;
  const headingId = `criterion-${criterion.key}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 id={headingId} tabIndex={-1} data-focus={`rubric:${at}.heading`} className="m-0 font-sans text-card-title font-semibold text-ink outline-none">Criterion {number}</h2>
          <p className="m-0 text-body text-muted">Up to {pointsLabel(criterionFormMax(criterion))}</p>
        </div>
        <div className="flex gap-1">
          <IconButton label={`Move criterion ${number} up`} data-focus={`rubric:${at}.up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /></IconButton>
          <IconButton label={`Move criterion ${number} down`} data-focus={`rubric:${at}.down`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown /></IconButton>
          <IconButton label={`Remove criterion ${number}`} disabled={count <= LIMITS.minCriteria} onClick={onRemove}><Trash2 /></IconButton>
        </div>
      </div>
      <Field label="Criterion title" required error={errors[`${at}.title`]}>
        <Input data-focus={`rubric:${at}.title`} value={criterion.title} maxLength={LIMITS.titleMax} onChange={(event) => onChange({ title: event.target.value })} />
      </Field>
      <Field label="Criterion description" hint="Optional. What is looked at." error={errors[`${at}.description`]}>
        <Textarea data-focus={`rubric:${at}.description`} rows={2} value={criterion.description} maxLength={LIMITS.descriptionMax} onChange={(event) => onChange({ description: event.target.value })} />
      </Field>
      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-sans text-body font-semibold text-ink">Levels</h3>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {criterion.levels.map((level, k) => {
            const path = `${at}.levels[${k}]`;
            return (
              <li key={level.key}>
                <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-control border border-line p-3">
                  <legend className="px-1 font-sans text-body font-medium text-ink">Level {k + 1}</legend>
                  <div className="grid grid-cols-1 gap-3 @xl:grid-cols-[minmax(0,1fr)_8rem_auto] @xl:items-start">
                    <Field label="Title" required error={errors[`${path}.title`]}>
                      <Input data-focus={`rubric:${path}.title`} value={level.title} maxLength={LIMITS.levelTitleMax} onChange={(event) => onChangeLevel(k, { title: event.target.value })} />
                    </Field>
                    <Field label="Points" required error={errors[`${path}.points`]}>
                      <Input data-focus={`rubric:${path}.points`} type="number" inputMode="decimal" min={0} max={LIMITS.maxPoints} step="any" value={level.points} onChange={(event) => onChangeLevel(k, { points: event.target.value })} />
                    </Field>
                    <IconButton
                      label={`Remove level ${k + 1} of criterion ${number}`}
                      className="self-end @xl:mt-7 @xl:self-start"
                      disabled={criterion.levels.length <= LIMITS.minLevels}
                      onClick={() => onRemoveLevel(k)}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <Field label="Description" hint="Optional." error={errors[`${path}.description`]}>
                    <Input data-focus={`rubric:${path}.description`} value={level.description} maxLength={LIMITS.descriptionMax} onChange={(event) => onChangeLevel(k, { description: event.target.value })} />
                  </Field>
                </fieldset>
              </li>
            );
          })}
        </ol>
        {errors[`${at}.levels`] && <p className="m-0 text-body font-medium text-danger">{errors[`${at}.levels`]}</p>}
        <Button
          variant="secondary"
          className="self-start"
          data-focus={`rubric:${at}.levels`}
          icon={<Plus aria-hidden className="size-4" />}
          disabled={criterion.levels.length >= LIMITS.maxLevels}
          onClick={onAddLevel}
        >
          Add level<span className="sr-only"> to criterion {number}</span>
        </Button>
        <p className="m-0 text-body text-muted">{LIMITS.minLevels} to {LIMITS.maxLevels} levels. The highest is what the criterion is worth.</p>
      </div>
    </section>
  );
}
