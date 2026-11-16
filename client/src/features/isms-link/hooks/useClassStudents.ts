import { useQuery } from "@tanstack/react-query";
import { fetchClassStudents, ismsKeys, ismsQueryOptions } from "../api/isms";

/** A class's enrolled students; fetched only once the roster is opened. */
export function useClassStudents(classId: string, enabled: boolean) {
  return useQuery({
    queryKey: ismsKeys.students(classId),
    queryFn: ({ signal }) => fetchClassStudents(classId, signal),
    ...ismsQueryOptions,
    enabled,
  });
}
