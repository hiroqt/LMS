import { DropdownMenu as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Menu = Primitive.Root;
export const MenuTrigger = Primitive.Trigger;
export const MenuGroup = Primitive.Group;

/** Dropdown menu with roving focus, typeahead, and Esc to close. */
export function MenuContent({ className, sideOffset = 8, align = "end", ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 min-w-56 rounded-card border border-line bg-surface p-1.5 font-sans text-ink shadow-popover", className)}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "flex min-h-touch cursor-pointer items-center gap-2.5 rounded-control px-3 text-body outline-none select-none [&>svg]:size-4 [&>svg]:text-muted",
        "data-highlighted:bg-primary-50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn("px-3 pt-2 pb-1 text-body font-semibold text-muted", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn("my-1.5 h-px bg-line", className)} {...props} />;
}
