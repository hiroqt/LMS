import { completedIds } from "../api/selectors";
import { useNow } from "./useNow";
import { useProgress } from "./useProgress";
import { useStudentCatalog } from "./useStudentCatalog";

/** Everything most Student screens need: data, saved progress, completions, and the time. */
export function useWorkspace() {
  const catalog = useStudentCatalog();
  const progress = useProgress();
  const now = useNow();
  return { catalog, progress, completed: completedIds(progress, catalog), now };
}
