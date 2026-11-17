import { CircleCheck, CircleMinus, CircleX, Hourglass, SpellCheck } from "lucide-react";
import { cn } from "../../lib/cn";
import { describeGiven, describeKey, MATCH_NOTES, OUTCOME_LABELS, outcomeOf, pointsOf, type Outcome } from "./answers";
import type { AnswerValue, MatchNote, QuizQuestion } from "./types";

const ICONS: Record<Outcome, typeof CircleCheck> = { correct: CircleCheck, partial: CircleMinus, incorrect: CircleX, waiting: Hourglass };
const TONES: Record<Outcome, string> = { correct: "text-success", partial: "text-warning", incorrect: "text-danger", waiting: "text-info" };

export interface QuestionResultProps {
  question: QuizQuestion;
  value: AnswerValue;
  pointsAwarded: number | null | undefined;
  matchNote?: MatchNote | null;
  /** Show what the student gave (the results page does; the preview shows the inputs instead). */
  showGiven?: boolean;
}

/** How one question went: an icon with text (never color alone), the spelling note, and the key when allowed. */
export function QuestionResult({ question, value, pointsAwarded, matchNote, showGiven = true }: QuestionResultProps) {
  const outcome = outcomeOf(question, pointsAwarded);
  const Icon = ICONS[outcome];
  const given = showGiven ? describeGiven(question, value) : null;
  const key = describeKey(question);
  const note = matchNote ? MATCH_NOTES[matchNote] : undefined;
  return (
    <div className="flex flex-col gap-1.5 text-body">
      <p className={cn("m-0 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold", TONES[outcome])}>
        <Icon aria-hidden className="size-5 shrink-0" />
        <span>{OUTCOME_LABELS[outcome]}</span>
        {pointsAwarded !== null && pointsAwarded !== undefined && <span className="font-normal text-ink">· {pointsOf(pointsAwarded, question.points)}</span>}
      </p>
      {showGiven && <p className="m-0 break-words text-ink"><span className="text-muted">Your answer: </span>{given ?? "No answer"}</p>}
      {note && (
        <p className="m-0 flex items-center gap-2 text-ink">
          <SpellCheck aria-hidden className="size-4 shrink-0 text-muted" />
          {note}
        </p>
      )}
      {key && <p className="m-0 break-words text-ink"><span className="text-muted">Correct answer: </span>{key}</p>}
    </div>
  );
}
