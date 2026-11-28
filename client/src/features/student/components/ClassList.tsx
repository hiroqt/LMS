import { CardRow, CardRowItem } from "../../../shared/components/CardRow";
import { ClassTable } from "../../../shared/components/ClassTable";
import type { ClassView } from "../../../shared/hooks/useClassView";
import { courseCode } from "../api/catalog";
import type { Course } from "../api/types";
import { ClassCard } from "./ClassCard";

/**
 * The student's classes. On My classes: cards or a table (the reader's choice, see ViewToggle).
 * On the dashboard (`fill`): flat tinted tiles in one row that scrolls sideways (D-071).
 */
export function ClassList({ courses, view = "cards", onOpen, fill = false }: { courses: Course[]; view?: ClassView; onOpen: (course: Course) => void; /** Dashboard: one row of tiles; `view` is ignored. */ fill?: boolean }) {
  if (fill) {
    return (
      <CardRow className="flex-1">
        {courses.map((course, index) => (
          <CardRowItem key={course.id}><ClassCard tile course={course} index={index} onOpen={() => onOpen(course)} /></CardRowItem>
        ))}
      </CardRow>
    );
  }
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
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-3 p-0">
      {courses.map((course, index) => (
        <li key={course.id}><ClassCard course={course} index={index} onOpen={() => onOpen(course)} /></li>
      ))}
    </ul>
  );
}
