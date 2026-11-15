import { BookOpen, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { classContent, classMark, enrolledCount, subjectOf, yearLevels, yearOf } from "../api/selectors";
import { InstructorClassCard } from "../components/InstructorClassCard";
import { YearFilter } from "../components/YearFilter";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

export default function ClassesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { store, rooms } = useInstructorWorkspace();
  const { openCreateClass } = useInstructorSession();
  const levels = yearLevels(rooms);
  const requested = Number(params.get("year"));
  const year = levels.includes(requested) ? requested : "all";
  const shown = year === "all" ? rooms : rooms.filter((room) => yearOf(room) === year);

  return (
    <>
      <PageHeader
        eyebrow="Your course rooms"
        title="My classes"
        description="Choose a classroom to prepare materials and coursework."
        actions={<Button onClick={openCreateClass} icon={<Plus aria-hidden className="size-4" />}>Create class</Button>}
      />
      <YearFilter levels={levels} selected={year} onSelect={(level) => navigate(instructorPaths.classes(level), { replace: true })} />
      {shown.length ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((room, index) => {
            const subject = subjectOf(store, room);
            const content = classContent(store, room.id);
            return (
              <li key={room.id}>
                <InstructorClassCard title={subject?.title ?? "Classroom"} section={room.section} mark={classMark(subject)} index={index} students={enrolledCount(store, room.id)} coursework={content.exams.length + content.activities.length} onOpen={() => navigate(instructorPaths.classPage(room.id))} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<BookOpen />} title="No classrooms yet" description="Create a class or ask an admin to assign one." />
      )}
    </>
  );
}
