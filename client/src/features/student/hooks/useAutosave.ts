import { useEffect, useLayoutEffect, useState } from "react";
import type { AnswerInput } from "../../../shared/components/quiz/types";
import { createAutosaver, SAVE_STATUS_LABELS, type AutosaveOptions, type Autosaver, type SaveStatus } from "./autosave";

type Callbacks = Pick<AutosaveOptions, "save" | "onFailure" | "shouldRetry">;

/** An autosaver that always calls the component's latest callbacks, which `update` replaces. */
function bind(callbacks: Callbacks, onStatus: AutosaveOptions["onStatus"]) {
  const holder = { callbacks };
  const autosaver = createAutosaver({
    save: (answers: AnswerInput[]) => holder.callbacks.save(answers),
    onFailure: (error) => holder.callbacks.onFailure?.(error),
    shouldRetry: (error) => holder.callbacks.shouldRetry?.(error) ?? true,
    onStatus,
  });
  const update = (next: Callbacks) => {
    holder.callbacks = next;
  };
  return { update, autosaver };
}

/**
 * Autosave bound to a component: the status for the screen, and saves when the
 * page is hidden (a phone switching apps), when the connection returns, and
 * when the quiz unmounts (leaving with Exit or Back), so typed answers are
 * never lost on navigation.
 */
export function useAutosave(callbacks: Callbacks): { status: SaveStatus; announcement: string; autosaver: Autosaver } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  // Only settled states are announced, and only when they change: "Saved" once,
  // not after every pause in typing, so the live region never floods.
  const [announcement, setAnnouncement] = useState("");
  const [{ update, autosaver }] = useState(() =>
    bind(callbacks, (next) => {
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
