import { useLocation } from "react-router";

/** Router state a module page passes when it opens one of its items (D-077). */
type ModuleOrigin = { fromModule: string };

/** State for `navigate(path, { state })` from a module page: the module's title. */
export const moduleOrigin = (moduleTitle: string): ModuleOrigin => ({ fromModule: moduleTitle });

/** The title of the module page this item was opened from, or undefined when it was opened any other way. */
export function useModuleOrigin(): string | undefined {
  const state = useLocation().state as Partial<ModuleOrigin> | null;
  return typeof state?.fromModule === "string" ? state.fromModule : undefined;
}
