import type { Credentials, SignInResult, WorkspaceRole } from "../types";

export interface MockAccount {
  role: WorkspaceRole;
  label: string;
  email: string;
  password: string;
  description: string;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    role: "student",
    label: "Student",
    email: "student@tmcc.edu.ph",
    password: "student123",
    description: "Student dashboard",
  },
  {
    role: "instructor",
    label: "Instructor",
    email: "instructor@tmcc.edu.ph",
    password: "instructor123",
    description: "Instructor dashboard",
  },
  {
    role: "admin",
    label: "Admin",
    email: "admin@tmcc.edu.ph",
    password: "admin123",
    description: "Admin dashboard",
  },
];

// Brief latency so the button's busy state remains visible.
const DEMO_LATENCY_MS = 250;

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));

/**
 * Validates mockup credentials and returns the dedicated workspace role.
 * - Student (student@tmcc.edu.ph / student123) -> direct to Student workspace
 * - Instructor (instructor@tmcc.edu.ph / instructor123) -> direct to Instructor workspace
 * - Admin (admin@tmcc.edu.ph / admin123) -> direct to Admin workspace
 * - alex@example.com -> opens multi-workspace choice dialog
 */
export async function demoSignIn(credentials: Credentials): Promise<SignInResult> {
  await wait();

  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  // Multi-workspace account for testing choice dialog
  if (email === "alex@example.com" || email === "all@tmcc.edu.ph" || email === "demo@example.com") {
    return { roles: ["student", "instructor", "admin"] };
  }

  // Student mockup account
  if (email === "student@tmcc.edu.ph" || email === "student@example.com" || email.startsWith("student@")) {
    if (password === "student123" || password === "student" || password === "password123") {
      return { roles: ["student"] };
    }
    throw new Error("Invalid password for Student account. Use student123.");
  }

  // Instructor mockup account
  if (email === "instructor@tmcc.edu.ph" || email === "instructor@example.com" || email.startsWith("instructor@") || email.startsWith("faculty@")) {
    if (password === "instructor123" || password === "instructor" || password === "password123") {
      return { roles: ["instructor"] };
    }
    throw new Error("Invalid password for Instructor account. Use instructor123.");
  }

  // Admin mockup account
  if (email === "admin@tmcc.edu.ph" || email === "admin@example.com" || email.startsWith("admin@")) {
    if (password === "admin123" || password === "admin" || password === "password123") {
      return { roles: ["admin"] };
    }
    throw new Error("Invalid password for Admin account. Use admin123.");
  }

  throw new Error("Account not found. Use student@tmcc.edu.ph, instructor@tmcc.edu.ph, or admin@tmcc.edu.ph.");
}

/** Resolves without sending anything; the dialog says no email was sent. */
export async function demoRequestPasswordReset(email: string): Promise<void> {
  void email;
  await wait();
}
