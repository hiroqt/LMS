import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { fetchMeetings, meetingKeys } from "../api/meetings";

/** How often an open class page checks for a meeting that started or ended (D-070: no WebSocket). */
export const MEETINGS_REFRESH_MS = 20_000;

/** A class's meetings, refreshed every 20 seconds while the page is open and visible. */
export function useClassMeetings(viewer: Viewer, classId: string) {
  return useQuery({
    queryKey: meetingKeys.list(viewer.id, classId),
    queryFn: ({ signal }) => fetchMeetings(viewer, classId, signal),
    retry: shouldRetryApiRead,
    networkMode: "always",
    refetchInterval: MEETINGS_REFRESH_MS,
    enabled: Boolean(viewer.id && classId),
  });
}

/** Re-reads a class's meetings after a change. */
export function useRefreshMeetings(viewer: Viewer, classId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: meetingKeys.list(viewer.id, classId) }), [queryClient, viewer.id, classId]);
}
