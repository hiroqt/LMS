import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import UnknownRoleFallback from "../../components/shared/UnknownRoleFallback.jsx";
import Admin from "../../roles/admin/Admin.jsx";
import Instructor from "../../roles/instructor/Instructor.jsx";
import StudentWorkspace from "../../roles/student/StudentWorkspace.jsx";
import { matchRole } from "./roles";
import { useRoleNavigation } from "./useRoleNavigation";
import { useUiVersion } from "./useUiVersion";

// The rebuilt UIs load on demand, so people on the classic UI never download them.
const StudentApp = lazy(() => import("../../features/student/StudentApp"));
const InstructorApp = lazy(() => import("../../features/instructor/InstructorApp"));
const DesignSystemPage = lazy(() => import("../../features/design-system/DesignSystemPage"));

/**
 * Shown while a lazy UI chunk downloads. Plain markup on purpose: importing
 * shared/ui here would put Radix and tailwind-merge into the eager bundle
 * that classic-UI users download (L-013).
 */
function PageLoading() {
  const bar = "animate-pulse rounded-control bg-line motion-reduce:animate-none";
  return (
    <div role="status" aria-busy="true" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 font-sans">
      <span className="sr-only">Loading workspace</span>
      <div aria-hidden className={`h-8 w-1/3 ${bar}`} />
      <div aria-hidden className={`h-32 w-full ${bar}`} />
      <div aria-hidden className={`h-32 w-full ${bar}`} />
    </div>
  );
}

function RoleWorkspaceRoute() {
  const location = useLocation();
  const navigateRole = useRoleNavigation();
  const { role, unknownPath } = matchRole(location);
  const [uiVersion, setUiVersion] = useUiVersion(role === "instructor" ? "instructor" : "student");

  if (unknownPath) return <UnknownRoleFallback unknownPath={unknownPath} onNavigateRole={navigateRole} />;
  // Admin is out of the revamp's scope and always uses its current UI (D-001).
  if (role === "admin") return <Admin onNavigateRole={navigateRole} />;

  if (uiVersion === "new") {
    const App = role === "instructor" ? InstructorApp : StudentApp;
    return <App onNavigateRole={navigateRole} onUseClassic={() => setUiVersion("classic")} />;
  }
  if (role === "instructor") return <Instructor onNavigateRole={navigateRole} />;
  return <StudentWorkspace onNavigateRole={navigateRole} currentRole="student" />;
}

/**
 * The catch-all route resolves the role exactly as the legacy router did
 * (D-004); /ui-kit is the design-system reference. ?ui=new previews the
 * rebuilt Student and Instructor UIs (D-011), remembered per role (D-014).
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/ui-kit" element={<DesignSystemPage />} />
          <Route path="*" element={<RoleWorkspaceRoute />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
