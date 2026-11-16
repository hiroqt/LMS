import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ismsKeys } from "../api/isms";

/** Refetches every ISMS query on the page; `refreshing` is true while any of them is in flight. */
export function useRefreshIsms() {
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: ismsKeys.all }) > 0;
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ismsKeys.all }), [queryClient]);
  return { refresh, refreshing };
}
