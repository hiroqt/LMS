import { ClassTable } from "../../../shared/components/ClassTable";
import { cn } from "../../../shared/lib/cn";
import type { ClassView } from "../../../shared/hooks/useClassView";
import { courseCode } from "../api/catalog";
import type { Course } from "../api/types";
import { ClassCard } from "./ClassCard";

/** The student's classes as cards or as a table (the reader's choice, see ViewToggle). */
export function ClassList({ courses, view, onOpen, fill = false }: { courses: Course[]; view: ClassView; onOpen: (course: Course) => void; /** Dashboard mosaic: flat tinted tiles that take the height of the panel. */ fill?: boolean }) {
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
    // As many columns as fit; cards share the row evenly, so no cell is left empty beside them.
    <ul className={cn("m-0 grid list-none gap-3 p-0", fill ? "flex-1 auto-rows-fr grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))]" : "grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))]")}>
      {courses.map((course, index) => (
        <li key={course.id}><ClassCard tile={fill} course={course} index={index} onOpen={() => onOpen(course)} /></li>
      ))}
    </ul>
  );
}
