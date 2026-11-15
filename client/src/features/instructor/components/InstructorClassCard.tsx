import { ChevronRight, ClipboardList, UsersRound } from "lucide-react";
import { SubjectIcon } from "../../../shared/components/SubjectIcon";
import { cn } from "../../../shared/lib/cn";
import { borderFor, toneFor } from "../../../shared/lib/tones";

export interface InstructorClassCardProps {
  title: string;
  section: string;
  /** Course code, e.g. "IT101". */
  mark: string;
  term?: string;
  index: number;
  students: number;
  coursework: number;
  onOpen: () => void;
}

/** A class the instructor teaches: subject icon, title, code and section, enrollment and coursework. */
export function InstructorClassCard({ title, section, mark, term, index, students, coursework, onOpen }: InstructorClassCardProps) {
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
        <SubjectIcon subject={title} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-card-title font-semibold leading-snug">{title}</strong>
        <span className="text-body text-muted">{mark} · {section}{term ? ` · ${term}` : ""}</span>
        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-body text-muted">
          <span className="inline-flex items-center gap-1.5"><UsersRound aria-hidden className="size-4" />{students} students</span>
          <span className="inline-flex items-center gap-1.5"><ClipboardList aria-hidden className="size-4" />{coursework} coursework items</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted group-hover:text-ink" />
    </button>
  );
}
