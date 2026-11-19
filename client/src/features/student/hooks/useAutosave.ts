import { useEffect, useLayoutEffect, useState } from "react";
import type { AnswerInput } from "../../../shared/components/quiz/types";
import { createAutosaver, SAVE_STATUS_LABELS, type AutosaveOptions, type Autosaver, type SaveStatus } from "./autosave";

type Callbacks<T> = Pick<AutosaveOptions<T>, "save" | "onFailure" | "shouldRetry" | "keyOf">;

/** An autosaver that always calls the component's latest callbacks, which `update` replaces. */
function bind<T>(callbacks: Callbacks<T>, onStatus: AutosaveOptions<T>["onStatus"]) {
  const holder = { callbacks };
  const autosaver = createAutosaver<T>({
    save: (changes: T[]) => holder.callbacks.save(changes),
    ...(callbacks.keyOf ? { keyOf: callbacks.keyOf } : {}),
    onFailure: (error) => holder.callbacks.onFailure?.(error),
    shouldRetry: (error) => holder.callbacks.shouldRetry?.(error) ?? true,
    onStatus,
  });
  const update = (next: Callbacks<T>) => {
    holder.callbacks = next;
  };
  return { update, autosaver };
}

/**
 * Autosave bound to a component: the status for the screen, and saves when the
 * page is hidden (a phone switching apps), when the connection returns, and
 * when the quiz or the work card unmounts (leaving with Exit or Back), so typed
 * work is never lost on navigation. `keyOf` is read once, when the hook starts.
 */
export function useAutosave<T = AnswerInput>(callbacks: Callbacks<T>): { status: SaveStatus; announcement: string; autosaver: Autosaver<T> } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  // Only settled states are announced, and only when they change: "Saved" once,
  // not after every pause in typing, so the live region never floods.
  const [announcement, setAnnouncement] = useState("");
  const [{ update, autosaver }] = useState(() =>
    bind<T>(callbacks, (next) => {
      setStatus(next);
      if (next !== "saving" && next !== "idle") setAnnouncement(SAVE_STATUS_LABELS[next]);
    }),
  );
  useLayoutEffect(() => {
    update(callbacks);
  });

  useEffect(() => {
    const flush = () => void autosaver.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [autosaver]);

  return { status, announcement, autosaver };
}
