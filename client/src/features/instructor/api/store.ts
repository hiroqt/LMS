import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { loadLmsData, persistLmsData } from "../../../roles/shared/lmsData.js";
import { appendAuditEvent } from "../../../roles/shared/systemAdministrationData.js";
import type { AuditEvent, RoleStore } from "./types";

export const roleStoreKey = ["instructor", "role-store"] as const;

const read = () => loadLmsData() as RoleStore;

/**
 * The shared role store through the app QueryClient (D-008). Reads are
 * synchronous from browser storage, so `initialData` renders at once; the
 * .NET API will replace `queryFn` without screen changes.
 */
export function useRoleStore(): RoleStore {
  const { data } = useQuery({ queryKey: roleStoreKey, queryFn: read, initialData: read });
  return data;
}

/** Refreshes when the Student UI, Admin, or another tab changes the store. */
export function useRoleStoreSync(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["instructor"] });
    window.addEventListener("tmcc-lms-data", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tmcc-lms-data", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [queryClient]);
}

/**
 * Applies a change to the latest stored data, appends its metadata-only audit
 * event, and saves. Same path as the classic useLmsData().update. Returns
 * false when storage refused the write, so callers never report a failed
 * save as done (L-024).
 */
export function commit(change: (current: RoleStore) => RoleStore, audit: AuditEvent): boolean {
  const updated = appendAuditEvent(change(read()), audit) as RoleStore;
  return persistLmsData(updated) as boolean;
}
