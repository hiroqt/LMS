import type { VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./buttonVariants";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a link) with button styles. */
  asChild?: boolean;
  /** Shows a spinner, sets aria-busy, and blocks clicks while work is in flight. */
  loading?: boolean;
  /** Text announced instead of the label while loading, e.g. "Saving…". */
  loadingLabel?: string;
  icon?: ReactNode;
}

export function Button({ asChild, loading, loadingLabel, icon, variant, size, block, className, children, disabled, type, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className);
  if (asChild) {
    return <Slot.Root className={classes} {...props}>{children}</Slot.Root>;
  }
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
