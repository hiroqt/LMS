import { useCallback } from "react";
import type { AdminData, AuditInput, UpdateAdminData } from "../data/types";
import { useLmsData } from "../data/useLmsData.js";

/** The demo administrator every Admin change is attributed to in the audit log. */
export const ADMIN_ACTOR = { actorId: "admin-1", actorName: "Taylor Morgan", actorRole: "admin" } as const;

/**
 * Browser-local Admin data (`tmcc-lms-roles-v1`). Every change is saved at once
 * and, when `audit` is given, appends a metadata-only audit event.
 */
export function useAdminData(): [AdminData, UpdateAdminData] {
  const [data, write] = useLmsData() as [AdminData, (change: (current: AdminData) => AdminData, audit?: AuditInput & typeof ADMIN_ACTOR) => void];
  const update = useCallback<UpdateAdminData>((change, audit) => write(change, audit && { ...ADMIN_ACTOR, ...audit }), [write]);
  return [data, update];
}
