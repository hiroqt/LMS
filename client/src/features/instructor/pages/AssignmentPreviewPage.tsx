import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { describeApiError, isApiError, shouldRetryApiRead } from "../../../shared/api/http";
import { fetchCourseworkRubric, rubricKeys, type Rubric } from "../../../shared/api/rubrics";
import { AssignmentBrief, type BriefRubric } from "../../../shared/components/assignment/AssignmentBrief";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { handInSettingsOf } from "../api/handIn";
import { classContent, subjectOf } from "../api/selectors";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

/**
 * "Preview as student" for an assignment (D-058): the title, instructions, rules, and rubric
 * exactly as the student's page shows them (`AssignmentBrief`). Reached from the assignment builder, which
 * saves first; nothing here is saved or handed in.
 */
export default function AssignmentPreviewPage() {
  const { classId = "", assignmentId = "" } = useParams();
  const navigate = useNavigate();
  const { store, rooms } = useInstructorWorkspace();
  const { instructorId } = useInstructorSession();
  const room = rooms.find((item) => item.id === classId);
  const activity = room ? classContent(store, room.id).activities.find((item) => item.id === assignmentId) : undefined;
  // What the work is graded on, as students see it (contract §12); a 404 means it has none any more.
  const rubric = useQuery<Rubric | null>({
    queryKey: rubricKeys.ofCoursework(instructorId, classId, assignmentId),
    queryFn: async ({ signal }) => {
      try {
        return await fetchCourseworkRubric({ id: instructorId, role: "instructor" }, classId, assignmentId, signal);
      } catch (failure) {
        if (isApiError(failure) && failure.status === 404) return null;
        throw failure;
      }
    },
    retry: shouldRetryApiRead,
    networkMode: "always",
    enabled: Boolean(instructorId && activity?.rubricId),
  });
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  if (!activity) return <Navigate to={instructorPaths.classPage(room.id, "Classwork")} replace />;
  const subject = subjectOf(store, room);
  const briefRubric: BriefRubric | undefined = !activity.rubricId ? undefined
    : rubric.data ? { rubric: rubric.data }
    : rubric.isError ? { error: describeApiError(rubric.error).title, onRetry: () => void rubric.refetch() }
    : rubric.data === null ? undefined
    : { loading: true };

  return (
    <>
      <BackLink label="Back to the assignment" onBack={() => navigate(instructorPaths.assignmentEdit(room.id, activity.id))} />
      <PageHeader title="Preview as student" description={`${activity.title} · ${subject?.title ?? "Class"} · ${room.section}`} />
      <p role="note" className="m-0 flex items-start gap-2 rounded-card border border-line bg-canvas p-3 text-body text-ink">
        <Eye aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        <span>This is what students read on the assignment’s page{activity.draft ? " once you publish it" : ""}. Nothing here is saved or handed in.</span>
      </p>
      <article className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="m-0 font-sans text-section font-semibold text-ink">{activity.title}</h2>
          {activity.description && <p className="m-0 max-w-prose text-body-lg text-muted">{activity.description}</p>}
          <p className="m-0 text-body text-muted">{activity.maxScore} points</p>
        </header>
        <AssignmentBrief instructions={activity.instructions ?? ""} settings={handInSettingsOf(activity)} rubric={briefRubric} />
        <p className="m-0 max-w-prose text-body text-muted">Below this, each student has a “Your work” card to write, add files, and turn in.</p>
      </article>
    </>
  );
}
