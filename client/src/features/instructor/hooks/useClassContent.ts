import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { contentKey, fetchContent, isServerClass, withServerContent } from "../api/content";
import type { Classroom, RoleStore, User } from "../api/types";

export function useClassContent(store: RoleStore, room: Classroom | undefined, instructor: User) {
  const client = useQueryClient();
  const enabled = isServerClass(room);
  const query = useQuery({
    queryKey: [...contentKey, room?.id, instructor.id],
    queryFn: ({ signal }) => fetchContent(room!.id, instructor.id, signal),
    enabled, retry: false, networkMode: "always",
  });
  useEffect(() => {
    const refresh = () => void client.invalidateQueries({ queryKey: contentKey });
    window.addEventListener("tmcc-lms-content", refresh);
    return () => window.removeEventListener("tmcc-lms-content", refresh);
  }, [client]);
  return { ...query, enabled, store: enabled && room && query.data ? withServerContent(store, room.id, query.data) : store };
}
