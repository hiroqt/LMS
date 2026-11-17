import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useId, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { cn } from "../../../../shared/lib/cn";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { IconButton } from "../../../../shared/ui/IconButton";
import {
  addChoice,
  addPair,
  attentionFor,
  canAddChoice,
  canAddPair,
  changeType,
  pasteChoices,
  splitChoiceLines,
  splitUnderlined,
  usesTypedAnswers,
  type DraftQuestion,
} from "../../api/questionDrafts";
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type QuestionType } from "../../api/questionSets";
import { focusTarget } from "./focus";

const letter = (index: number) => String.fromCharCode(97 + index);

export interface QuestionCardProps {
  draft: DraftQuestion;
  number: number;
  collapsed: boolean;
  /** Show what the question still needs (after a save, or for a loaded or imported set). */
  reveal: boolean;
  /** The server's messages about this question, with the field each is about. */
  errors: Array<{ field: string; message: string }>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onChange: (change: (draft: DraftQuestion) => DraftQuestion) => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  /** A short notice, for example when pasted choices did not all fit. */
  onNotice: (message: string) => void;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 font-sans text-body text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 shrink-0 accent-primary-600" />
      <span>{label}</span>
    </label>
  );
}

/** True / False as two radios; `name` keeps each question's pair separate. */
function TrueFalse({ legend, name, value, focus, onChange }: { legend: string; name: string; value: boolean | null; focus: string; onChange: (value: boolean) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 font-sans">
      <legend className="mb-1 p-0 text-body font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-x-6">
        {[true, false].map((option) => (
          <label key={String(option)} className="flex min-h-touch cursor-pointer items-center gap-3 text-body text-ink">
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} data-focus={option ? focus : undefined} className="size-5 accent-primary-600" />
            {option ? "True" : "False"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Notes({ tone, title, items, children }: { tone: "warning" | "info" | "danger"; title: string; items: string[]; children?: ReactNode }) {
  const styles = { warning: "border-warning/30 bg-warning-soft text-warning", info: "border-info/30 bg-info-soft text-info", danger: "border-danger/30 bg-danger-soft text-danger" }[tone];
  return (
    <div className={cn("flex flex-col gap-1 rounded-control border p-3 text-body", styles)}>
      <p className="m-0 flex items-center gap-2 font-semibold"><TriangleAlert aria-hidden className="size-4 shrink-0" />{title}</p>
      <ul className="m-0 flex list-disc flex-col gap-0.5 pl-6">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {children}
    </div>
  );
}

/** One question: collapsible, with the fields its type needs and Duplicate, Move, Remove. */
export function QuestionCard({ draft, number, collapsed, reveal, errors, canMoveUp, canMoveDown, onToggle, onChange, onDuplicate, onMove, onRemove, onNotice }: QuestionCardProps) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const attention = attentionFor(draft);
  const patch = (change: Partial<DraftQuestion>) => onChange((current) => ({ ...current, ...change, problems: [] }));
  const points = Number(draft.points);
  const pointsLabel = draft.points.trim() && Number.isFinite(points) ? `${points} ${points === 1 ? "point" : "points"}` : "no points yet";
  const typeLabel = draft.type ? QUESTION_TYPE_LABELS[draft.type] : "Type not chosen";
  const focus = (field: string) => `${draft.key}:${field}`;

  const setOption = (index: number, change: Partial<DraftQuestion["options"][number]>) =>
    patch({ options: draft.options.map((option, i) => (i === index ? { ...option, ...change } : option)) });

  const onChoiceKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const next = draft.options[index + 1];
    if (next) {
      focusTarget(`${draft.key}:option-${next.key}`);
      return;
    }
    if (!canAddChoice(draft)) {
      onNotice("A question can have at most 10 choices.");
      return;
    }
    const options = addChoice(draft);
    flushSync(() => patch({ options }));
    focusTarget(`${draft.key}:option-${options.at(-1)!.key}`);
  };

  const onChoicePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!/\r?\n/.test(text.trim())) return;
    const lines = splitChoiceLines(text);
    if (lines.length < 2) return;
    event.preventDefault();
    const { options, dropped } = pasteChoices(draft.options, index, lines);
    flushSync(() => patch({ options }));
    onNotice(dropped ? `Added the pasted lines as choices. ${dropped} did not fit: a question can have at most 10 choices.` : `Added ${lines.length} choices.`);
  };

  const preview = draft.type === "modified_true_false" ? splitUnderlined(draft.prompt, draft.underlined) : null;
  const bodyId = `${id}-body`;

  return (
    <article aria-labelledby={`${id}-heading`} className="rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 p-2 pr-3">
        <h4 className="m-0 min-w-0 flex-1 font-sans text-card-title font-semibold">
          <button
            type="button"
            id={`${id}-heading`}
            data-focus={focus("heading")}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={onToggle}
            className="flex min-h-touch w-full min-w-0 items-center gap-2 rounded-control border-0 bg-transparent px-2 text-left font-sans text-card-title font-semibold text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
          >
            {collapsed ? <ChevronRight aria-hidden className="size-5 shrink-0" /> : <ChevronDown aria-hidden className="size-5 shrink-0" />}
            <span className="min-w-0">
              Question {number}{" "}
              <span className="font-normal text-muted">· {typeLabel} · {pointsLabel}</span>
            </span>
          </button>
        </h4>
        {attention.length > 0 && (
          <Badge tone="warning"><TriangleAlert aria-hidden className="size-3.5" />Needs attention</Badge>
        )}
      </div>
      {collapsed ? (
        draft.prompt.trim() && <p className="m-0 truncate px-5 pb-4 text-body text-muted">{draft.prompt}</p>
      ) : (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-line p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_10rem]">
            <Field label={`Type of question ${number}`}>
              <Select data-focus={focus("type")} value={draft.type} onChange={(event) => onChange((current) => changeType(current, event.target.value as QuestionType))}>
                {!draft.type && <option value="">Choose a type</option>}
                {QUESTION_TYPES.map((type) => <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}
              </Select>
            </Field>
            <Field label={`Points for question ${number}`}>
              <Input data-focus={focus("points")} type="number" inputMode="decimal" min={0} max={1000} step="any" value={draft.points} onChange={(event) => patch({ points: event.target.value })} />
            </Field>
          </div>
          <Field label={`Question ${number}`} hint={draft.type === "true_false" || draft.type === "modified_true_false" ? "The statement students judge." : undefined}>
            <Textarea data-focus={focus("prompt")} rows={2} value={draft.prompt} onChange={(event) => patch({ prompt: event.target.value })} />
          </Field>

          {draft.type === "multiple_choice" && (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 font-sans">
              <legend className="mb-1 p-0 text-body font-medium text-ink">Choices</legend>
              <p className="m-0 -mt-1 text-body text-muted">Enter in the last choice adds another. Pasting several lines adds one choice per line.</p>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {draft.options.map((option, index) => (
                  <li key={option.key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <label htmlFor={`${id}-${option.key}`} className="w-6 shrink-0 text-body font-semibold text-ink">
                      <span className="sr-only">Question {number}, choice</span>{" "}{letter(index)}
                    </label>
                    <Input
                      id={`${id}-${option.key}`}
                      data-focus={index === 0 ? focus("options") : undefined}
                      data-option={`${draft.key}:option-${option.key}`}
                      className="min-w-0 flex-1 basis-40"
                      value={option.text}
                      onChange={(event) => setOption(index, { text: event.target.value })}
                      onKeyDown={onChoiceKeyDown(index)}
                      onPaste={onChoicePaste(index)}
                    />
                    <label className="flex min-h-touch cursor-pointer items-center gap-2 px-1 text-body text-ink">
                      <input
                        type="radio"
                        name={`${id}-correct`}
                        checked={option.isCorrect}
                        onChange={() => patch({ options: draft.options.map((o, i) => ({ ...o, isCorrect: i === index })) })}
                        className="size-5 accent-primary-600"
                      />
                      <span><span className="sr-only">Choice {letter(index)} of question {number} is</span>{" "}Correct</span>
                    </label>
                    {draft.options.length > 2 && (
                      <IconButton label={`Remove choice ${letter(index)} of question ${number}`} onClick={() => patch({ options: draft.options.filter((_, i) => i !== index) })}>
                        <X />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ol>
              {canAddChoice(draft) && (
                <Button variant="ghost" className="self-start" icon={<Plus aria-hidden className="size-4" />} onClick={() => patch({ options: addChoice(draft) })}>
                  Add choice{" "}<span className="sr-only">to question {number}</span>
                </Button>
              )}
            </fieldset>
          )}

          {draft.type === "true_false" && (
            <TrueFalse legend={`Answer to question ${number}`} name={`${id}-answer`} value={draft.correctAnswer} focus={focus("correctAnswer")} onChange={(value) => patch({ correctAnswer: value })} />
          )}

          {draft.type === "modified_true_false" && (
            <>
              <Field label={`Underlined phrase in question ${number}`} hint="Copy the words from the statement. If the statement is false, students correct this phrase.">
                <Input data-focus={focus("underlined")} value={draft.underlined} onChange={(event) => patch({ underlined: event.target.value })} />
              </Field>
              <div className="flex flex-col gap-1 rounded-control border border-line bg-canvas p-3 text-body">
                <p className="m-0 font-medium text-ink">Students see</p>
                {preview ? (
                  <p className="m-0 text-body-lg text-ink">{preview[0]}<u className="decoration-2 underline-offset-4">{preview[1]}</u>{preview[2]}</p>
                ) : (
                  <p className="m-0 text-muted">{draft.underlined.trim() ? "The underlined phrase is not in the statement yet." : "Enter the phrase to underline."}</p>
                )}
              </div>
              <TrueFalse legend={`Is the statement in question ${number} true?`} name={`${id}-answer`} value={draft.correctAnswer} focus={focus("correctAnswer")} onChange={(value) => patch({ correctAnswer: value })} />
              {draft.correctAnswer === false && (
                <Field label={`Accepted corrections for question ${number}`} hint="One per line, 1 to 10. Any one is correct.">
                  <Textarea data-focus={focus("expectedAnswers")} rows={3} value={draft.expectedAnswers} onChange={(event) => patch({ expectedAnswers: event.target.value })} />
                </Field>
              )}
            </>
          )}

          {(draft.type === "identification" || draft.type === "enumeration") && (
            <Field
              label={`Accepted answers for question ${number}`}
              hint={draft.type === "identification" ? "One per line, 1 to 10. Any one is correct." : "One per line, 1 to 20. Each counts once, in any order."}
            >
              <Textarea data-focus={focus("expectedAnswers")} rows={3} value={draft.expectedAnswers} onChange={(event) => patch({ expectedAnswers: event.target.value })} />
            </Field>
          )}

          {draft.type === "matching" && (
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0 font-sans">
              <legend className="mb-1 p-0 text-body font-medium text-ink">Pairs</legend>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {draft.pairs.map((pair, index) => (
                  <li key={pair.key} className="grid grid-cols-1 items-end gap-2 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Field label={`Question ${number}, pair ${index + 1}, item`}>
                      <Input data-focus={index === 0 ? focus("pairs") : undefined} value={pair.left} onChange={(event) => patch({ pairs: draft.pairs.map((p, i) => (i === index ? { ...p, left: event.target.value } : p)) })} />
                    </Field>
                    <Field label={`Question ${number}, pair ${index + 1}, match`}>
                      <Input value={pair.right} onChange={(event) => patch({ pairs: draft.pairs.map((p, i) => (i === index ? { ...p, right: event.target.value } : p)) })} />
                    </Field>
                    {draft.pairs.length > 2 ? (
                      <IconButton label={`Remove pair ${index + 1} of question ${number}`} onClick={() => patch({ pairs: draft.pairs.filter((_, i) => i !== index) })}><X /></IconButton>
                    ) : <span aria-hidden className="hidden @xl:block @xl:w-11" />}
                  </li>
                ))}
              </ol>
              {canAddPair(draft) && (
                <Button variant="ghost" className="self-start" icon={<Plus aria-hidden className="size-4" />} onClick={() => patch({ pairs: addPair(draft) })}>
                  Add pair{" "}<span className="sr-only">to question {number}</span>
                </Button>
              )}
            </fieldset>
          )}

          {draft.type === "essay" && <p className="m-0 text-body text-muted">You grade essay answers yourself.</p>}

          {usesTypedAnswers(draft.type) && (
            <div className="flex flex-col">
              <Check label="Always use strict spelling for this question" checked={draft.alwaysStrict} onChange={(value) => patch({ alwaysStrict: value })} />
              <Check label="Capitals matter (“Co” is not “CO”)" checked={draft.caseSensitive} onChange={(value) => patch({ caseSensitive: value })} />
            </div>
          )}

          {errors.length > 0 && (
            <Notes tone="danger" title="Not saved" items={errors.map((error) => error.message)} />
          )}
          {reveal && attention.length > 0 && <Notes tone="warning" title="Needs attention" items={attention} />}
          {draft.warnings.length > 0 && <Notes tone="info" title="From the import" items={draft.warnings} />}
          {draft.source && (
            <details className="rounded-control border border-line text-body">
              <summary className="flex min-h-touch cursor-pointer items-center px-3 font-medium text-ink">
                Original text{draft.number !== null && draft.number !== undefined ? ` (number ${draft.number} in the document)` : ""}
              </summary>
              <pre className="m-0 overflow-x-auto border-t border-line p-3 font-sans text-body whitespace-pre-wrap text-ink">{draft.source}</pre>
            </details>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button variant="ghost" icon={<Copy aria-hidden className="size-4" />} onClick={onDuplicate}>Duplicate{" "}<span className="sr-only">question {number}</span></Button>
            <Button variant="ghost" icon={<ArrowUp aria-hidden className="size-4" />} data-focus={focus("move-up")} disabled={!canMoveUp} onClick={() => onMove(-1)}>Move up{" "}<span className="sr-only">question {number}</span></Button>
            <Button variant="ghost" icon={<ArrowDown aria-hidden className="size-4" />} data-focus={focus("move-down")} disabled={!canMoveDown} onClick={() => onMove(1)}>Move down{" "}<span className="sr-only">question {number}</span></Button>
            <Button variant="ghost" className="text-danger" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => (draft.prompt.trim() ? setConfirming(true) : onRemove())}>
              Remove{" "}<span className="sr-only">question {number}</span>
            </Button>
          </div>
        </div>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={`Remove question ${number}?`}
          description={`“${draft.prompt.trim().slice(0, 120)}” and its answers are removed. Nothing changes for students until you save.`}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Keep question</Button></DialogClose>
              <Button variant="danger" onClick={() => { setConfirming(false); onRemove(); }}>Remove question</Button>
            </>
          }
        />
      </Dialog>
    </article>
  );
}
