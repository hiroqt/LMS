import { createContext } from "react";

export interface StudentSession {
  /** The student being viewed: a demo identity, not a sign-in (D-032). */
  studentId: string;
  setStudentId: (id: string) => void;
  /** Materials marked reviewed. Session-only, like the classic UI. */
  reviewed: ReadonlySet<string>;
  toggleReviewed: (materialId: string) => void;
}

export const StudentSessionContext = createContext<StudentSession | null>(null);
