import { createContext } from "react";

/**
 * Unsaved-changes guard for in-app navigation. The router is a plain BrowserRouter
 * (no data router, so no useBlocker): the shell and the editors navigate through
 * `navigate` here, which asks "Leave without saving?" while a page has said it is
 * dirty. Reloading or closing the tab is covered by `beforeunload`.
 */
export interface NavigationGuard {
  /** A page (owner) says whether it has unsaved changes. */
  setDirty: (owner: string, dirty: boolean) => void;
  /** Navigates, or first asks when a page has unsaved changes. A function runs instead of a path. */
  navigate: (to: string | (() => void)) => void;
}

export const NavigationGuardContext = createContext<NavigationGuard | null>(null);
