import { useState } from "react";

const roleNames = ["student", "instructor", "admin"];
const modules = [
  ["overview", "Overview"],
  ["systemConfiguration", "System Configuration"],
  ["academicTerms", "Academic Terms"],
  ["users", "Users"],
  ["courses", "Courses"],
  ["reports", "Reports"],
  ["auditLogs", "Audit Logs"],
];
const actions = ["view", "create", "edit", "deactivate", "export"];
const actor = { actorId: "admin-1", actorName: "Taylor Morgan", actorRole: "admin", category: "roles", action: "updated", target: "Role permissions", targetId: "role-matrix", summary: "Demo permission matrix updated" };

export default function AdminRoleManagement({ data, update }) {
  const [permissions, setPermissions] = useState(data.systemAdministration.rolePermissions);
  const [notice, setNotice] = useState("");

  function change(role, module, action, checked) {
    setPermissions((current) => ({
      ...current,
      [role]: {
        ...current[role],
        [module]: { ...current[role][module], [action]: checked },
      },
    }));
  }

  function save(event) {
    event.preventDefault();
    update((current) => ({ ...current, systemAdministration: { ...current.systemAdministration, rolePermissions: permissions } }), actor);
    setNotice("Demo permission matrix saved in this browser. Permissions do not restrict navigation or data.");
  }

  return <section className="admin-system-page">
    <form onSubmit={save}>
      <div className="admin-role-matrix-card">
        <div className="admin-system-card-head"><div><span className="admin-system-kicker">BUILT-IN ROLES</span><h2>Module permissions</h2></div><span className="role-soft-tag">Preview only</span></div>
        <p>These editable values demonstrate role profiles. The prototype does not enforce them.</p>
        <div className="role-table-wrap"><table className="role-table admin-role-matrix"><thead><tr><th>Module</th><th>Role</th>{actions.map((action) => <th key={action}>{action}</th>)}</tr></thead><tbody>
          {modules.flatMap(([module, label]) => roleNames.map((role) => <tr key={`${module}-${role}`}><td><strong>{label}</strong></td><td className="admin-role-name">{role}</td>{actions.map((action) => <td key={action}><input type="checkbox" aria-label={`${role} ${action} ${label}`} checked={Boolean(permissions[role]?.[module]?.[action])} onChange={(event) => change(role, module, action, event.target.checked)} /></td>)}</tr>))}
        </tbody></table></div>
        <div className="role-form-actions"><button className="role-primary" type="submit">Save permission matrix</button></div>
        {notice && <p className="admin-settings-notice" role="status">{notice}</p>}
      </div>
    </form>
    <p className="admin-system-boundary">Role names are fixed to Student, Instructor, and Admin. Real authorization requires a server-side identity and permission system.</p>
  </section>;
}
