import { useCallback, useRef, useState } from "react";

/**
 * Unsaved-changes state for an editor that stays editable while it saves. Every change bumps
 * a revision; `begin` notes the revision a save started from and returns `settle`, which
 * clears `dirty` only when nothing changed since. An edit made during the save stays unsaved.
 */
export function useEditRevision(initial = false) {
  const [dirty, setDirty] = useState(initial);
  const revision = useRef(0);

  const touch = useCallback(() => {
    revision.current += 1;
    setDirty(true);
  }, []);

  const begin = useCallback(() => {
    const started = revision.current;
    /** True (and clean) when the save covered every change. */
    return () => {
      const current = revision.current === started;
      if (current) setDirty(false);
      return current;
    };
  }, []);

  return { dirty, touch, begin };
}
