import { useState } from "react";

const roleNames = ["student", "instructor", "admin"];
const roleDetails = {
  student: "Learner access profile",
  instructor: "Teaching staff access profile",
  admin: "Administrator access profile",
};
const modules = [
  ["overview", "Overview"],
  ["systemConfiguration", "System Configuration"],
  ["academicTerms", "Academic Terms"],
  ["users", "Users"],
  ["courses", "Courses"],
  ["learningResources", "Learning Resources"],
  ["reports", "Reports"],
  ["auditLogs", "Audit Logs"],
];
const actions = ["view", "create", "edit", "deactivate", "export"];
const actor = { actorId: "admin-1", actorName: "Taylor Morgan", actorRole: "admin", category: "roles", action: "updated", target: "Role permissions", targetId: "role-matrix", summary: "Demo permission matrix updated" };

export default function AdminRoleManagement({ data, update }) {
  const [permissions, setPermissions] = useState(data.systemAdministration.rolePermissions);
  const [selectedRole, setSelectedRole] = useState("student");
  const [notice, setNotice] = useState("");
  const enabledActions = modules.reduce((total, [module]) => total + actions.filter((action) => permissions[selectedRole]?.[module]?.[action]).length, 0);

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
        <p>Review and edit the demo action profile for one role at a time. These values do not restrict navigation or data.</p>
        <div className="admin-role-matrix-toolbar">
          <div className="admin-role-picker" role="group" aria-label="Select a role">
            {roleNames.map((role) => <button type="button" key={role} aria-pressed={selectedRole === role} className={selectedRole === role ? "selected" : ""} onClick={() => setSelectedRole(role)}>{role}</button>)}
          </div>
          <div className="admin-role-summary"><strong>{selectedRole}</strong><span>{roleDetails[selectedRole]}</span><b>{enabledActions} of {modules.length * actions.length} enabled</b></div>
        </div>
        <div className="role-table-wrap"><table className="role-table admin-role-matrix" aria-label={`${selectedRole} module permissions`}><thead><tr><th scope="col">Module</th>{actions.map((action) => <th scope="col" key={action}>{action}</th>)}</tr></thead><tbody>
          {modules.map(([module, label]) => <tr key={module}><th scope="row">{label}</th>{actions.map((action) => <td key={action}><label className="admin-permission-check"><input type="checkbox" aria-label={`${selectedRole} ${action} ${label}`} checked={Boolean(permissions[selectedRole]?.[module]?.[action])} onChange={(event) => change(selectedRole, module, action, event.target.checked)} /></label></td>)}</tr>)}
        </tbody></table></div>
        <div className="role-form-actions"><button className="role-primary" type="submit">Save permission matrix</button></div>
        {notice && <p className="admin-settings-notice" role="status">{notice}</p>}
      </div>
    </form>
    <p className="admin-system-boundary">Role names are fixed to Student, Instructor, and Admin. Real authorization requires a server-side identity and permission system.</p>
  </section>;
}
