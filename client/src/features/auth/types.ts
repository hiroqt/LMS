/** A workspace an account can open after signing in. */
export type WorkspaceRole = "student" | "instructor" | "admin";

export interface Credentials {
  email: string;
  password: string;
}

export interface SignInResult {
  /** The workspaces this account can open. More than one opens "Choose a workspace". */
  roles: WorkspaceRole[];
}

export type SignIn = (credentials: Credentials) => Promise<SignInResult>;
