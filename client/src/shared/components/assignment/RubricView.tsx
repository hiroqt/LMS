import { Check } from "lucide-react";
import { criterionMax, rubricTotal, type Rubric } from "../../api/rubrics";
import { cn } from "../../lib/cn";

export interface RubricViewProps {
  rubric: Pick<Rubric, "criteria" | "totalPoints">;
  /** The level chosen for each criterion, by criterion id. Omit to show the rubric before any grade. */
  chosen?: Record<number, number>;
  /** Makes each criterion a group of radio buttons; called with the criterion and the level picked. */
  onChoose?: (criterionId: number, levelId: number) => void;
  /** The message for a criterion with no level chosen, by criterion id (the server's `rubric[<id>]` errors). */
  errors?: Record<number, string | undefined>;
  disabled?: boolean;
  /** Makes ids and radio names unique when two rubrics are on one page. */
  name?: string;
}

const plural = (points: number) => `${points} ${points === 1 ? "point" : "points"}`;

/**
 * A rubric: each criterion with its levels and what each is worth (D-062). Read-only it shows
 * what work is graded on, and with `chosen` the level each criterion earned. With `onChoose` the
 * levels of a criterion are radio buttons, for grading. A chosen level always says "Chosen" in
 * words and has a check mark; it never depends on color alone.
 */
export function RubricView({ rubric, chosen, onChoose, errors, disabled, name = "rubric" }: RubricViewProps) {
  const total = chosen ? rubricTotal(rubric, chosen) : null;
  return (
    <div className="flex flex-col gap-4">
      {rubric.criteria.map((criterion) => {
        const picked = chosen?.[criterion.id];
        const error = errors?.[criterion.id];
        const errorId = `${name}-${criterion.id}-error`;
        return (
          <fieldset key={criterion.id} disabled={disabled} aria-describedby={error ? errorId : undefined} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="p-0 font-sans text-body font-semibold text-ink">
              {criterion.title} <span className="font-normal text-muted">· up to {plural(criterionMax(criterion))}</span>
            </legend>
            {criterion.description && <p className="m-0 max-w-prose text-body text-muted">{criterion.description}</p>}
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 @xl:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              {criterion.levels.map((level) => {
                const isChosen = picked === level.id;
                const body = (
                  <>
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      {isChosen && <Check aria-hidden className="size-4 shrink-0 text-primary-700" />}
                      <span>{level.title}</span>
                    </span>
                    <span className="text-muted">{plural(level.points)}{isChosen && !onChoose && " · Chosen"}</span>
                    {level.description && <span className="text-ink">{level.description}</span>}
                  </>
                );
                const box = cn("flex h-full min-h-touch flex-col gap-0.5 rounded-control border p-3 font-sans text-body", isChosen ? "border-primary-600 bg-primary-100" : "border-line bg-surface");
                return (
                  <li key={level.id}>
                    {onChoose ? (
                      <label className={cn(box, "cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-focus", disabled && "cursor-not-allowed opacity-70")}>
                        <input
                          type="radio"
                          name={`${name}-${criterion.id}`}
                          className="sr-only"
                          checked={isChosen}
                          onChange={() => onChoose(criterion.id, level.id)}
                        />
                        {body}
                      </label>
                    ) : (
                      <div className={box}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {error && <p id={errorId} className="m-0 text-body text-danger">{error}</p>}
          </fieldset>
        );
      })}
      <p className="m-0 font-sans text-body font-semibold text-ink" aria-live={onChoose ? "polite" : undefined}>
        {total ? `${total.points} of ${plural(rubric.totalPoints)}${total.complete ? "" : " so far"}` : `${plural(rubric.totalPoints)} in all`}
      </p>
    </div>
  );
}
