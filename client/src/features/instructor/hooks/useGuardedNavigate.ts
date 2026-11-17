import { useContext } from "react";
import { useNavigate } from "react-router";
import { NavigationGuardContext } from "../navigationGuard";

/** Navigates through the unsaved-changes guard; outside the workspace (tests), navigates directly. */
export function useGuardedNavigate(): (to: string | (() => void)) => void {
  const guard = useContext(NavigationGuardContext);
  const navigate = useNavigate();
  if (guard) return guard.navigate;
  return (to) => (typeof to === "string" ? navigate(to) : to());
}
