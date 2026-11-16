import { CloudOff, Link2 } from "lucide-react";
import { useInstructorSession } from "../hooks/useInstructorSession";

const time = (iso: string | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

/** Says where the class list comes from: ISMS, or this browser while ISMS cannot be reached (D-031). */
export function IsmsSourceNote() {
  const { isms } = useInstructorSession();
  if (isms.state === "loading") return null;
  const connected = isms.state === "connected" && isms.saved;
  const Icon = connected ? Link2 : CloudOff;
  return (
    <p role="status" className="m-0 flex items-start gap-2 font-sans text-body text-muted">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {connected
          ? `Classes and class lists come from ISMS${isms.termName ? ` · ${isms.termName}` : ""}${isms.syncedAt ? ` · synced ${time(isms.syncedAt)}` : ""}.`
          : isms.state === "connected"
            ? "ISMS classes were read but could not be saved in this browser. Free up browser storage, then reload."
            : "ISMS is not connected. Showing the classes saved in this browser."}
      </span>
    </p>
  );
}
