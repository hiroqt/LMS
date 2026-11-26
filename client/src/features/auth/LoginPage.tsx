import { useEffect, useState } from "react";
import { demoSignIn } from "./api/demoAccount";
import { BrandMark } from "./components/BrandMark";
import { SignInForm } from "./components/SignInForm";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { COLLEGE_NAME } from "./data/collegeProfile";
import type { SignIn, WorkspaceRole } from "./types";

// Read once at load, so rendering stays pure.
const COPYRIGHT_YEAR = new Date().getFullYear();

/**
 * /login (D-044, D-066): the sign-in form alone, in one card centered on the canvas. Portrait
 * and desktop: one column. A phone held sideways (`landscape-short`): a wider card with the
 * brand and heading beside the form, so it fits the short screen. The page is `min-h-dvh`, so
 * when the card is taller than the screen it scrolls instead of clipping the card's top.
 * An account with one workspace opens it directly; one with several chooses in "Choose a workspace".
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
    <div className="flex min-h-dvh flex-col bg-canvas font-sans text-ink">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-6 sm:py-10 landscape-short:gap-2 landscape-short:px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] landscape-short:py-3">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-5 sm:p-8 landscape-short:max-w-3xl landscape-short:px-6 landscape-short:py-4">
          <SignInForm brand={<BrandMark />} signIn={signIn} onSignedIn={onSignedIn} />
        </div>
        <footer className="text-center text-body text-muted">
          <p>© {COPYRIGHT_YEAR} {COLLEGE_NAME}</p>
        </footer>
      </main>

      <WorkspaceDialog roles={workspaceRoles} onClose={() => setWorkspaceRoles(null)} onChoose={onNavigateRole} />
    </div>
  );
}
