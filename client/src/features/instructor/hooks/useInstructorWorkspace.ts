import { activeInstructors, classroomsOf, currentTermName, reviewQueue, STUDENT_PROGRESS_KEY, type StudentProgressSnapshot } from "../api/selectors";
import { useRoleStore } from "../api/store";
import type { User } from "../api/types";
import { useInstructorSession } from "./useInstructorSession";

const FALLBACK: User = { id: "", firstName: "Demo", lastName: "Instructor", role: "instructor", status: "active" };

/** The demo student's progress, read fresh: exam submissions are queued from it (classic rule). */
function readStudentProgress(): StudentProgressSnapshot {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_PROGRESS_KEY) || "{}") as StudentProgressSnapshot;
  } catch {
    return {};
  }
}

/** Store, the viewed instructor, their classrooms, and their review queue. */
export function useInstructorWorkspace() {
  const store = useRoleStore();
  const { instructorId } = useInstructorSession();
  const instructors = activeInstructors(store);
  const instructor = instructors.find((item) => item.id === instructorId) ?? instructors[0] ?? FALLBACK;
  const rooms = classroomsOf(store, instructor.id);
  const queue = reviewQueue(store, rooms, readStudentProgress());
  return { store, instructors, instructor, rooms, queue, term: currentTermName(store) };
}
