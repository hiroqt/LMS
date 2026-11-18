import { ChevronRight, GraduationCap, LayoutDashboard, ShieldCheck, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent } from "../../../shared/ui/Dialog";
import type { WorkspaceRole } from "../types";

// Same names and icons as the workspace switch in the profile menu.
const WORKSPACES: { role: WorkspaceRole; label: string; detail: string; icon: LucideIcon }[] = [
  { role: "student", label: "Student workspace", detail: "Classes, tasks, calendar, and news", icon: LayoutDashboard },
  { role: "instructor", label: "Instructor workspace", detail: "Classes, assessments, and grading", icon: GraduationCap },
  { role: "admin", label: "Admin workspace", detail: "Courses, people, reports, and settings", icon: ShieldCheck },
];

/**
 * The previous system's "Select user type": shown after signing in when the account can open
 * more than one workspace (`roles`), and closed while `roles` is null.
 */
export function WorkspaceDialog({
  roles,
  onClose,
  onChoose,
}: {
  roles: WorkspaceRole[] | null;
  onClose: () => void;
  onChoose: (role: WorkspaceRole) => void;
}) {
  const choices = WORKSPACES.filter((workspace) => roles?.includes(workspace.role));
  return (
    <Dialog open={roles !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Choose a workspace" description="Accounts are not connected yet, so every workspace is open to you.">
        <ul className="flex flex-col gap-2">
          {choices.map(({ role, label, detail, icon: Icon }) => (
            <li key={role}>
              <button
                type="button"
                onClick={() => onChoose(role)}
                className="group flex min-h-touch w-full items-center gap-3 rounded-control border border-line-strong bg-surface p-3 text-left font-sans transition-colors duration-150 hover:border-primary-400 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
              >
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-100 text-primary-700 transition-colors duration-150 group-hover:bg-primary-700 group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-card-title font-semibold text-ink">{label}</span>
                  <span className="text-body text-muted">{detail}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-primary-700" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
