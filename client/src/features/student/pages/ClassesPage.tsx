import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ClassCard } from "../components/ClassCard";
import { useStudentCatalog } from "../hooks/useStudentCatalog";
import { studentPaths } from "../paths";

export default function ClassesPage() {
  const navigate = useNavigate();
  const { courses } = useStudentCatalog();
  return (
    <>
      <PageHeader eyebrow="Enrolled this term" title="My classes" description="Open a class for its stream, classwork, materials, and classmates." />
      {courses.length ? (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course, index) => (
            <li key={course.id}><ClassCard course={course} index={index} onOpen={() => navigate(studentPaths.classPage(course.id))} /></li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<BookOpen />} title="You are not enrolled in any classes yet" description="Classes appear here once your enrollment is active." />
      )}
    </>
  );
}
