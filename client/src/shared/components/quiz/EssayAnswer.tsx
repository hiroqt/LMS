import { useId } from "react";
import { Textarea } from "../../ui/Field";
import { AnswerLabel as Label } from "./AnswerLabel";
import { ANSWER_LIMITS } from "./types";

export interface EssayAnswerProps {
  number: number;
  value: string;
  onChange: (text: string) => void;
}

/** Essay: a long answer with a character count. Graded by the instructor. */
export function EssayAnswer({ number, value, onChange }: EssayAnswerProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} text="Your answer" number={number} />
      <Textarea id={id} rows={8} value={value} maxLength={ANSWER_LIMITS.essay} aria-describedby={`${id}-count`} onChange={(event) => onChange(event.target.value)} />
      <p id={`${id}-count`} className="m-0 text-body text-muted">
        {value.length.toLocaleString("en-US")} of {ANSWER_LIMITS.essay.toLocaleString("en-US")} characters. Your instructor grades this answer.
      </p>
    </div>
  );
}
