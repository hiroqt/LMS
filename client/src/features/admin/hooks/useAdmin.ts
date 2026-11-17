import { useContext } from "react";
import { AdminContext, type AdminSession } from "../adminContext";

/** The Admin data and its update function, provided once by AdminApp. */
export function useAdmin(): AdminSession {
  const session = useContext(AdminContext);
  if (!session) throw new Error("useAdmin must be used inside AdminApp");
  return session;
}
