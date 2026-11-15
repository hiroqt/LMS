import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { buildStudentCatalog } from "../api/catalog";
import type { StudentCatalog } from "../api/types";

export const studentCatalogKey = ["student", "catalog"] as const;

/**
 * The Student workspace data, through the app QueryClient (D-008). Today the
 * source is browser storage, read synchronously, so `initialData` renders at
 * once with no loading state. Switching to the .NET API replaces the queryFn
 * and drops `initialData`; screens do not change.
 */
export function useStudentCatalog(): StudentCatalog {
  const { data } = useQuery({ queryKey: studentCatalogKey, queryFn: buildStudentCatalog, initialData: buildStudentCatalog });
  return data;
}

/** Refreshes Student data when instructors or other tabs change the shared store. */
export function useSharedDataSync(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["student"] });
    window.addEventListener("tmcc-lms-data", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tmcc-lms-data", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [queryClient]);
}
