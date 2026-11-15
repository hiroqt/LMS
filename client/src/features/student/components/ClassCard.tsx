import { CalendarDays, ChevronRight } from "lucide-react";
import { SubjectIcon } from "../../../shared/components/SubjectIcon";
import { cn } from "../../../shared/lib/cn";
import { borderFor, toneFor } from "../../../shared/lib/tones";
import { courseCode } from "../api/catalog";
import type { Course } from "../api/types";

/** A course: subject icon, title, code and section, and when it next meets. */
export function ClassCard({ course, index, onOpen }: { course: Course; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex h-full w-full items-center gap-4 rounded-card border border-l-4 border-line bg-surface p-4 text-left font-sans text-ink shadow-card transition hover:border-primary-300 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none",
        borderFor(index),
      )}
    >
      <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-control", toneFor(index))}>
        <SubjectIcon subject={`${course.name} ${course.subject}`} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-card-title font-semibold leading-snug">{course.name}</strong>
        <span className="text-body text-muted">{course.section}</span>
        <span className="mt-1 flex items-start gap-1.5 text-body text-muted">
          <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{courseCode(course)} · Next class {course.next}</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted group-hover:text-ink" />
    </button>
  );
}
