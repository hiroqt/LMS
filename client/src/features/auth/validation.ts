/** Something@domain.tld, with no spaces. The account service does the real check. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The message to show under an email field, or null when the value can be sent. */
export function emailError(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email.";
  if (!EMAIL.test(email)) return "Enter an email address like name@example.com.";
  return null;
}

export function passwordError(value: string): string | null {
  return value ? null : "Enter your password.";
}
