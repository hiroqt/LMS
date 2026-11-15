import { UsersRound } from "lucide-react";
import type { Course } from "../api/types";
import { toneFor } from "./tones";

/** A class tile. The accessible name starts with the subject, then the class name. */
export function ClassCard({ course, index, onOpen }: { course: Course; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface text-left font-sans text-ink shadow-card transition hover:-translate-y-0.5 hover:border-primary-300 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className={`flex items-center justify-between px-5 py-4 ${toneFor(index)}`}>
        <span className="text-body font-semibold">{course.subject}</span>
        <span aria-hidden className="text-section font-bold">{course.symbol}</span>
      </span>
      <span className="flex flex-1 flex-col gap-1 px-5 py-4">
        <strong className="text-card-title font-semibold">{course.name}</strong>
        <span className="text-body text-muted">{course.section}</span>
        <span className="mt-2 text-body">{course.teacher}</span>
      </span>
      <span className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 text-body text-muted">
        <span className="inline-flex items-center gap-1.5"><UsersRound aria-hidden className="size-4" />{course.count} students</span>
        <span>Next class · {course.next}</span>
      </span>
    </button>
  );
}
