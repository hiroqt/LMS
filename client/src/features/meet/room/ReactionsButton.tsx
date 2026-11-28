import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../shared/ui/Popover";
import { cn } from "../../../shared/lib/cn";
import { REACTIONS, type Reaction } from "./metadata";

/** Sends a reaction: a menu of six, each named for screen readers. */
export function ReactionsButton({ onSend, labelHidden }: { onSend: (reaction: Reaction) => void; labelHidden: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={labelHidden ? "Reactions" : undefined}
          className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 font-sans text-body font-semibold text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <SmilePlus aria-hidden className="size-5" />
          <span className={cn(labelHidden && "sr-only")}>Reactions</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" aria-label="Send a reaction" className="w-auto">
        <ul className="m-0 grid list-none grid-cols-3 gap-1 p-0">
          {REACTIONS.map((reaction) => (
            <li key={reaction.emoji}>
              <button
                type="button"
                aria-label={reaction.name}
                title={reaction.name}
                onClick={() => {
                  onSend(reaction);
                  setOpen(false);
                }}
                className="flex size-11 items-center justify-center rounded-control text-section hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
              >
                <span aria-hidden>{reaction.emoji}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
