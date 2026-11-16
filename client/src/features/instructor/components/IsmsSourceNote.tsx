import { Link2 } from "lucide-react";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";

/** Says where the class list comes from: ISMS, through the LMS API (D-031, D-032). */
export function IsmsSourceNote() {
  const { term } = useInstructorWorkspace();
  return (
    <p role="status" className="m-0 flex items-start gap-2 font-sans text-body text-muted">
      <Link2 aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>Classes and class lists come from ISMS{term ? ` · ${term}` : ""}.</span>
    </p>
  );
}
