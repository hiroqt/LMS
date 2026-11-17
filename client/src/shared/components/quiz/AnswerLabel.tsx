/** A visible label that also names the question for screen readers. */
export function AnswerLabel({ htmlFor, text, number }: { htmlFor: string; text: string; number: number }) {
  return (
    <label htmlFor={htmlFor} className="text-body font-medium text-ink">
      {text}{" "}
      <span className="sr-only">for question {number}</span>
    </label>
  );
}
