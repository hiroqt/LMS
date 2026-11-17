import { ChevronDown, GraduationCap, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/Popover";

type Role = "student" | "instructor" | "admin";

export interface ProfileAction {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

export interface ProfileMenuProps {
  name: string;
  /** e.g. "BS Information Technology · Student". */
  subtitle: string;
  currentRole: Role;
  onSwitchRole: (role: Role) => void;
  /** Role-specific actions, e.g. Student "Reset demo data". */
  actions?: ProfileAction[];
}

const roles: Array<{ role: Role; label: string; icon: typeof LayoutDashboard }> = [
  { role: "student", label: "Student workspace", icon: LayoutDashboard },
  { role: "instructor", label: "Instructor workspace", icon: GraduationCap },
  { role: "admin", label: "Admin workspace", icon: ShieldCheck },
];

const item = "flex min-h-touch w-full items-center gap-2.5 rounded-control border-0 bg-transparent px-3 text-left text-body text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus disabled:cursor-default disabled:hover:bg-transparent [&>svg]:size-4 [&>svg]:text-muted";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
}

/** Profile, workspace switching, and account actions. Same structure as the classic menu. */
export function ProfileMenu({ name, subtitle, currentRole, onSwitchRole, actions = [] }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Profile: ${name}`}
        className="flex min-h-touch items-center gap-2 rounded-control border-0 bg-transparent px-1.5 font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus sm:px-2"
      >
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">{initials(name)}</span>
        <span className="hidden flex-col items-start text-left xl:flex">
          <span className="text-body font-semibold">{name}</span>
          <span className="text-body text-muted">{subtitle}</span>
        </span>
        <ChevronDown aria-hidden className="hidden size-4 text-muted xl:block" />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="px-3 pt-1.5 pb-2">
          <p className="m-0 text-body font-semibold">{name}</p>
          <p className="m-0 text-body text-muted">{subtitle}</p>
        </div>
        <div role="group" aria-label="Switch workspace" className="border-t border-line pt-1.5">
          <p className="m-0 px-3 pb-1 text-body font-semibold text-muted">Switch workspace</p>
          {roles.map(({ role, label, icon: Icon }) => (
            <button key={role} type="button" className={item} disabled={role === currentRole} onClick={() => run(() => onSwitchRole(role))}>
              <Icon aria-hidden />
              {label}
              {role === currentRole && <span className="ml-auto text-muted">Current</span>}
            </button>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="mt-1.5 border-t border-line pt-1.5">
            {actions.map((action) => (
              <button key={action.label} type="button" className={item} onClick={() => run(action.onSelect)}>
                <span aria-hidden className="inline-flex [&>svg]:size-4 [&>svg]:text-muted">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
