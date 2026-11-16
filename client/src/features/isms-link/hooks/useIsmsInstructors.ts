import { useQuery } from "@tanstack/react-query";
import { fetchInstructors, ismsKeys, ismsQueryOptions } from "../api/isms";

export function useIsmsInstructors() {
  return useQuery({ queryKey: ismsKeys.instructors(), queryFn: ({ signal }) => fetchInstructors(signal), ...ismsQueryOptions });
}
