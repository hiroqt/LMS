import { BookOpen, ClipboardCheck, FileText, GraduationCap, Megaphone, School, UserPlus, UsersRound } from "lucide-react";

export interface DashboardEvent {
  type: string;
  title: string;
  detail: string;
  date: string;
}

/** Each record type has an icon and the title says what happened, so nothing relies on color (C-019). */
const icons: Record<string, typeof BookOpen> = {
  user: UserPlus,
  classroom: School,
  subject: BookOpen,
  enrollment: UsersRound,
  material: FileText,
  coursework: ClipboardCheck,
  announcement: Megaphone,
  submission: ClipboardCheck,
  grade: GraduationCap,
};

export function EventList({ label, events }: { label: string; events: DashboardEvent[] }) {
  if (!events.length) return null;
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-1 p-0">
      {events.map((event, index) => {
        const Icon = icons[event.type] ?? FileText;
        return (
          <li key={`${event.type}-${event.date}-${index}`} className="flex items-start gap-3 py-1.5 font-sans text-body">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-control bg-canvas text-primary-700"><Icon className="size-4" /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-ink">{event.title}</span>
              <span className="truncate text-muted">{event.detail}</span>
            </span>
            <time dateTime={event.date} className="shrink-0 text-muted">{new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
          </li>
        );
      })}
    </ul>
  );
}
