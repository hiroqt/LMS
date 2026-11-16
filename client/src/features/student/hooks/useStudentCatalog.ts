import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchOverview, fetchPeople } from "../../../shared/api/overview";
import type { Viewer } from "../../../shared/api/viewer";
import { toStudentCatalog } from "../api/catalog";
import { studentKeys, studentQueryOptions } from "../api/student";
import type { StudentCatalog } from "../api/types";
import { useStudentSession } from "./useStudentSession";

export function useStudentPeople() {
  return useQuery({ queryKey: ["student", "people"], queryFn: ({ signal }) => fetchPeople(signal), ...studentQueryOptions, staleTime: 5 * 60_000 });
}

export function useStudentOverview(studentId: string) {
  const viewer: Viewer = { id: studentId, role: "student" };
  return useQuery({
    queryKey: studentKeys.overview(studentId),
    queryFn: ({ signal }) => fetchOverview(viewer, signal),
    select: toStudentCatalog,
    ...studentQueryOptions,
    enabled: Boolean(studentId),
  });
}

/** The Student workspace data. StudentApp renders the workspace only once it has loaded. */
export function useStudentCatalog(): StudentCatalog {
  const { studentId } = useStudentSession();
  const { data } = useStudentOverview(studentId);
  if (!data) throw new Error("useStudentCatalog() used before the student overview loaded");
  return data;
}

/** The viewer to send with Student calls. */
export function useStudentViewer(): Viewer {
  const { studentId } = useStudentSession();
  return { id: studentId, role: "student" };
}

/** Refreshes the student's data after handing in work. */
export function useRefreshStudent(): () => Promise<void> {
  const queryClient = useQueryClient();
  const { studentId } = useStudentSession();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: studentKeys.overview(studentId) }), [queryClient, studentId]);
}
