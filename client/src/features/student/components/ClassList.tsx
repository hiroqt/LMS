import { ClassTable } from "../../../shared/components/ClassTable";
import type { ClassView } from "../../../shared/hooks/useClassView";
import { cn } from "../../../shared/lib/cn";
import { courseCode } from "../api/catalog";
import type { Course } from "../api/types";
import { ClassCard } from "./ClassCard";

/** The student's classes as cards or as a table (the reader's choice, see ViewToggle). */
export function ClassList({ courses, view, onOpen, gridClassName }: { courses: Course[]; view: ClassView; onOpen: (course: Course) => void; gridClassName: string }) {
  if (view === "table") {
    return (
      <ClassTable
        caption="My classes"
        columns={["Code", "Section", "Instructor", "Room", "Next class"]}
        rows={courses.map((course) => ({
          id: course.id,
          name: course.name,
          cells: [courseCode(course), course.section, course.teacher, course.room, course.next],
          onOpen: () => onOpen(course),
        }))}
      />
    );
  }
  return (
    <ul className={cn("m-0 grid list-none p-0", gridClassName)}>
      {courses.map((course, index) => (
        <li key={course.id}><ClassCard course={course} index={index} onOpen={() => onOpen(course)} /></li>
      ))}
    </ul>
  );
}
