import { createContext } from "react";

export interface InstructorSession {
  /** The instructor being viewed: a demo identity, not a sign-in (D-032). */
  instructorId: string;
  setInstructorId: (id: string) => void;
}

export const InstructorSessionContext = createContext<InstructorSession | null>(null);
