import { useEffect, useState } from "react";
import { demoSignIn } from "./api/demoAccount";
import { BrandMark } from "./components/BrandMark";
import { CollegePanel } from "./components/CollegePanel";
import { SignInForm } from "./components/SignInForm";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { collegeProfile } from "./data/collegeProfile";
import type { SignIn, WorkspaceRole } from "./types";

// Read once at load, so rendering stays pure.
const COPYRIGHT_YEAR = new Date().getFullYear();

/**
 * /login (D-044, D-045, D-050). One column on phones (form, then the college); from the `@4xl`
 * page width a full-height split with the form on the left and the college on the right. An account with one workspace
 * opens it directly; one with several chooses in "Choose a workspace".
 */
export default function LoginPage({
  onNavigateRole,
  signIn = demoSignIn,
}: {
  onNavigateRole: (role: string) => void;
  /** The account service. Defaults to the demo stand-in; tests pass their own. */
  signIn?: SignIn;
}) {
  const [workspaceRoles, setWorkspaceRoles] = useState<WorkspaceRole[] | null>(null);

  useEffect(() => {
    document.title = "TMCC LMS · Sign in";
  }, []);

  const onSignedIn = (roles: WorkspaceRole[]) => {
    const [only] = roles;
    if (roles.length === 1 && only) onNavigateRole(only);
    else setWorkspaceRoles(roles);
  };

  return (
    <div className="@container/page min-h-dvh bg-surface font-sans text-ink">
      {/* The college panel gets the larger share (D-052); the form column keeps room for its 28rem form. */}
      <div className="grid min-h-dvh grid-cols-1 @4xl/page:grid-cols-[minmax(26rem,2fr)_minmax(0,3fr)] @7xl/page:grid-cols-[minmax(32rem,1fr)_minmax(0,2fr)]">
        <main className="flex flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8 @4xl/page:py-10 @7xl/page:px-12">
          <BrandMark />
          {/* The form sits on the page itself, without a card (D-050). */}
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <SignInForm signIn={signIn} onSignedIn={onSignedIn} />
            </div>
          </div>
          <footer className="text-center text-body text-muted">
            <p>© {COPYRIGHT_YEAR} {collegeProfile.name}</p>
          </footer>
        </main>

        <CollegePanel />
      </div>

      <WorkspaceDialog roles={workspaceRoles} onClose={() => setWorkspaceRoles(null)} onChoose={onNavigateRole} />
    </div>
  );
}
