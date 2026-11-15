import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: string;
  /** Helper text shown under the label. */
  hint?: ReactNode;
  /** Error message; marks the control aria-invalid and links the message. */
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label + hint + error wrapper. The child control (Input, Textarea, Select)
 * picks up its id, aria-describedby, aria-invalid, and required from context,
 * so every control has a visible, programmatically linked label (C-004).
 */
export function Field({ label, hint, error, required = false, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-1.5 font-sans", className)}>
        <label htmlFor={id} className="text-body font-medium text-ink">
          {label}
          {required && <span className="text-danger" aria-hidden> *</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {hint && <p id={hintId} className="m-0 text-body text-muted">{hint}</p>}
        {children}
        {error && <p id={errorId} className="m-0 text-body font-medium text-danger">{error}</p>}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps<T extends { id?: string; "aria-describedby"?: string; required?: boolean }>(props: T) {
  const field = useContext(FieldContext);
  if (!field) return { ...props, invalid: false };
  return {
    ...props,
    id: props.id ?? field.id,
    "aria-describedby": [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
    required: props.required ?? field.required,
    invalid: field.invalid,
  };
}

// 16px text prevents iOS Safari from zooming into focused fields (D-005).
const control = [
  "w-full rounded-control border border-line-strong bg-surface px-3 font-sans text-body-lg text-ink",
  "placeholder:text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:bg-canvas aria-invalid:border-danger",
].join(" ");

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const { invalid, ...rest } = useFieldProps(props);
  return <input aria-invalid={invalid || undefined} className={cn(control, "min-h-touch", className)} {...rest} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { invalid, ...rest } = useFieldProps(props);
  return <textarea rows={rows} aria-invalid={invalid || undefined} className={cn(control, "py-2.5", className)} {...rest} />;
}

/** Native select: best keyboard, screen-reader, and mobile picker support. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const { invalid, ...rest } = useFieldProps(props);
  return <select aria-invalid={invalid || undefined} className={cn(control, "min-h-touch pr-8", className)} {...rest} />;
}
