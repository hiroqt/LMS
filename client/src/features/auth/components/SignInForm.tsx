import { ArrowRight, Check, ChevronDown, CircleAlert, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../../../shared/ui/Menu";
import { MOCK_ACCOUNTS } from "../api/demoAccount";
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
export function SignInForm({
  brand,
  signIn,
  onSignedIn,
}: {
  /** Shown above the heading, e.g. the product's mark. */
  brand?: ReactNode;
  signIn: SignIn;
  onSignedIn: (roles: WorkspaceRole[]) => void;
}) {
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
    // One column; on a phone held sideways (landscape-short, D-066) the brand, heading, and demo
    // accounts sit on the left and the form on the right, so the card fits the short screen.
    <section
      aria-labelledby="login-title"
      className="flex w-full flex-col gap-7 landscape-short:grid landscape-short:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] landscape-short:grid-rows-[auto_1fr] landscape-short:gap-x-6 landscape-short:gap-y-3"
    >
      <div className="flex flex-col gap-8 landscape-short:col-start-1 landscape-short:row-start-1 landscape-short:gap-4">
        {brand}
        <div className="flex flex-col gap-2 landscape-short:gap-1">
          <h1 id="login-title" className="text-page-mobile font-semibold tracking-tight sm:text-page landscape-short:text-page-mobile">Sign in</h1>
          <p className="text-body-lg text-muted landscape-short:text-body">Use your college email and password to open your workspace.</p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={form.submit}
        aria-labelledby="login-title"
        aria-busy={form.submitting || undefined}
        className="flex flex-col gap-5 landscape-short:col-start-2 landscape-short:row-span-2 landscape-short:row-start-1 landscape-short:gap-3"
      >
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

      <div className="flex justify-center pt-1 landscape-short:col-start-1 landscape-short:row-start-2 landscape-short:items-end landscape-short:justify-start landscape-short:pt-0">
        <Menu modal={false}>
          <MenuTrigger asChild>
            {/* Every dropdown button is a secondary Button with a trailing chevron. */}
            <Button variant="secondary">
              Demo accounts
              <ChevronDown aria-hidden className="size-4 shrink-0" />
            </Button>
          </MenuTrigger>
          <MenuContent
            side="top"
            align="center"
            sideOffset={8}
            avoidCollisions
            collisionPadding={16}
            className="w-72 max-h-[min(18rem,var(--radix-dropdown-menu-content-available-height,18rem))] overflow-y-auto"
          >
            <MenuLabel>Select an account to fill</MenuLabel>
            <MenuSeparator />
            {MOCK_ACCOUNTS.map((account) => (
              <MenuItem
                key={account.role}
                onSelect={() => form.fill(account.email, account.password)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-ink">{account.label}</span>
                  <span className="text-body text-muted">{account.password}</span>
                </div>
                <span className="text-body text-muted break-all">{account.email}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
    </section>
  );
}
