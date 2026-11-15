import { createContext } from "react";

export interface StudentSession {
  /** Materials marked reviewed. Session-only, like the classic UI. */
  reviewed: ReadonlySet<string>;
  toggleReviewed: (materialId: string) => void;
  /** Clears saved answers, completions, and reviewed marks, then shows Today. */
  resetDemo: () => void;
}

export const StudentSessionContext = createContext<StudentSession | null>(null);
