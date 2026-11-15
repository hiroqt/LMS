import { useContext } from "react";
import { InstructorSessionContext, type InstructorSession } from "../instructorContext";

export function useInstructorSession(): InstructorSession {
  const session = useContext(InstructorSessionContext);
  if (!session) throw new Error("useInstructorSession must be used inside InstructorApp");
  return session;
}
