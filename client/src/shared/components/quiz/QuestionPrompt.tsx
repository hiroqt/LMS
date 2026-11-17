import { splitUnderlined } from "./answers";
import type { QuizQuestion } from "./types";

/**
 * A question's prompt as text. For modified true or false, the phrase in
 * `underlined` is drawn in <u>, with "(underlined)" for screen readers, which
 * do not announce underlines. No HTML is ever stored (D-040).
 */
export function QuestionPrompt({ question }: { question: Pick<QuizQuestion, "type" | "prompt" | "underlined"> }) {
  const parts = question.type === "modified_true_false" ? splitUnderlined(question.prompt, question.underlined) : null;
  if (!parts) return <>{question.prompt}</>;
  const [before, phrase, after] = parts;
  return (
    <>
      {before}
      <u className="underline-offset-4">{phrase}</u>
      <span className="sr-only"> (underlined)</span>
      {after}
    </>
  );
}
