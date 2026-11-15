import { ChevronDown, GraduationCap, LayoutDashboard, RotateCcw, ShieldCheck } from "lucide-react";
import { Menu, MenuContent, MenuGroup, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../ui";

type Role = "student" | "instructor" | "admin";

export interface ProfileMenuProps {
  name: string;
  /** e.g. "BS Information Technology · Student". */
  subtitle: string;
  currentRole: Role;
  onSwitchRole: (role: Role) => void;
  /** Present during the migration: returns to the legacy UI. */
  onUseClassic?: () => void;
}

const roles: Array<{ role: Role; label: string; icon: typeof LayoutDashboard }> = [
  { role: "student", label: "Student workspace", icon: LayoutDashboard },
  { role: "instructor", label: "Instructor workspace", icon: GraduationCap },
  { role: "admin", label: "Admin workspace", icon: ShieldCheck },
];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function ProfileMenu({ name, subtitle, currentRole, onSwitchRole, onUseClassic }: ProfileMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        aria-label={`Profile: ${name}`}
        className="flex min-h-touch items-center gap-2 rounded-control border-0 bg-transparent px-1.5 font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus sm:px-2"
      >
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">{initials(name)}</span>
        <span className="hidden flex-col items-start text-left md:flex">
          <span className="text-body font-semibold">{name}</span>
          <span className="text-body text-muted">{subtitle}</span>
        </span>
        <ChevronDown aria-hidden className="hidden size-4 text-muted md:block" />
      </MenuTrigger>
      <MenuContent>
        <div className="px-3 py-2">
          <p className="m-0 text-body font-semibold">{name}</p>
          <p className="m-0 text-body text-muted">{subtitle}</p>
        </div>
        <MenuSeparator />
        <MenuGroup>
          <MenuLabel>Switch workspace</MenuLabel>
          {roles.map(({ role, label, icon: Icon }) => (
            <MenuItem key={role} disabled={role === currentRole} onSelect={() => onSwitchRole(role)}>
              <Icon aria-hidden />
              {label}
              {role === currentRole && <span className="ml-auto text-body text-muted">Current</span>}
            </MenuItem>
          ))}
        </MenuGroup>
        {onUseClassic && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={onUseClassic}>
              <RotateCcw aria-hidden />
              Use classic view
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
