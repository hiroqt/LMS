import { useSyncExternalStore } from "react";

export interface NetworkStatus {
  online: boolean;
  /** True on 2G-class connections or when the person turned on data saver. */
  slow: boolean;
}

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  saveData?: boolean;
}

function connection(): NetworkInformationLike | undefined {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function read(): string {
  const info = connection();
  const slow = Boolean(info?.saveData) || info?.effectiveType === "2g" || info?.effectiveType === "slow-2g";
  // A string snapshot keeps useSyncExternalStore from re-rendering on equal objects.
  return `${navigator.onLine ? 1 : 0}${slow ? 1 : 0}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  connection()?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    connection()?.removeEventListener("change", onChange);
  };
}

/**
 * Live connection status. navigator.onLine can report "online" behind a dead
 * captive portal, so treat `online` as a hint for messaging only; requests
 * still rely on the QueryClient's offline-first retries (D-009).
 * The Network Information API exists only in Chromium; elsewhere `slow` is false.
 */
export function useNetworkStatus(): NetworkStatus {
  const snapshot = useSyncExternalStore(subscribe, read, () => "10");
  return { online: snapshot[0] === "1", slow: snapshot[1] === "1" };
}
