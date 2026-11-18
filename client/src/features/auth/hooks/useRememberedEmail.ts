import { usePersistentState } from "../../../shared/hooks/usePersistentState";

/**
 * "Remember me": the email kept on this device for the next sign-in, or "" when none is.
 * Only the email is kept, never the password.
 */
export function useRememberedEmail() {
  return usePersistentState<string>("tmcc-remembered-email", "");
}
