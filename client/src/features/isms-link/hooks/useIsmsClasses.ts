import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchClasses, ismsKeys, ismsQueryOptions } from "../api/isms";
import type { ClassFilters } from "../api/types";

/** Class schedules from ISMS. Keeps the previous list visible while a new filter loads. */
export function useIsmsClasses(filters: ClassFilters) {
  return useQuery({
    queryKey: ismsKeys.classes(filters),
    queryFn: ({ signal }) => fetchClasses(filters, signal),
    ...ismsQueryOptions,
    placeholderData: keepPreviousData,
  });
}
