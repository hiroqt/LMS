import { Check } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useId } from "react";
import { cn } from "../../lib/cn";
import type { QuizOption } from "./types";

export interface ChoiceAnswerProps {
  options: QuizOption[];
  /** The question number, for the group's accessible name. */
  number: number;
  value: number | undefined;
  onChange: (optionId: number) => void;
  /** Show the number-key tip (the quiz listens for the keys). */
  shortcuts?: boolean;
  /** Extra description ids for the group. */
  describedBy?: string;
  onPointerDown?: () => void;
}

/** Multiple choice and true or false: one radio per option, lettered A, B, C. */
export function ChoiceAnswer({ options, number, value, onChange, shortcuts = false, describedBy, onPointerDown }: ChoiceAnswerProps) {
  const tipId = useId();
  return (
    <div className="flex flex-col gap-2">
      <RadioGroup.Root
        aria-label={`Choose an answer for question ${number}`}
        aria-describedby={[shortcuts ? tipId : undefined, describedBy].filter(Boolean).join(" ") || undefined}
        value={value === undefined ? "" : String(value)}
        onValueChange={(next) => onChange(Number(next))}
        onPointerDown={onPointerDown}
        className="flex flex-col gap-2"
      >
        {options.map((option, index) => {
          const selected = value === option.id;
          return (
            <RadioGroup.Item
              key={option.id}
              value={String(option.id)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-card border-2 px-4 py-3 text-left font-sans text-body-lg text-ink transition-colors motion-reduce:transition-none",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
                selected ? "border-primary-600 bg-primary-50" : "border-line bg-surface hover:border-primary-300",
              )}
            >
              <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full text-body font-semibold", selected ? "bg-primary-600 text-white" : "bg-canvas text-ink")}>
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1 break-words">{option.text}</span>
              {selected && <Check aria-hidden className="size-5 text-primary-700" />}
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>
      {shortcuts && <p id={tipId} className="m-0 text-body text-muted">Select one answer. Tip: press 1–{options.length} on a keyboard.</p>}
    </div>
  );
}
