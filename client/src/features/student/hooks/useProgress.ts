import { useSyncExternalStore } from "react";
import { getProgress, subscribeProgress } from "../api/progressStore";
import type { StudentProgress } from "../api/types";

/** Saved answers and completions, updated live as the student works. */
export function useProgress(): StudentProgress {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress);
}
