import type { Classroom, RoleStore } from "../api/types";
import { subjectOf } from "../api/selectors";

/** ISMS subject id → "IT101 · Introduction to Programming", for the subjects the instructor teaches. */
export function subjectLabels(store: RoleStore, rooms: Classroom[]): Map<number, string> {
  const labels = new Map<number, string>();
  for (const room of rooms) {
    const subject = subjectOf(store, room);
    if (room.ismsSubjectId === undefined || !subject) continue;
    labels.set(room.ismsSubjectId, subject.code ? `${subject.code} · ${subject.title}` : subject.title);
  }
  return labels;
}

export function subjectLabel(labels: Map<number, string>, subjectId: number | null): string {
  return subjectId === null ? "No subject" : labels.get(subjectId) ?? "A subject you no longer teach";
}
