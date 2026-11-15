import { BookOpen, GraduationCap, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { RebuildNotice } from "../../app/migration/RebuildNotice";
import { ProfileMenu } from "../../shared/components/ProfileMenu";
import { AppShell, type NavItem } from "../../shared/layout/AppShell";
import { PageHeader } from "../../shared/layout/PageHeader";
import type { RoleAppProps } from "../student/StudentApp";

// Same destination names as the classic Instructor UI.
const nav: NavItem[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
  { id: "classes", label: "My classes", icon: <BookOpen /> },
  { id: "gradebook", label: "Gradebook", icon: <GraduationCap /> },
];

const pages = {
  overview: { eyebrow: "Instructor workspace", title: "Your teaching day" },
  classes: { eyebrow: "Your course rooms", title: "My classes" },
  gradebook: { eyebrow: "Grades and weights", title: "Gradebook" },
} as const;

type PageId = keyof typeof pages;

/** Root of the rebuilt Instructor UI (Phase 3 replaces each RebuildNotice). */
export default function InstructorApp({ onNavigateRole, onUseClassic }: RoleAppProps) {
  const [page, setPage] = useState<PageId>("overview");
  const current = pages[page];
  return (
    <AppShell
      roleLabel="Instructor"
      nav={nav}
      activeId={page}
      onNavigate={(id) => setPage(id as PageId)}
      mobileNav="drawer"
      pageKey={page}
      topbarActions={
        <ProfileMenu name="Angela Reyes" subtitle="Faculty · Instructor" currentRole="instructor" onSwitchRole={onNavigateRole} onUseClassic={onUseClassic} />
      }
    >
      <PageHeader eyebrow={current.eyebrow} title={current.title} />
      <RebuildNotice screen={current.title} onUseClassic={onUseClassic} />
    </AppShell>
  );
}
