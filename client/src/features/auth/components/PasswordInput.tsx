import { Eye, EyeOff, LockKeyhole, TriangleAlert } from "lucide-react";
import { useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { AuthInput } from "./AuthInput";

/**
 * A password field with a visibility toggle and a Caps Lock notice. The toggle keeps one
 * name ("Show password") and reports its state with aria-pressed (C-014).
 */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));

  return (
    <div className="flex flex-col">
      <AuthInput
        {...props}
        icon={LockKeyhole}
        type={shown ? "text" : "password"}
        onKeyDown={(event) => {
          readCapsLock(event);
          props.onKeyDown?.(event);
        }}
        onKeyUp={readCapsLock}
        onBlur={(event) => {
          setCapsLock(false);
          props.onBlur?.(event);
        }}
        trailing={
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={shown}
            title={shown ? "Hide password" : "Show password"}
            onClick={() => setShown((current) => !current)}
            className="grid h-full w-touch place-items-center rounded-control text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
          >
            {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        }
      />
      {/* Always in the DOM so the notice is announced when it appears; empty, it takes no space. */}
      <p aria-live="polite" className="text-body font-medium text-warning">
        {capsLock && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            Caps Lock is on.
          </span>
        )}
      </p>
    </div>
  );
}
