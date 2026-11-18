import { CircleCheck, type LucideIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../../shared/lib/cn";
import { Input } from "../../../shared/ui/Field";

export interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Shown at the left edge; turns green while the field has focus. */
  icon: LucideIcon;
  /** A control at the right edge, such as the password visibility toggle. */
  trailing?: ReactNode;
  /** Shows a check and a green border. The error state comes from the surrounding `Field`. */
  valid?: boolean;
}

/**
 * The shared `Input` (label, hint, and error stay linked through `Field`) with a leading icon,
 * a 48px height, and room for a status icon or a button. Motion is the 150 ms color change only (C-019).
 */
export function AuthInput({ icon: Icon, trailing, valid = false, className, ...props }: AuthInputProps) {
  return (
    <div className="group relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted transition-colors duration-150 group-focus-within:text-primary-700"
      />
      <Input
        className={cn(
          "min-h-12 pl-11 transition-colors duration-150 hover:border-muted",
          (trailing || valid) && "pr-12",
          valid && "border-success hover:border-success",
          className,
        )}
        {...props}
      />
      {trailing ? (
        <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>
      ) : (
        valid && <CircleCheck aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-success" />
      )}
    </div>
  );
}
