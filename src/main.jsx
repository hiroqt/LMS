import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudentWorkspace from "./roles/student/StudentWorkspace.jsx";
import Instructor from "./roles/instructor/Instructor.jsx";
import Admin from "./roles/admin/Admin.jsx";
import UnknownRoleFallback from "./components/shared/UnknownRoleFallback.jsx";
import { useRoleRoute } from "./roles/shared/roleRouter.js";

export function RootApp() {
  const { role, unknownPath, navigateRole } = useRoleRoute();

  if (unknownPath) {
    return (
      <UnknownRoleFallback
        unknownPath={unknownPath}
        onNavigateRole={navigateRole}
      />
    );
  }

  if (role === "admin") {
    return <Admin onNavigateRole={navigateRole} currentRole="admin" />;
  }

  if (role === "instructor") {
    return <Instructor onNavigateRole={navigateRole} currentRole="instructor" />;
  }

  return <StudentWorkspace onNavigateRole={navigateRole} currentRole="student" />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
