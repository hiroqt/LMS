import { CircleAlert, Eye, Lock, Save, Send } from "lucide-react";
import { Button } from "../../../../shared/ui/Button";
import type { AssignmentField } from "../../api/assignments";

export type AssignmentAction = "draft" | "publish" | "save" | "preview";
/** New or draft: Save draft and Publish. Published: Save changes. Closed: nothing to save. */
export type BuilderMode = "draft" | "published" | "closed";

export interface AssignmentSummaryProps {
  mode: BuilderMode;
  points: string;
  /** The rules as students will read them (`handInRules`). */
  rules: string[];
  /** Fields to fix, each with its message. */
  problems: Array<{ field: AssignmentField; label: string; message: string }>;
  /** A refusal that is not about one field, in plain words. */
  general?: string;
  /** "Draft saved at 10:42.", announced politely. */
  status: string;
  dirty: boolean;
  saving: AssignmentAction | null;
  onFix: (field: AssignmentField) => void;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onSaveChanges: () => void;
}

const pointsText = (points: string) => {
  const value = Number(points);
  return Number.isFinite(value) && value > 0 ? `${value} ${value === 1 ? "point" : "points"}` : "Points not set";
};
const toFix = (count: number) => `${count} ${count === 1 ? "field" : "fields"} to fix`;

/**
 * The points, what students will read, what needs fixing, and the actions. It shares the
 * assessment builder's Summary layout: sticky beside the tabs on wide screens, a bar on phones.
 */
export function AssignmentSummary({ mode, points, rules, problems, general, status, dirty, saving, onFix, onPreview, onSaveDraft, onPublish, onSaveChanges }: AssignmentSummaryProps) {
  const busy = saving !== null;
  return (
    <aside
      aria-labelledby="builder-summary"
      className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-card border border-line bg-surface p-3 @4xl:top-20 @4xl:bottom-auto @4xl:self-start @4xl:p-5"
    >
      <h2 id="builder-summary" className="sr-only m-0 font-sans text-section font-semibold text-ink @4xl:not-sr-only">Summary</h2>
      <div className="flex flex-col gap-2 text-body">
        <p className="m-0 font-semibold text-ink">{pointsText(points)}</p>
        <div className="hidden flex-col gap-1 @4xl:flex">
          <h3 id="builder-rules" className="m-0 font-sans text-body font-semibold text-ink">What students will read</h3>
          <ul aria-labelledby="builder-rules" className="m-0 flex list-disc flex-col gap-1 pl-5 text-ink">
            {rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
        {problems.length > 0 && (
          <>
            {/* Phones: one button to the first; wide screens: every field, each a link to it. */}
            <button
              type="button"
              onClick={() => onFix(problems[0]!.field)}
              className="flex min-h-touch items-center gap-2 self-start rounded-control border-0 bg-transparent px-0 text-left font-sans text-body font-semibold text-danger underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus @4xl:hidden"
            >
              <CircleAlert aria-hidden className="size-4 shrink-0" />{toFix(problems.length)}
            </button>
            <div className="hidden flex-col gap-1 @4xl:flex">
              <p className="m-0 flex items-center gap-2 font-semibold text-danger"><CircleAlert aria-hidden className="size-4 shrink-0" />{toFix(problems.length)}</p>
              <ul aria-label="Fields to fix" className="m-0 flex list-none flex-col p-0">
                {problems.map((item) => (
                  <li key={item.field}>
                    <button
                      type="button"
                      onClick={() => onFix(item.field)}
                      className="flex min-h-touch w-full flex-col justify-center rounded-control border-0 bg-transparent px-2 text-left font-sans text-body hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
                    >
                      <span className="font-semibold text-primary-700 underline underline-offset-2">{item.label}</span>
                      <span className="text-muted">{item.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {general && <p role="alert" className="m-0 rounded-control border border-danger/30 bg-danger-soft p-2 font-medium text-danger">{general}</p>}
        {mode === "closed" && (
          <p className="m-0 flex items-start gap-2 text-ink"><Lock aria-hidden className="mt-0.5 size-4 shrink-0" />This assignment is closed. Reopen it to change it.</p>
        )}
        <p role="status" className="m-0 text-muted">{dirty ? "" : status}</p>
        {dirty && status && <p className="m-0 hidden text-muted @4xl:block">Unsaved changes</p>}
      </div>
      {mode !== "closed" && (
        <div className={mode === "draft" ? "grid grid-cols-3 gap-2 @4xl:grid-cols-1" : "grid grid-cols-2 gap-2 @4xl:grid-cols-1"}>
          <Button variant="ghost" className="px-2 whitespace-normal @4xl:px-4" icon={<Eye aria-hidden className="size-4 shrink-0" />} disabled={busy && saving !== "preview"} loading={saving === "preview"} onClick={onPreview}>
            <span>Preview{" "}<span className="sr-only @4xl:not-sr-only">as student</span></span>
          </Button>
          {mode === "draft" ? (
            <>
              <Button variant="secondary" className="px-2 whitespace-normal @4xl:px-4" disabled={busy && saving !== "draft"} loading={saving === "draft"} loadingLabel="Saving…" onClick={onSaveDraft}>
                Save draft
              </Button>
              <Button className="px-2 whitespace-normal @4xl:px-4" icon={<Send aria-hidden className="size-4 shrink-0" />} disabled={busy && saving !== "publish"} loading={saving === "publish"} loadingLabel="Publishing…" onClick={onPublish}>
                Publish
              </Button>
            </>
          ) : (
            <Button className="px-2 whitespace-normal @4xl:px-4" icon={<Save aria-hidden className="size-4 shrink-0" />} disabled={busy && saving !== "save"} loading={saving === "save"} loadingLabel="Saving…" onClick={onSaveChanges}>
              Save changes
            </Button>
          )}
        </div>
      )}
    </aside>
  );
}
