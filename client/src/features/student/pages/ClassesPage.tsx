import { useNavigate } from "react-router";
import { openBook } from "../../../shared/assets/illustrations";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ViewToggle } from "../../../shared/components/ViewToggle";
import { useClassView } from "../../../shared/hooks/useClassView";
import { ClassList } from "../components/ClassList";
import { useStudentCatalog } from "../hooks/useStudentCatalog";
import { studentPaths } from "../paths";

export default function ClassesPage() {
  const navigate = useNavigate();
  const { courses } = useStudentCatalog();
  const [view, setView] = useClassView();
  return (
    <>
      <PageHeader title="My classes" description={`${courses.length} ${courses.length === 1 ? "class" : "classes"} this term`} actions={<ViewToggle view={view} onChange={setView} />} />
      {courses.length ? (
        <ClassList courses={courses} view={view} onOpen={(course) => navigate(studentPaths.classPage(course.id))} />
      ) : (
        <EmptyState illustration={openBook} title="You are not enrolled in any classes yet" description="Classes appear here once your enrollment is active." />
      )}
    </>
  );
}
