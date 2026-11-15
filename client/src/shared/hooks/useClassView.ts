import { usePersistentState } from "./usePersistentState";

export type ClassView = "cards" | "table";

/** The class list layout, remembered on this device and shared by the dashboard and My classes. */
export function useClassView() {
  return usePersistentState<ClassView>("tmcc-classes-view", "cards");
}
