import { Info, Mail } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../../../shared/ui/Dialog";
import { Field } from "../../../shared/ui/Field";
import { demoRequestPasswordReset } from "../api/demoAccount";
import { emailError } from "../validation";
import { AuthInput } from "./AuthInput";
import { FieldError } from "./FieldError";

/**
 * "Forgot password?" and its dialog. There is no account service yet, so a valid
 * request ends on a message that says no email was sent, instead of pretending.
 */
export function ResetPasswordDialog({
  defaultEmail = "",
  requestReset = demoRequestPasswordReset,
}: {
  defaultEmail?: string;
  requestReset?: (email: string) => Promise<void>;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [requestedFor, setRequestedFor] = useState<string | null>(null);

  const onOpenChange = (next: boolean) => {
    // Start from what the person already typed on the sign-in form.
    if (next) {
      setEmail(defaultEmail);
      setError(null);
      setSending(false);
      setRequestedFor(null);
    }
    setOpen(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const problem = emailError(email);
    setError(problem);
    if (problem) {
      (event.currentTarget.elements.namedItem("reset-email") as HTMLElement | null)?.focus();
      return;
    }
    setSending(true);
    await requestReset(email.trim());
    setSending(false);
    setRequestedFor(email.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className="inline-flex min-h-touch items-center rounded-control px-2 font-sans text-body font-semibold text-primary-700 transition-colors duration-150 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-3 focus-visible:outline-focus">
        Forgot password?
      </DialogTrigger>
      {requestedFor ? (
        <DialogContent title="Reset password" footer={<DialogClose asChild><Button>Close</Button></DialogClose>}>
          <p role="status" className="flex items-start gap-3 rounded-control bg-info-soft p-3 text-info">
            <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              Password reset is not connected yet, so no email was sent to <strong className="font-semibold break-all">{requestedFor}</strong>. Ask the
              school&apos;s LMS administrator to reset your password.
            </span>
          </p>
        </DialogContent>
      ) : (
        <DialogContent
          title="Reset password"
          description="Enter your registered email to receive a reset link."
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" form={formId} loading={sending} loadingLabel="Sending…">Send reset link</Button>
            </>
          }
        >
          <form id={formId} noValidate onSubmit={submit}>
            <Field label="Registered email" error={error && <FieldError message={error} />}>
              <AuthInput
                icon={Mail}
                name="reset-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@example.com"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
              />
            </Field>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
