import { createContext } from "react";
import type { IsmsClassSync } from "./hooks/useIsmsClassSync";

export interface InstructorSession {
  /** The demo instructor being viewed (not persisted, like the classic UI). */
  instructorId: string;
  setInstructorId: (id: string) => void;
  /** Where the class list comes from right now (D-031). */
  isms: IsmsClassSync;
}

export const InstructorSessionContext = createContext<InstructorSession | null>(null);
