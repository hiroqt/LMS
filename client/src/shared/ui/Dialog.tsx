import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export interface DialogContentProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row. Put the primary action last. */
  footer?: ReactNode;
  className?: string;
  /**
   * Runs as the dialog closes, before focus returns to what opened it. Call `preventDefault()` and
   * focus something else when that control is gone, e.g. after the action replaced it (L-015).
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Modal dialog: focus is trapped and restored, Esc and the close button
 * dismiss it, and the title and description are announced. On phones it
 * becomes a bottom sheet.
 */
export function DialogContent({ title, description, children, footer, className, onCloseAutoFocus }: DialogContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <Primitive.Content
        className={cn(
          "fixed z-50 flex max-h-[90dvh] w-full flex-col overflow-hidden bg-surface font-sans text-ink shadow-popover",
          "inset-x-0 bottom-0 rounded-t-card pb-[env(safe-area-inset-bottom)]",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-0",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Primitive.Title className="m-0 font-sans text-section font-semibold">{title}</Primitive.Title>
            {description && <Primitive.Description className="m-0 text-body text-muted">{description}</Primitive.Description>}
          </div>
          <Primitive.Close
            aria-label="Close"
            className="-m-2 grid size-touch shrink-0 place-items-center rounded-control border-0 bg-transparent text-muted hover:bg-primary-50 hover:text-ink focus-visible:outline-3 focus-visible:outline-focus"
          >
            <X aria-hidden className="size-5" />
          </Primitive.Close>
        </div>
        {children && <div className="overflow-y-auto px-5 py-4 text-body">{children}</div>}
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
