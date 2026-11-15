import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import UnknownRoleFallback from "../../components/shared/UnknownRoleFallback.jsx";
import Admin from "../../roles/admin/Admin.jsx";
import Instructor from "../../roles/instructor/Instructor.jsx";
import StudentWorkspace from "../../roles/student/StudentWorkspace.jsx";
import { matchRole } from "./roles";
import { useRoleNavigation } from "./useRoleNavigation";

function RoleWorkspaceRoute() {
  const location = useLocation();
  const navigateRole = useRoleNavigation();
  const { role, unknownPath } = matchRole(location);

  if (unknownPath) return <UnknownRoleFallback unknownPath={unknownPath} onNavigateRole={navigateRole} />;
  if (role === "admin") return <Admin onNavigateRole={navigateRole} />;
  if (role === "instructor") return <Instructor onNavigateRole={navigateRole} />;
  return <StudentWorkspace onNavigateRole={navigateRole} currentRole="student" />;
}

/**
 * Phase 0: one catch-all route so the legacy URL forms resolve exactly as
 * before. Later phases nest real routes (for example /student/tasks) under
 * each role's layout.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<RoleWorkspaceRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
