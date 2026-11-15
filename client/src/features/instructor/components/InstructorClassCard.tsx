import { ClipboardList, UsersRound } from "lucide-react";
import { toneFor } from "../../../shared/lib/tones";

export interface InstructorClassCardProps {
  title: string;
  section: string;
  mark: string;
  index: number;
  students: number;
  coursework: number;
  onOpen: () => void;
}

export function InstructorClassCard({ title, section, mark, index, students, coursework, onOpen }: InstructorClassCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col overflow-hidden rounded-card border border-line bg-surface text-left font-sans text-ink shadow-card transition hover:-translate-y-0.5 hover:border-primary-300 focus-visible:outline-3 focus-visible:outline-focus motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className={`flex items-center justify-between px-5 py-4 ${toneFor(index)}`}>
        <strong className="text-card-title font-semibold">{title}</strong>
        <span aria-hidden className="text-section font-bold">{mark}</span>
      </span>
      <span className="flex flex-1 flex-col gap-1 px-5 py-4">
        <span className="text-body text-muted">{section}</span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-body text-muted">
        <span className="inline-flex items-center gap-1.5"><UsersRound aria-hidden className="size-4" />{students} students</span>
        <span className="inline-flex items-center gap-1.5"><ClipboardList aria-hidden className="size-4" />Coursework · {coursework} items</span>
      </span>
    </button>
  );
}
