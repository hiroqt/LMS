import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Dashboard cards in one row (D-071). On a phone they stack. From `@xl` they sit side by
 * side and share the width; once there are more than fit, each keeps its width and the row
 * scrolls sideways instead of wrapping onto a second line. The cards are buttons, so the
 * keyboard reaches every one and the row follows focus.
 */
export function CardRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    // The padding (and the margin that cancels it) leaves room for a card's focus ring,
    // which a scrolling box would otherwise clip. `relative` makes the row the containing
    // block of the cards' `sr-only` text; without it that text, scrolled out of view, still
    // widens the page.
    <ul className={cn("relative m-0 flex list-none flex-col gap-3 p-0 @xl:-m-1.5 @xl:snap-x @xl:scroll-px-1.5 @xl:flex-row @xl:overflow-x-auto @xl:p-1.5 @xl:[scrollbar-width:thin]", className)}>
      {children}
    </ul>
  );
}

export function CardRowItem({ children }: { children: ReactNode }) {
  // min-w-0: a card's width is its share of the row, never the length of its longest title.
  return <li className="@xl:min-w-0 @xl:flex-[1_0_15rem] @xl:snap-start">{children}</li>;
}
