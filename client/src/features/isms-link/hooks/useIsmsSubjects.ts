import { useQuery } from "@tanstack/react-query";
import { fetchSubjects, ismsKeys, ismsQueryOptions } from "../api/isms";

export function useIsmsSubjects() {
  return useQuery({ queryKey: ismsKeys.subjects(), queryFn: ({ signal }) => fetchSubjects(signal), ...ismsQueryOptions });
}
