import { Eye } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { AssignmentBrief } from "../../../shared/components/assignment/AssignmentBrief";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { handInSettingsOf } from "../api/handIn";
import { classContent, subjectOf } from "../api/selectors";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

/**
 * "Preview as student" for an assignment (D-058): the title, instructions, and rules exactly as
 * the student's page words them (`AssignmentBrief`). Reached from the assignment builder, which
 * saves first; nothing here is saved or handed in.
 */
export default function AssignmentPreviewPage() {
  const { classId = "", assignmentId = "" } = useParams();
  const navigate = useNavigate();
  const { store, rooms } = useInstructorWorkspace();
  const room = rooms.find((item) => item.id === classId);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  const activity = classContent(store, room.id).activities.find((item) => item.id === assignmentId);
  if (!activity) return <Navigate to={instructorPaths.classPage(room.id, "Classwork")} replace />;
  const subject = subjectOf(store, room);

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
        <AssignmentBrief instructions={activity.instructions ?? ""} settings={handInSettingsOf(activity)} />
        <p className="m-0 max-w-prose text-body text-muted">Below this, each student has a “Your work” card to write, add files, and turn in.</p>
      </article>
    </>
  );
}
