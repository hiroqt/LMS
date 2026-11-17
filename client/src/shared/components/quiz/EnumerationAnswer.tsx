import { useId } from "react";
import { Input } from "../../ui/Field";
import { AnswerLabel as Label } from "./AnswerLabel";
import { ANSWER_LIMITS } from "./types";

export interface EnumerationAnswerProps {
  number: number;
  /** How many items the question expects. */
  count: number;
  value: string[];
  onChange: (items: string[]) => void;
}

/** Enumeration: one labelled input per expected item, in any order. */
export function EnumerationAnswer({ number, count, value, onChange }: EnumerationAnswerProps) {
  const id = useId();
  const items = Array.from({ length: Math.min(count, ANSWER_LIMITS.items) }, (_, index) => value[index] ?? "");
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-2 p-0 text-body text-muted">
        Give {items.length} {items.length === 1 ? "answer" : "answers"}, in any order.<span className="sr-only"> Question {number}.</span>
      </legend>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-${index}`} text={`Answer ${index + 1}`} number={number} />
          <Input
            id={`${id}-${index}`}
            value={item}
            maxLength={ANSWER_LIMITS.text}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => onChange(items.map((current, at) => (at === index ? event.target.value : current)))}
          />
        </div>
      ))}
    </fieldset>
  );
}
