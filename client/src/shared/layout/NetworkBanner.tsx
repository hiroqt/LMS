import { WifiOff, Gauge, X } from "lucide-react";
import { useState } from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

/**
 * Polite connection notice. Offline always shows (it explains why things may
 * not refresh); the slow-connection notice can be dismissed for the session.
 */
export function NetworkBanner() {
  const { online, slow } = useNetworkStatus();
  const [slowDismissed, setSlowDismissed] = useState(false);
  const showSlow = online && slow && !slowDismissed;

  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {!online && (
        <p className="m-0 flex items-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5 font-sans text-body text-warning">
          <WifiOff aria-hidden className="size-5 shrink-0" />
          <span><strong className="font-semibold">You’re offline.</strong> You can keep working; your answers are saved on this device.</span>
        </p>
      )}
      {showSlow && (
        <p className="m-0 flex items-center gap-3 border-b border-info/30 bg-info-soft px-4 py-1.5 font-sans text-body text-info">
          <Gauge aria-hidden className="size-5 shrink-0" />
          <span className="flex-1">Slow connection. Pages may take longer to load.</span>
          <button
            type="button"
            aria-label="Dismiss slow connection notice"
            onClick={() => setSlowDismissed(true)}
            className="grid size-touch shrink-0 place-items-center rounded-control border-0 bg-transparent text-info hover:bg-info/10 focus-visible:outline-3 focus-visible:outline-focus"
          >
            <X aria-hidden className="size-4" />
          </button>
        </p>
      )}
    </div>
  );
}
