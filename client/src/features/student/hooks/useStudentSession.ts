import { useContext } from "react";
import { StudentSessionContext, type StudentSession } from "../studentContext";

export function useStudentSession(): StudentSession {
  const session = useContext(StudentSessionContext);
  if (!session) throw new Error("useStudentSession must be used inside StudentApp");
  return session;
}
