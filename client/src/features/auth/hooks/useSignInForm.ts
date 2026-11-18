import { useState, type FormEvent } from "react";
import type { SignIn, WorkspaceRole } from "../types";
import { emailError, passwordError } from "../validation";

type FieldName = "email" | "password";
type Values = Record<FieldName, string>;
type Errors = Record<FieldName, string | null>;

const validators: Record<FieldName, (value: string) => string | null> = { email: emailError, password: passwordError };
const FIELDS: FieldName[] = ["email", "password"];

/**
 * State for the sign-in form. A field is checked when the person leaves it with something
 * typed, or on submit; from then on it is rechecked as they type, so an error clears (and the
 * email shows as valid) the moment it is fixed, but nothing turns red while they are still
 * typing for the first time.
 */
export function useSignInForm({
  signIn,
  onSignedIn,
  initialEmail = "",
}: {
  signIn: SignIn;
  /** Called with the account's workspaces and the email that signed in. */
  onSignedIn: (roles: WorkspaceRole[], email: string) => void;
  /** Prefills the email, e.g. one remembered on this device. */
  initialEmail?: string;
}) {
  const [values, setValues] = useState<Values>({ email: initialEmail, password: "" });
  const [errors, setErrors] = useState<Errors>({ email: null, password: null });
  const [checked, setChecked] = useState<Record<FieldName, boolean>>({ email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const change = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: checked[field] ? validators[field](value) : null }));
    setFailure(null);
  };

  const blur = (field: FieldName) => {
    if (!values[field]) return;
    setChecked((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validators[field](values[field]) }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const next: Errors = { email: emailError(values.email), password: passwordError(values.password) };
    setErrors(next);
    setChecked({ email: true, password: true });
    const firstInvalid = FIELDS.find((field) => next[field]);
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
      return;
    }
    setSubmitting(true);
    setFailure(null);
    try {
      const email = values.email.trim();
      const { roles } = await signIn({ email, password: values.password });
      setSubmitting(false);
      onSignedIn(roles, email);
    } catch {
      setSubmitting(false);
      setFailure("Sign-in did not go through. Check your connection and try again.");
    }
  };

  /** The email shows a check once it has been checked and passes. */
  const emailValid = checked.email && !errors.email && Boolean(values.email.trim());

  return { values, errors, emailValid, submitting, failure, change, blur, submit };
}
