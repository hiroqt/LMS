import { useEffect, useId, useRef } from "react";
import { Input } from "../../ui/Field";
import { AnswerLabel } from "./AnswerLabel";
import { ChoiceAnswer } from "./ChoiceAnswer";
import { ANSWER_LIMITS, type QuizOption } from "./types";

export interface ModifiedTrueFalseAnswerProps {
  number: number;
  options: QuizOption[];
  falseId: number | undefined;
  optionId: number | undefined;
  correction: string;
  onChoose: (optionId: number) => void;
  onCorrection: (text: string) => void;
  shortcuts?: boolean;
}

/**
 * Modified true or false: True or False, and a correction for the underlined
 * phrase when the statement is false. The statement itself is drawn by
 * QuestionPrompt. Choosing False with a pointer or a number key moves focus to
 * the correction; arrowing through the radios does not, so the group stays
 * usable from the keyboard.
 */
export function ModifiedTrueFalseAnswer({ number, options, falseId, optionId, correction, onChoose, onCorrection, shortcuts = false }: ModifiedTrueFalseAnswerProps) {
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const correctionRef = useRef<HTMLDivElement>(null);
  const pointer = useRef(false);
  const previous = useRef(optionId);
  const isFalse = optionId !== undefined && optionId === falseId;

  useEffect(() => {
    const becameFalse = isFalse && previous.current !== optionId;
    previous.current = optionId;
    const fromPointer = pointer.current;
    pointer.current = false;
    if (!becameFalse) return;
    const arrowing = groupRef.current?.contains(document.activeElement) && !fromPointer;
    if (!arrowing) correctionRef.current?.querySelector("input")?.focus();
  }, [isFalse, optionId]);

  return (
    // A key press means the keyboard is in charge again, whatever was clicked before.
    <div ref={groupRef} className="flex flex-col gap-3" onKeyDown={() => {
      pointer.current = false;
    }}>
      <p id={`${id}-how`} className="m-0 text-body text-muted">If the statement is false, choose False and write the word or phrase that should replace the underlined part.</p>
      <ChoiceAnswer
        options={options}
        number={number}
        value={optionId}
        onChange={onChoose}
        shortcuts={shortcuts}
        describedBy={`${id}-how`}
        onPointerDown={() => {
          pointer.current = true;
        }}
      />
      {isFalse && (
        <div ref={correctionRef} className="flex flex-col gap-1.5">
          <AnswerLabel htmlFor={`${id}-correction`} text="Correction" number={number} />
          <Input id={`${id}-correction`} value={correction} maxLength={ANSWER_LIMITS.text} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => onCorrection(event.target.value)} />
        </div>
      )}
    </div>
  );
}
