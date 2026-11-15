import { useCallback } from "react";
import { useNavigate } from "react-router";
import { isRole, roleTitle, roleUrl } from "./roles";

/**
 * Navigates to another role workspace. Same contract as the old
 * navigateRole(): ignores unknown roles, pushes a history entry, and
 * updates the document title.
 */
export function useRoleNavigation() {
  const navigate = useNavigate();
  return useCallback(
    (target: string) => {
      if (!isRole(target)) return;
      navigate(roleUrl(target));
      document.title = roleTitle(target);
    },
    [navigate],
  );
}
