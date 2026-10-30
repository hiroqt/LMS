export default function RoleSwitcher({ role = "student", onNavigateRole, className = "" }) {
  return (
    <label className={`role-switch ${className}`} title="Switch workspace role">
      <span>Switch role</span>
      <select
        aria-label="Switch workspace"
        value={role}
        onChange={(event) => {
          const nextRole = event.target.value;
          if (onNavigateRole) {
            onNavigateRole(nextRole);
          } else {
            window.location.href = `/${nextRole}`;
          }
        }}
      >
        <option value="student">Student</option>
        <option value="instructor">Instructor</option>
        <option value="admin">Admin</option>
      </select>
    </label>
  );
}

