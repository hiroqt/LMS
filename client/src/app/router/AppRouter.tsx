import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import UnknownRoleFallback from "../../components/shared/UnknownRoleFallback.jsx";
import Admin from "../../roles/admin/Admin.jsx";
import { matchRole } from "./roles";
import { useRoleNavigation } from "./useRoleNavigation";

// Each workspace loads on demand, so a visitor downloads only their own role's UI.
const StudentApp = lazy(() => import("../../features/student/StudentApp"));
const InstructorApp = lazy(() => import("../../features/instructor/InstructorApp"));
const DesignSystemPage = lazy(() => import("../../features/design-system/DesignSystemPage"));

/**
 * Shown while a workspace chunk downloads. Plain markup on purpose: importing
 * shared/ui here would put Radix and tailwind-merge into the entry bundle (L-013).
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

  if (unknownPath) return <UnknownRoleFallback unknownPath={unknownPath} onNavigateRole={navigateRole} />;
  // Admin keeps its current UI until it gets its own revamp (D-001).
  if (role === "admin") return <Admin onNavigateRole={navigateRole} />;
  if (role === "instructor") return <InstructorApp onNavigateRole={navigateRole} />;
  return <StudentApp onNavigateRole={navigateRole} />;
}

/**
 * The catch-all route resolves the role exactly as the legacy router did, so
 * every old URL form still works (D-004); /ui-kit is the design-system
 * reference. Since cutover (D-021), Student and Instructor always use the
 * rebuilt UI; a leftover ?ui= parameter is ignored.
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
