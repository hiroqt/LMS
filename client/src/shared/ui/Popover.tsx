import { Popover as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverClose = Primitive.Close;

/**
 * Non-modal panel anchored to its trigger: Esc and outside clicks close it and
 * focus returns to the trigger. Rendered in place (no portal), so a popover
 * opened from the top bar stays inside the banner landmark.
 */
export function PopoverContent({ className, sideOffset = 8, align = "end", ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      sideOffset={sideOffset}
      align={align}
      collisionPadding={12}
      className={cn("z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-card border border-line bg-surface p-2 font-sans text-ink shadow-popover outline-none", className)}
      {...props}
    />
  );
}
