import { describeAnswer, describeKey, splitUnderlined, type GradedAnswer, type KeyPart, type KeyedQuestion } from "../api/grading";

/** The prompt, with a modified true or false statement's phrase underlined (no HTML is stored). */
export function QuestionPrompt({ question }: { question: Pick<KeyedQuestion, "prompt" | "underlined" | "type"> }) {
  const parts = question.type === "modified_true_false" ? splitUnderlined(question.prompt, question.underlined) : null;
  if (!parts) return <>{question.prompt}</>;
  return (
    <>
      {parts.before}
      <u className="underline-offset-4">{parts.phrase}</u>
      {parts.after}
    </>
  );
}

function Parts({ heading, parts, pairs }: { heading: string; parts: KeyPart[]; pairs: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-control border border-line bg-surface p-3">
      <h4 className="m-0 text-body font-semibold text-muted">{heading}</h4>
      <dl className="m-0 flex flex-col gap-1 text-body">
        {parts.map((part, index) => (
          <div key={`${part.label}-${index}`} className={pairs ? "flex flex-wrap gap-x-2" : "flex flex-col"}>
            <dt className={pairs ? "font-medium text-ink" : "text-muted"}>{pairs ? `${part.label} →` : part.label}</dt>
            <dd className="m-0 break-words whitespace-pre-wrap text-ink">{part.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The student's answer next to the answer key, for every type in the contract (§1). */
export function AnswerBesideKey({ question, answer }: { question: KeyedQuestion; answer: GradedAnswer | undefined }) {
  const key = describeKey(question);
  const given = describeAnswer(question, answer);
  const pairs = question.type === "matching";
  if (!key.length) return <Parts heading="Student's answer" parts={given} pairs={false} />;
  return (
    <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
      <Parts heading="Student's answer" parts={given} pairs={pairs} />
      <Parts heading="Answer key" parts={key} pairs={pairs} />
    </div>
  );
}
