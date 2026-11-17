import { ArrowDown, ArrowUp, FileUp, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useImperativeHandle, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import {
  addQuestion,
  attentionFor,
  blankSection,
  canMove,
  duplicateQuestion,
  flatten,
  moveQuestion,
  moveSection,
  removeQuestion,
  updateQuestion,
  type DraftSection,
  type MappedErrors,
} from "../../api/questionDrafts";
import { AddQuestionMenu } from "./AddQuestionMenu";
import { focusField, focusTarget } from "./focus";
import { QuestionCard } from "./QuestionCard";

export interface QuestionEditorHandle {
  /** Opens a question (or section) and moves focus to it. */
  jumpTo: (key: string, field?: string) => void;
}

export interface QuestionEditorProps {
  sections: DraftSection[];
  onChange: (sections: DraftSection[]) => void;
  errors: MappedErrors;
  /** Show each question's problems: after a save, or for a loaded or imported set. */
  reveal: boolean;
  /** Shows "Import questions" beside "Add section". */
  onImport?: () => void;
  ref?: Ref<QuestionEditorHandle>;
}

const EMPTY: Array<{ field: string; message: string }> = [];

/**
 * The shared question editor (D-040): sections with directions and default points, every
 * question type, Duplicate / Move / Remove, a jump list for long sets, and collapsible cards.
 * It only edits; the page that holds it saves.
 */
export function QuestionEditor({ sections, onChange, errors, reveal, onImport, ref }: QuestionEditorProps) {
  const toast = useToast();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);
  const all = flatten(sections);
  const numbers = new Map(all.map((draft, index) => [draft.key, index + 1]));

  const open = (key: string) => {
    if (!collapsed.has(key)) return;
    flushSync(() => setCollapsed((current) => new Set([...current].filter((item) => item !== key))));
  };
  const jumpTo = (key: string, field?: string) => {
    open(key);
    if (field !== undefined) focusField(key, field);
    else if (!focusTarget(`${key}:heading`)) focusTarget(`${key}:title`);
  };
  useImperativeHandle(ref, () => ({ jumpTo }));

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setSection = (key: string, change: Partial<DraftSection>) => onChange(sections.map((section) => (section.key === key ? { ...section, ...change } : section)));
  const sectionToRemove = sections.find((section) => section.key === removing);
  const allCollapsed = all.length > 0 && all.every((draft) => collapsed.has(draft.key));

  return (
    <div className="flex flex-col gap-4">
      {errors.general.length > 0 && (
        <p role="alert" className="m-0 rounded-control border border-danger/30 bg-danger-soft p-3 text-body font-medium text-danger">{errors.general.join(" ")}</p>
      )}

      {all.length > 1 && (
        <div className="flex flex-col gap-2">
          <nav aria-label="Jump to a question">
            <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {all.map((draft, index) => {
                const attention = attentionFor(draft).length > 0;
                return (
                  <li key={draft.key}>
                    <button
                      type="button"
                      onClick={() => jumpTo(draft.key)}
                      aria-label={`Question ${index + 1}${attention ? ", needs attention" : ""}`}
                      className={cn(
                        "inline-flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-control border px-2 font-sans text-body font-semibold tabular-nums focus-visible:outline-3 focus-visible:outline-focus",
                        attention ? "border-warning/40 bg-warning-soft text-warning" : "border-line bg-surface text-ink hover:bg-primary-50",
                      )}
                    >
                      {attention && <TriangleAlert aria-hidden className="size-3.5" />}
                      {index + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <Button variant="ghost" className="self-start" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(all.map((draft) => draft.key)))}>
            {allCollapsed ? "Expand all questions" : "Collapse all questions"}
          </Button>
        </div>
      )}

      {sections.map((section, s) => {
        const label = `Section ${s + 1}`;
        const sectionErrors = errors.sections[section.key] ?? [];
        const titleError = sectionErrors.find((error) => error.field === "title")?.message;
        const directionsError = sectionErrors.find((error) => error.field === "directions")?.message;
        const pointsError = sectionErrors.find((error) => error.field === "defaultPoints")?.message;
        const headingId = `section-${section.key}`;
        return (
          <section key={section.key} aria-labelledby={headingId} className="flex flex-col gap-3 rounded-card border border-line bg-canvas p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={headingId} className="m-0 min-w-0 flex-1 font-sans text-card-title font-semibold text-ink">
                {label}{section.title.trim() ? `: ${section.title.trim()}` : ""}
              </h3>
              {sections.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" icon={<ArrowUp aria-hidden className="size-4" />} disabled={s === 0} onClick={() => onChange(moveSection(sections, section.key, -1))}>
                    Move up{" "}<span className="sr-only">section {s + 1}</span>
                  </Button>
                  <Button variant="ghost" icon={<ArrowDown aria-hidden className="size-4" />} disabled={s === sections.length - 1} onClick={() => onChange(moveSection(sections, section.key, 1))}>
                    Move down{" "}<span className="sr-only">section {s + 1}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-danger"
                    icon={<Trash2 aria-hidden className="size-4" />}
                    onClick={() => (section.questions.length ? setRemoving(section.key) : onChange(sections.filter((item) => item.key !== section.key)))}
                  >
                    Remove{" "}<span className="sr-only">section {s + 1}</span>
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-[minmax(0,1fr)_12rem]">
              <Field label={`${label} title`} hint="For example, “Test I. Multiple choice”. Optional." error={titleError}>
                <Input data-focus={`${section.key}:title`} value={section.title} maxLength={200} onChange={(event) => setSection(section.key, { title: event.target.value })} />
              </Field>
              <Field label={`Default points, ${label.toLowerCase()}`} hint="New questions start with these." error={pointsError}>
                <Input data-focus={`${section.key}:defaultPoints`} type="number" inputMode="decimal" min={0} max={1000} step="any" value={section.defaultPoints} onChange={(event) => setSection(section.key, { defaultPoints: event.target.value })} />
              </Field>
            </div>
            <Field label={`Directions for ${label.toLowerCase()}`} hint="Shown to students above this section’s questions. Optional." error={directionsError}>
              <Textarea data-focus={`${section.key}:directions`} rows={2} maxLength={2000} value={section.directions} onChange={(event) => setSection(section.key, { directions: event.target.value })} />
            </Field>

            {section.questions.length ? (
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {section.questions.map((draft) => {
                  const number = numbers.get(draft.key) ?? 0;
                  return (
                    <li key={draft.key}>
                      <QuestionCard
                        draft={draft}
                        number={number}
                        collapsed={collapsed.has(draft.key)}
                        reveal={reveal}
                        errors={errors.questions[draft.key] ?? EMPTY}
                        canMoveUp={canMove(sections, draft.key, -1)}
                        canMoveDown={canMove(sections, draft.key, 1)}
                        onToggle={() => toggle(draft.key)}
                        onChange={(change) => onChange(updateQuestion(sections, draft.key, change))}
                        onDuplicate={() => {
                          const next = duplicateQuestion(sections, draft.key);
                          flushSync(() => onChange(next.sections));
                          focusTarget(`${next.key}:heading`);
                          toast.show({ title: `Question ${number} duplicated`, description: `The copy is question ${number + 1}.` });
                        }}
                        onMove={(direction) => {
                          flushSync(() => onChange(moveQuestion(sections, draft.key, direction)));
                          // Keep focus on the same button so it can be pressed again; at the end, on the card.
                          const button = document.querySelector<HTMLButtonElement>(`[data-focus="${draft.key}:${direction < 0 ? "move-up" : "move-down"}"]`);
                          if (button && !button.disabled) button.focus();
                          else focusTarget(`${draft.key}:heading`);
                        }}
                        onRemove={() => {
                          onChange(removeQuestion(sections, draft.key));
                          toast.show({ title: `Question ${number} removed` });
                        }}
                        onNotice={(message) => toast.show({ title: message })}
                      />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="m-0 text-body text-muted">No questions in this section yet.</p>
            )}
            <AddQuestionMenu
              context={sections.length > 1 ? `to section ${s + 1}` : undefined}
              onAdd={(type) => {
                const next = addQuestion(sections, section.key, type);
                onChange(next.sections);
                return next.key;
              }}
            />
          </section>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={<Plus aria-hidden className="size-4" />}
          onClick={() => {
            const added = blankSection();
            flushSync(() => onChange([...sections, added]));
            focusTarget(`${added.key}:title`);
          }}
        >
          Add section
        </Button>
        {onImport && (
          <Button variant="secondary" icon={<FileUp aria-hidden className="size-4" />} onClick={onImport}>Import questions</Button>
        )}
      </div>

      <Dialog open={Boolean(sectionToRemove)} onOpenChange={(value) => !value && setRemoving(null)}>
        {sectionToRemove && (
          <DialogContent
            title={`Remove section ${sections.indexOf(sectionToRemove) + 1}?`}
            description={`Its ${sectionToRemove.questions.length === 1 ? "question is" : `${sectionToRemove.questions.length} questions are`} removed too. Nothing changes for students until you save.`}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep section</Button></DialogClose>
                <Button variant="danger" onClick={() => { setRemoving(null); onChange(sections.filter((item) => item.key !== sectionToRemove.key)); }}>Remove section</Button>
              </>
            }
          />
        )}
      </Dialog>
    </div>
  );
}
