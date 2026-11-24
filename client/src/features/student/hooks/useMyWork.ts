import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchMySubmissions } from "../../../shared/api/assignments";
import type { Submission } from "../../../shared/api/overview";
import { studentKeys, studentQueryOptions } from "../api/student";
import { useStudentViewer } from "./useStudentCatalog";

/**
 * The student's rows for one assignment (`my-submissions`): the draft, every version, and any
 * taken back. The overview carries only the latest handed-in work, so the work card reads these.
 * Reading never creates a draft.
 */
export function useMyWork(classId: string, assessmentId: string) {
  const viewer = useStudentViewer();
  const queryClient = useQueryClient();
  const queryKey = studentKeys.work(viewer.id, assessmentId);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchMySubmissions(viewer, classId, assessmentId, signal),
    ...studentQueryOptions,
  });
  /** Puts a write's answer into the list at once, so the card never waits for a reload. */
  const setRows = useCallback(
    (change: (rows: Submission[] | undefined) => Submission[]) => queryClient.setQueryData<Submission[]>(studentKeys.work(viewer.id, assessmentId), change),
    [queryClient, viewer.id, assessmentId],
  );
  return { ...query, setRows };
}
