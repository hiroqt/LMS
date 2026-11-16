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
    // Columns follow the width of the list itself, wherever it is placed.
    <div className="@container">
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
      {rows.map(({ room, title, mark, students, coursework }, index) => (
        <li key={room.id}>
          <InstructorClassCard title={title} section={room.section} mark={mark} term={room.term} index={index} students={students} coursework={coursework} onOpen={() => onOpen(room)} />
        </li>
      ))}
    </ul>
    </div>
  );
}
