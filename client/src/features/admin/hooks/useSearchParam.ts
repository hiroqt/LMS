import { useCallback } from "react";
import { useSearchParams } from "react-router";

/** One URL query value with a setter that keeps the other params and replaces history. */
export function useSearchParam(key: string): [string | null, (value: string | undefined) => void] {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (value: string | undefined) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      ),
    [key, setParams],
  );
  return [params.get(key), set];
}
