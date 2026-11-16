import { ClassTable } from "../../../shared/components/ClassTable";
import type { ClassView } from "../../../shared/hooks/useClassView";
import { classContent, classMark, enrolledCount, subjectOf } from "../api/selectors";
import type { RoleStore } from "../api/types";
import { InstructorClassCard } from "./InstructorClassCard";

type Room = RoleStore["classrooms"][number];

/** The instructor's classes as cards or as a table (the reader's choice, see ViewToggle). */
export function InstructorClassList({ store, rooms, view, onOpen }: { store: RoleStore; rooms: Room[]; view: ClassView; onOpen: (room: Room) => void }) {
  const rows = rooms.map((room) => {
    const subject = subjectOf(store, room);
    const content = classContent(store, room.id);
    return { room, title: subject?.title ?? "Classroom", mark: classMark(subject), students: enrolledCount(store, room.id), coursework: content.exams.length + content.activities.length };
  });
  if (view === "table") {
    return (
      <ClassTable
        caption="My classes"
        columns={["Code", "Section", "Term", "Students", "Coursework"]}
        rows={rows.map(({ room, title, mark, students, coursework }) => ({
          id: room.id,
          name: title,
          cells: [mark, room.section, room.term ?? "—", students, coursework],
          onOpen: () => onOpen(room),
        }))}
      />
    );
  }
  return (
    // As many columns as fit; cards share the row evenly, so no cell is left empty beside them.
    <ul className="m-0 grid flex-1 list-none auto-rows-fr grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-3 p-0">
      {rows.map(({ room, title, mark, students, coursework }, index) => (
        <li key={room.id}>
          <InstructorClassCard title={title} section={room.section} mark={mark} term={room.term} index={index} students={students} coursework={coursework} onOpen={() => onOpen(room)} />
        </li>
      ))}
    </ul>
  );
}
