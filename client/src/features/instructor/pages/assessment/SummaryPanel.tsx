import { Eye, Send, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Button } from "../../../../shared/ui/Button";
import { QUESTION_TYPE_LABELS, type QuestionType } from "../../api/questionSets";

export type SavingAction = "draft" | "publish" | "preview";

export interface SummaryPanelProps {
  count: number;
  totalPoints: number;
  types: QuestionType[];
  /** Questions to finish, with the first thing each needs. */
  attention: Array<{ key: string; number: number; problem: string }>;
  /** "Draft saved at 10:42.", announced politely. */
  status: string;
  dirty: boolean;
  saving: SavingAction | null;
  /** Why publishing was refused, in plain words. */
  publishProblem?: string;
  onJump: (key: string) => void;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  /** The settings at a glance ("Due Nov 20, 4:00 PM · 1 attempt · 30 min"); wide screens only. */
  glance?: string;
  onOpenSettings?: () => void;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const needAttention = (count: number) => `${count} ${count === 1 ? "needs" : "need"} attention`;

/**
 * The count, points, types, and what needs attention, with Preview, Save draft, and Publish.
 * Sticky beside the form on wide screens; a sticky bar at the bottom on phones.
 */
export function SummaryPanel({ count, totalPoints, types, attention, status, dirty, saving, publishProblem, onJump, onPreview, onSaveDraft, onPublish, glance, onOpenSettings }: SummaryPanelProps) {
  const busy = saving !== null;
  return (
    <aside
      aria-labelledby="builder-summary"
      className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-card border border-line bg-surface p-3 @4xl:top-20 @4xl:bottom-auto @4xl:self-start @4xl:p-5"
    >
      <h2 id="builder-summary" className="sr-only m-0 font-sans text-section font-semibold text-ink @4xl:not-sr-only">Summary</h2>
      <div className="flex flex-col gap-1 text-body">
        <p className="m-0 font-semibold text-ink">{plural(count, "question", "questions")} · {plural(totalPoints, "point", "points")}</p>
        {types.length > 0 && <p className="m-0 hidden text-muted @4xl:block">{types.map((type) => QUESTION_TYPE_LABELS[type]).join(", ")}</p>}
        {glance && onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="hidden min-h-touch items-center gap-2 self-start rounded-control border-0 bg-transparent px-0 text-left font-sans text-body text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-3 focus-visible:outline-focus @4xl:flex"
          >
            <SlidersHorizontal aria-hidden className="size-4 shrink-0" />
            <span>Settings: {glance}</span>
          </button>
        )}
        {attention.length > 0 && (
          <>
            {/* Phones: one button to the first; wide screens: every question, each a link to it. */}
            <button
              type="button"
              onClick={() => onJump(attention[0]!.key)}
              className="flex min-h-touch items-center gap-2 self-start rounded-control border-0 bg-transparent px-0 text-left font-sans text-body font-semibold text-warning underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus @4xl:hidden"
            >
              <TriangleAlert aria-hidden className="size-4 shrink-0" />{needAttention(attention.length)}
            </button>
            <div className="hidden flex-col gap-1 @4xl:flex">
              <p className="m-0 flex items-center gap-2 font-semibold text-warning"><TriangleAlert aria-hidden className="size-4 shrink-0" />{needAttention(attention.length)}</p>
              <ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-0">
                {attention.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onJump(item.key)}
                      className="flex min-h-touch w-full flex-col justify-center rounded-control border-0 bg-transparent px-2 text-left font-sans text-body hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
                    >
                      <span className="font-semibold text-primary-700 underline underline-offset-2">Question {item.number}</span>
                      <span className="text-muted">{item.problem}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {publishProblem && <p role="alert" className="m-0 rounded-control border border-danger/30 bg-danger-soft p-2 font-medium text-danger">{publishProblem}</p>}
        <p role="status" className="m-0 text-muted">{dirty ? "" : status}</p>
        {dirty && status && <p className="m-0 hidden text-muted @4xl:block">Unsaved changes</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 @4xl:grid-cols-1">
        <Button variant="ghost" className="px-2 whitespace-normal @4xl:px-4" icon={<Eye aria-hidden className="size-4 shrink-0" />} disabled={busy && saving !== "preview"} loading={saving === "preview"} onClick={onPreview}>
          <span>Preview{" "}<span className="sr-only @4xl:not-sr-only">as student</span></span>
        </Button>
        <Button variant="secondary" className="px-2 whitespace-normal @4xl:px-4" disabled={busy && saving !== "draft"} loading={saving === "draft"} loadingLabel="Saving…" onClick={onSaveDraft}>
          Save draft
        </Button>
        <Button className="px-2 whitespace-normal @4xl:px-4" icon={<Send aria-hidden className="size-4 shrink-0" />} disabled={busy && saving !== "publish"} loading={saving === "publish"} loadingLabel="Publishing…" onClick={onPublish}>
          Publish
        </Button>
      </div>
    </aside>
  );
}
