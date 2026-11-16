import { activeInstructors, classroomsOf, currentTermName, reviewQueue } from "../api/selectors";
import { useRoleStore } from "../api/store";
import type { User } from "../api/types";
import { useInstructorSession } from "./useInstructorSession";

const FALLBACK: User = { id: "", firstName: "Demo", lastName: "Instructor", role: "instructor", status: "active" };

/** Store, the viewed instructor, their classrooms, and their review queue. */
export function useInstructorWorkspace() {
  const store = useRoleStore();
  const { instructorId } = useInstructorSession();
  const instructors = activeInstructors(store);
  const instructor = instructors.find((item) => item.id === instructorId) ?? instructors[0] ?? FALLBACK;
  const rooms = classroomsOf(store, instructor.id);
  const queue = reviewQueue(store, rooms);
  const term = rooms.find((room) => room.term)?.term ?? currentTermName(store);
  return { store, instructors, instructor, rooms, queue, term };
}
