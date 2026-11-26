import { CardRow, CardRowItem } from "../../../shared/components/CardRow";
import type { Course } from "../api/types";
import { ClassCard } from "./ClassCard";

/** The student's classes as cards: a wrapping grid on My classes, one scrolling row of tiles on the dashboard. */
export function ClassList({ courses, onOpen, fill = false }: { courses: Course[]; onOpen: (course: Course) => void; /** Dashboard: flat tinted tiles in one row that scrolls sideways (D-067). */ fill?: boolean }) {
  if (fill) {
    return (
      <CardRow className="flex-1">
        {courses.map((course, index) => (
          <CardRowItem key={course.id}><ClassCard tile course={course} index={index} onOpen={() => onOpen(course)} /></CardRowItem>
        ))}
      </CardRow>
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
