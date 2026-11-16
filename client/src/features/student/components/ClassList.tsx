import { ClassTable } from "../../../shared/components/ClassTable";
import type { ClassView } from "../../../shared/hooks/useClassView";
import { courseCode } from "../api/catalog";
import type { Course } from "../api/types";
import { ClassCard } from "./ClassCard";

/** The student's classes as cards or as a table (the reader's choice, see ViewToggle). */
export function ClassList({ courses, view, onOpen }: { courses: Course[]; view: ClassView; onOpen: (course: Course) => void }) {
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
    // Columns follow the width of the list itself, wherever it is placed.
    <div className="@container">
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
      {courses.map((course, index) => (
        <li key={course.id}><ClassCard course={course} index={index} onOpen={() => onOpen(course)} /></li>
      ))}
    </ul>
    </div>
  );
}
