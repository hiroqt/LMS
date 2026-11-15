import { useCallback, useState } from "react";

/**
 * useState that remembers a small display preference on this device (sidebar
 * width, cards or table). Falls back to memory when storage is unavailable.
 */
export function usePersistentState<T extends string | boolean>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return initial;
      const parsed: unknown = JSON.parse(stored);
      return typeof parsed === typeof initial ? (parsed as T) : initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode: the choice lasts for this visit only.
      }
    },
    [key],
  );
  return [value, update];
}
