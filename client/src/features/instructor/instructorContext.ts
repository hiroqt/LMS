import { createContext } from "react";

export interface InstructorSession {
  /** The demo instructor being viewed (not persisted, like the classic UI). */
  instructorId: string;
  setInstructorId: (id: string) => void;
  openCreateClass: () => void;
}

export const InstructorSessionContext = createContext<InstructorSession | null>(null);
