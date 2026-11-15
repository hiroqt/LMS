import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "icon" | "size" | "aria-label"> {
  /** Required accessible name: icon-only buttons have no visible text (C-004). */
  label: string;
  children: ReactNode;
}

/** A 44px icon-only button. The label is announced and shown as a tooltip. */
export function IconButton({ label, children, variant = "ghost", title, ...props }: IconButtonProps) {
  return (
    <Button variant={variant} size="icon" aria-label={label} title={title ?? label} {...props}>
      <span aria-hidden className="inline-flex [&>svg]:size-5">{children}</span>
    </Button>
  );
}
