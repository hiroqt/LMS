import { falseOptionId, itemCountOf } from "./answers";
import { ChoiceAnswer } from "./ChoiceAnswer";
import { EnumerationAnswer } from "./EnumerationAnswer";
import { EssayAnswer } from "./EssayAnswer";
import { IdentificationAnswer } from "./IdentificationAnswer";
import { MatchingAnswer } from "./MatchingAnswer";
import { ModifiedTrueFalseAnswer } from "./ModifiedTrueFalseAnswer";
import type { AnswerChange, AnswerValue, QuizQuestion } from "./types";

export interface QuestionAnswerProps {
  question: QuizQuestion;
  /** The question's number on screen (1-based). */
  number: number;
  value: AnswerValue;
  /** `choice` changes save at once; `typed` changes save after a pause. */
  onChange: (value: AnswerValue, change: AnswerChange) => void;
  /** Show the number-key tip on choice questions. */
  shortcuts?: boolean;
}

/** The input a question's type needs. Shared by the student quiz and the instructor preview. */
export function QuestionAnswer({ question, number, value, onChange, shortcuts = false }: QuestionAnswerProps) {
  switch (question.type) {
    case "identification":
      return <IdentificationAnswer number={number} value={value.text ?? ""} onChange={(text) => onChange({ ...value, text }, "typed")} />;
    case "enumeration":
      return <EnumerationAnswer number={number} count={itemCountOf(question)} value={value.items ?? []} onChange={(items) => onChange({ ...value, items }, "typed")} />;
    case "essay":
      return <EssayAnswer number={number} value={value.text ?? ""} onChange={(text) => onChange({ ...value, text }, "typed")} />;
    case "matching":
      return <MatchingAnswer number={number} lefts={question.lefts ?? []} rights={question.rights ?? []} value={value.matches ?? {}} onChange={(matches) => onChange({ ...value, matches }, "choice")} />;
    case "modified_true_false":
      return (
        <ModifiedTrueFalseAnswer
          number={number}
          options={question.options}
          falseId={falseOptionId(question)}
          optionId={value.optionId}
          correction={value.text ?? ""}
          shortcuts={shortcuts}
          onChoose={(optionId) => onChange({ ...value, optionId }, "choice")}
          onCorrection={(text) => onChange({ ...value, text }, "typed")}
        />
      );
    default:
      // Multiple choice, true or false, and any choice type added later.
      return <ChoiceAnswer options={question.options} number={number} value={value.optionId} shortcuts={shortcuts} onChange={(optionId) => onChange({ ...value, optionId }, "choice")} />;
  }
}
