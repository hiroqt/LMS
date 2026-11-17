import { CircleCheck, CircleX, Clock, SpellCheck } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { matchNoteText, type MatchNote, type SpellingDecision } from "../api/grading";

/** A spelling note as an icon with text on a soft tint (C-019: never a dot). Exact matches show nothing. */
export function MatchNoteLabel({ note, decision, className }: { note: MatchNote | null | undefined; decision?: SpellingDecision | null; className?: string }) {
  const text = matchNoteText(note, decision);
  if (!text) return null;
  const tone =
    decision === "accepted" ? "bg-success-soft text-success"
      : decision === "rejected" ? "bg-danger-soft text-danger"
        : note === "review" ? "bg-warning-soft text-warning"
          : "bg-info-soft text-info";
  const Icon = decision === "accepted" ? CircleCheck : decision === "rejected" ? CircleX : note === "review" ? Clock : SpellCheck;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-control px-2 py-1 font-sans text-body font-medium", tone, className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {text}
    </span>
  );
}
