import { useQuery } from "@tanstack/react-query";
import { isApiError } from "../../../shared/api/http";
import { fetchCourseworkRubric, rubricKeys, type Rubric } from "../../../shared/api/rubrics";
import { studentQueryOptions } from "../api/student";
import { useStudentViewer } from "./useStudentCatalog";

/**
 * The rubric an assignment is graded with (contract §12), read only when the assignment has one.
 * The server answers 404 when it has none (it was removed after the overview loaded): that is
 * `null`, not an error.
 */
export function useAssignmentRubric(classId: string, assessmentId: string, rubricId: number | undefined) {
  const viewer = useStudentViewer();
  return useQuery<Rubric | null>({
    queryKey: rubricKeys.ofCoursework(viewer.id, classId, assessmentId),
    queryFn: async ({ signal }) => {
      try {
        return await fetchCourseworkRubric(viewer, classId, assessmentId, signal);
      } catch (failure) {
        if (isApiError(failure) && failure.status === 404) return null;
        throw failure;
      }
    },
    ...studentQueryOptions,
    enabled: Boolean(rubricId),
  });
}
