import { useQuery } from "@tanstack/react-query";
import { fetchIsmsStatus, ismsKeys, ismsQueryOptions } from "../api/isms";

/** LMS API's view of its ISMS link. Always fresh: a status should not come from cache. */
export function useIsmsStatus() {
  return useQuery({ queryKey: ismsKeys.status(), queryFn: ({ signal }) => fetchIsmsStatus(signal), ...ismsQueryOptions, staleTime: 0 });
}
