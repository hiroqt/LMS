import { useState, type FormEvent } from "react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { FilterChip, FilterChipGroup } from "../../../shared/ui/FilterChip";
import { DataTable } from "../components/DataTable";
import type { RolePermissions, UserRole } from "../data/types";
import { useAdmin } from "../hooks/useAdmin";

const roles: { id: UserRole; label: string; detail: string }[] = [
  { id: "student", label: "Student", detail: "Learner access profile" },
  { id: "instructor", label: "Instructor", detail: "Teaching staff access profile" },
  { id: "admin", label: "Admin", detail: "Administrator access profile" },
];
const modules = [
  ["overview", "Overview"],
  ["systemConfiguration", "System Configuration"],
  ["academicTerms", "Academic Terms"],
  ["users", "Users"],
  ["courses", "Courses"],
  ["reports", "Reports"],
  ["auditLogs", "Audit Logs"],
] as const;
const actions = ["view", "create", "edit", "deactivate", "export"] as const;

export default function RolesPage() {
  const { data, update } = useAdmin();
  const [permissions, setPermissions] = useState<RolePermissions>(data.systemAdministration.rolePermissions);
  const [selected, setSelected] = useState<UserRole>("student");
  const [notice, setNotice] = useState("");
  const role = roles.find((item) => item.id === selected) ?? roles[0]!;
  const enabled = modules.reduce((total, [module]) => total + actions.filter((action) => permissions[selected]?.[module]?.[action]).length, 0);

  const change = (module: string, action: string, checked: boolean) =>
    setPermissions((current) => ({ ...current, [selected]: { ...current[selected], [module]: { ...current[selected]?.[module], [action]: checked } } }));

  const save = (event: FormEvent) => {
    event.preventDefault();
    update((current) => ({ ...current, systemAdministration: { ...current.systemAdministration, rolePermissions: permissions } }), {
      category: "roles",
      action: "updated",
      target: "Role permissions",
      targetId: "role-matrix",
      summary: "Demo permission matrix updated",
    });
    setNotice("Demo permission matrix saved in this browser. Permissions do not restrict navigation or data.");
  };

  return (
    <>
      <PageHeader title="Role management" description="A demo permission matrix for each built-in role. It is display only: it does not restrict navigation or data." />
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
          <FilterChipGroup label="Select a role">
            {roles.map((item) => (
              <FilterChip key={item.id} selected={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</FilterChip>
            ))}
          </FilterChipGroup>
          <p className="m-0 flex flex-wrap items-center gap-2 font-sans text-body text-muted">
            {role.detail} <Badge tone="brand">{enabled} of {modules.length * actions.length} enabled</Badge>
          </p>
        </div>
        <DataTable label={`${selected} module permissions`} head={<tr><th scope="col">Module</th>{actions.map((action) => <th scope="col" key={action} className="capitalize">{action}</th>)}</tr>}>
          {modules.map(([module, label]) => (
            <tr key={module}>
              <th scope="row" className="font-semibold">{label}</th>
              {actions.map((action) => (
                <td key={action}>
                  <label className="grid size-touch place-items-center">
                    <input
                      type="checkbox"
                      aria-label={`${selected} ${action} ${label}`}
                      checked={Boolean(permissions[selected]?.[module]?.[action])}
                      onChange={(event) => change(module, action, event.target.checked)}
                      className="size-5 accent-primary-700"
                    />
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </DataTable>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" className="self-start">Save permission matrix</Button>
          <p role="status" className="m-0 font-sans text-body text-success">{notice}</p>
        </div>
      </form>
    </>
  );
}
