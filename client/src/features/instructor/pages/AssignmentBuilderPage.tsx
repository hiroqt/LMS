import { Navigate, useNavigate, useParams } from "react-router";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

/** Placeholder until this page is built (Assignments Phase 2, PR 2B; docs/ASSIGNMENTS_PLAN.md). */
export default function AssignmentBuilderPage() {
  const { classId = "" } = useParams();
  const navigate = useNavigate();
  const { rooms } = useInstructorWorkspace();
  const room = rooms.find((item) => item.id === classId);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  return (
    <>
      <BackLink label="Back to classwork" onBack={() => navigate(instructorPaths.classPage(room.id, "Classwork"))} />
      <PageHeader title="Assignment builder" />
      <EmptyState title="This page is being built" description="It arrives with Assignments Phase 2." />
    </>
  );
}
