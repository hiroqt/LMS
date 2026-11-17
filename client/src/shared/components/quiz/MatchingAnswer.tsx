import { useId } from "react";
import { Select } from "../../ui/Field";
import type { QuizOption } from "./types";

export interface MatchingAnswerProps {
  number: number;
  lefts: QuizOption[];
  rights: string[];
  /** Left id (as a string) → the chosen right-hand text. */
  value: Record<string, string>;
  onChange: (matches: Record<string, string>) => void;
}

/** Matching: a native select per left-hand item (C-008), choosing from the right-hand items. */
export function MatchingAnswer({ number, lefts, rights, value, onChange }: MatchingAnswerProps) {
  const id = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-2 p-0 text-body text-muted">
        Choose the match for each item.<span className="sr-only"> Question {number}.</span>
      </legend>
      <div className="@container flex flex-col gap-3">
      {lefts.map((left) => {
        const key = String(left.id);
        return (
          <div key={left.id} className="flex flex-col gap-1.5 @xl:flex-row @xl:items-center @xl:gap-4">
            <label htmlFor={`${id}-${key}`} className="text-body font-medium text-ink @xl:w-1/2">
              {left.text}
              <span className="sr-only">, question {number}</span>
            </label>
            <Select
              id={`${id}-${key}`}
              value={value[key] ?? ""}
              className="@xl:w-1/2"
              onChange={(event) => {
                const next = { ...value };
                if (event.target.value) next[key] = event.target.value;
                else delete next[key];
                onChange(next);
              }}
            >
              <option value="">Choose a match</option>
              {rights.map((right) => (
                <option key={right} value={right}>{right}</option>
              ))}
            </Select>
          </div>
        );
      })}
      </div>
    </fieldset>
  );
}
