import { ArrowUpRight, CalendarDays, ChevronRight } from "lucide-react";
import { SubjectIcon } from "../../../shared/components/SubjectIcon";
import { cn } from "../../../shared/lib/cn";
import { toneFor } from "../../../shared/lib/tones";
import { courseCode } from "../api/catalog";
import type { Course } from "../api/types";

/** A course: subject icon, title, code and section, and when it next meets. */
export function ClassCard({ course, index, onOpen, tile = false }: { course: Course; index: number; onOpen: () => void; /** A flat tinted tile for dashboard mosaics. */ tile?: boolean }) {
  if (tile) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn("group flex h-full w-full flex-col justify-between gap-4 rounded-card border-0 p-4 text-left font-sans transition hover:brightness-95 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none", toneFor(index))}
      >
        <span aria-hidden className="flex w-full items-start justify-between">
          <span className="grid size-11 place-items-center rounded-control bg-surface"><SubjectIcon subject={`${course.name} ${course.subject}`} className="size-6" /></span>
          <ArrowUpRight className="size-5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <strong className="text-card-title leading-snug font-semibold text-ink">{course.name}</strong>
          <span className="text-body">{course.section}</span>
          <span className="text-body">{courseCode(course)} · Next class {course.next}</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full items-center gap-4 rounded-card border border-line bg-surface p-4 text-left font-sans text-ink shadow-card transition hover:border-primary-300 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none"
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
