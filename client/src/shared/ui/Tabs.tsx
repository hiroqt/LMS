import { Tabs as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Tabs = Primitive.Root;

/** Arrow keys move between tabs; the list scrolls sideways on narrow screens. */
export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "-mb-px inline-flex min-h-touch shrink-0 items-center gap-2 border-0 border-b-2 border-transparent bg-transparent px-3 font-sans text-body font-medium text-muted",
        "hover:text-ink focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
        "data-[state=active]:border-primary-600 data-[state=active]:font-semibold data-[state=active]:text-primary-700",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content className={cn("pt-4 focus-visible:outline-3 focus-visible:outline-focus", className)} {...props} />;
}
