import type { Credentials, SignInResult, WorkspaceRole } from "../types";

/**
 * Stand-ins for the account service (D-044, D-045). No request is sent and nothing is stored.
 * Replace these two functions when sign-in is built; the page already handles a pending
 * request, a single workspace (opens it directly), and several (asks which one).
 */

const DEMO_ROLES: WorkspaceRole[] = ["student", "instructor", "admin"];

// Long enough that the busy state is visible, as it will be over a real network.
const DEMO_LATENCY_MS = 450;

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));

/** Every filled-in email and password opens all three demo workspaces. */
export async function demoSignIn(credentials: Credentials): Promise<SignInResult> {
  void credentials;
  await wait();
  return { roles: [...DEMO_ROLES] };
}

/** Resolves without sending anything; the dialog says no email was sent. */
export async function demoRequestPasswordReset(email: string): Promise<void> {
  void email;
  await wait();
}
