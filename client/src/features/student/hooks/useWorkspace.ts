import { useNow } from "./useNow";
import { useStudentCatalog } from "./useStudentCatalog";

/** Everything most Student screens need: data, handed-in work, and the time. */
export function useWorkspace() {
  const catalog = useStudentCatalog();
  const now = useNow();
  return { catalog, completed: catalog.completed, now };
}
