import { BookOpen, CalendarDays, House, ListChecks } from "lucide-react";
import { useState } from "react";
import { RebuildNotice } from "../../app/migration/RebuildNotice";
import { ProfileMenu } from "../../shared/components/ProfileMenu";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { PageHeader } from "../../shared/layout/PageHeader";

export interface RoleAppProps {
  onNavigateRole: (role: string) => void;
  onUseClassic: () => void;
}

// Same destination names as the classic Student UI, so people keep their habits.
const nav: NavItem[] = [
  { id: "today", label: "Today", icon: <House /> },
  { id: "tasks", label: "Tasks", icon: <ListChecks /> },
  { id: "classes", label: "Classes", icon: <BookOpen /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays /> },
];

const pages = {
  today: { eyebrow: "Your learning space", title: "Today" },
  tasks: { eyebrow: "Your work", title: "Tasks" },
  classes: { eyebrow: "Enrolled this term", title: "My classes" },
  calendar: { eyebrow: "Academic schedule", title: "Academic calendar" },
} as const;

type PageId = keyof typeof pages;

/** Root of the rebuilt Student UI (Phase 2 replaces each RebuildNotice). */
export default function StudentApp({ onNavigateRole, onUseClassic }: RoleAppProps) {
  const [page, setPage] = useState<PageId>("today");
  const current = pages[page];
  return (
    <AppShell
      roleLabel="Student"
      nav={nav}
      activeId={page}
      onNavigate={(id) => setPage(id as PageId)}
      mobileNav="bottom"
      pageKey={page}
      topbarActions={
        <ProfileMenu name="Alex Rivera" subtitle="BS Information Technology · Student" currentRole="student" onSwitchRole={onNavigateRole} onUseClassic={onUseClassic} />
      }
    >
      <PageHeader eyebrow={current.eyebrow} title={current.title} />
      <RebuildNotice screen={current.title} onUseClassic={onUseClassic} />
    </AppShell>
  );
}
