import { useId } from "react";
import { Input } from "../../ui/Field";
import { AnswerLabel as Label } from "./AnswerLabel";
import { ANSWER_LIMITS } from "./types";

export interface IdentificationAnswerProps {
  number: number;
  value: string;
  onChange: (text: string) => void;
}

/** Identification: one short answer. */
export function IdentificationAnswer({ number, value, onChange }: IdentificationAnswerProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} text="Your answer" number={number} />
      <Input id={id} value={value} maxLength={ANSWER_LIMITS.text} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
