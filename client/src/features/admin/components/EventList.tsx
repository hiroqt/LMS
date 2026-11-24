import { BookOpen, ClipboardCheck, FileText, GraduationCap, Megaphone, School, UserPlus, UsersRound } from "lucide-react";
import { IconTile, ListRow, RowList } from "../../../shared/components/ListRow";

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

/** Dated workspace records as read-only `ListRow`s (D-066). */
export function EventList({ label, events, withYear = false }: { label: string; events: DashboardEvent[]; withYear?: boolean }) {
  if (!events.length) return null;
  return (
    <RowList label={label}>
      {events.map((event, index) => {
        const Icon = icons[event.type] ?? FileText;
        return (
          <ListRow
            key={`${event.type}-${event.date}-${index}`}
            lead={<IconTile><Icon /></IconTile>}
            title={event.title}
            meta={event.detail}
            trail={
              <time dateTime={event.date} className="shrink-0 text-body whitespace-nowrap text-muted">
                {new Date(event.date).toLocaleDateString(undefined, withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" })}
              </time>
            }
          />
        );
      })}
    </RowList>
  );
}
