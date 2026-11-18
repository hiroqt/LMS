import { CircleAlert } from "lucide-react";

/**
 * An error message with an icon, for `Field`'s `error` prop. Render it only when there is a
 * message: `Field` marks the control invalid whenever `error` is set. The icon is hidden from screen
 * readers, so the field's accessible description is the message alone.
 */
export function FieldError({ message }: { message: string }) {
  return (
    <span className="flex items-start gap-1.5">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </span>
  );
}
