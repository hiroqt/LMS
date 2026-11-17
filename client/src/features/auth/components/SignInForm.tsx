import { ArrowRight, Check, CircleAlert, Info, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { useRememberedEmail } from "../hooks/useRememberedEmail";
import { useSignInForm } from "../hooks/useSignInForm";
import type { SignIn, WorkspaceRole } from "../types";
import { AuthInput } from "./AuthInput";
import { FieldError } from "./FieldError";
import { PasswordInput } from "./PasswordInput";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

/**
 * The sign-in heading and form. It checks the fields, shows the button's busy state while
 * `signIn` is pending, keeps or forgets the email for "Remember me" once sign-in succeeds,
 * and hands the account's workspaces to `onSignedIn`.
 */
export function SignInForm({ signIn, onSignedIn }: { signIn: SignIn; onSignedIn: (roles: WorkspaceRole[]) => void }) {
  const [rememberedEmail, setRememberedEmail] = useRememberedEmail();
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const form = useSignInForm({
    signIn,
    initialEmail: rememberedEmail,
    onSignedIn: (roles, email) => {
      setRememberedEmail(remember ? email : "");
      onSignedIn(roles);
    },
  });

  return (
    <section aria-labelledby="login-title" className="flex w-full flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 id="login-title" className="text-page-mobile font-semibold tracking-tight sm:text-page">Sign in</h1>
        <p className="text-body-lg text-muted">Use your college email and password to open your workspace.</p>
      </div>

      <form noValidate onSubmit={form.submit} aria-labelledby="login-title" aria-busy={form.submitting || undefined} className="flex flex-col gap-5">
        <Field label="Email" error={form.errors.email && <FieldError message={form.errors.email} />}>
          <AuthInput
            icon={Mail}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            required
            valid={form.emailValid}
            value={form.values.email}
            onChange={(event) => form.change("email", event.target.value)}
            onBlur={() => form.blur("email")}
          />
        </Field>

        <Field label="Password" error={form.errors.password && <FieldError message={form.errors.password} />}>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            required
            value={form.values.password}
            onChange={(event) => form.change("password", event.target.value)}
            onBlur={() => form.blur("password")}
          />
        </Field>

        <div className="-my-1 flex flex-wrap items-center justify-between gap-x-4">
          <label className="group -ml-1 flex min-h-touch cursor-pointer items-center gap-2.5 rounded-control px-1 text-body font-medium text-ink">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="peer sr-only"
            />
            {/* The native box is visually hidden; this one shows its state and the focus ring. */}
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-tick border-2 border-line-strong bg-surface text-white transition-colors duration-150 group-hover:border-primary-700 peer-checked:border-primary-700 peer-checked:bg-primary-700 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
            >
              <Check className="size-3.5 stroke-3 transition-opacity duration-150" />
            </span>
            Remember me
          </label>
          <ResetPasswordDialog defaultEmail={form.values.email} />
        </div>

        {form.failure && (
          <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft p-3 text-body font-medium text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {form.failure}
          </p>
        )}

        <Button type="submit" size="lg" block loading={form.submitting} loadingLabel="Signing in…">
          Sign in to portal
          <ArrowRight aria-hidden className="size-5" />
        </Button>
      </form>

      <p className="flex items-start gap-2 rounded-control bg-info-soft p-3 text-body text-info">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>Accounts are not connected yet. Any email and password open the demo workspaces. Remember me keeps only your email, on this device.</span>
      </p>
    </section>
  );
}
