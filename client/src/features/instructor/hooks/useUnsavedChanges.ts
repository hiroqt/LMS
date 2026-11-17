import { useContext, useEffect, useId } from "react";
import { NavigationGuardContext } from "../navigationGuard";

/**
 * While `dirty`, the browser asks before the tab reloads or closes, and the workspace asks
 * before navigating away. Nothing is written to browser storage: drafts live only in the tab.
 */
export function useUnsavedChanges(dirty: boolean) {
  const guard = useContext(NavigationGuardContext);
  const owner = useId();

  useEffect(() => {
    guard?.setDirty(owner, dirty);
    return () => guard?.setDirty(owner, false);
  }, [guard, owner, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a return value to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
