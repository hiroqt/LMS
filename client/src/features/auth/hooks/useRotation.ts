import { useCallback, useEffect, useRef, useState } from "react";

/** How often the timer advances; the progress bar eases over each step. */
export const ROTATION_TICK_MS = 100;

/**
 * Timer for an auto-advancing carousel. Slide `index` stays up for `durations[index]` ms, then
 * the next one shows. While `paused`, the time already spent on the slide is kept, so resuming
 * finishes the remaining time instead of starting over. Choosing a slide (`show`) starts its
 * full time. The remaining time is painted onto `progressRef`'s element directly, so the
 * carousel does not re-render ten times a second.
 *
 * The interval reads the slide from a ref, not from the render it was created in: a closure
 * would keep timing the old slide until React re-renders, and could skip a slide.
 */
export function useRotation(durations: number[], paused: boolean) {
  const count = durations.length;
  const [index, setIndex] = useState(0);
  const current = useRef(0);
  const elapsed = useRef(0);
  const progressRef = useRef<HTMLElement | null>(null);

  const paint = useCallback(() => {
    const duration = durations[current.current] ?? 1;
    progressRef.current?.style.setProperty("transform", `scaleX(${Math.min(elapsed.current / duration, 1)})`);
  }, [durations]);

  const show = useCallback(
    (next: number) => {
      current.current = ((next % count) + count) % count;
      elapsed.current = 0;
      setIndex(current.current);
      paint();
    },
    [count, paint],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => {
      elapsed.current += ROTATION_TICK_MS;
      if (elapsed.current >= (durations[current.current] ?? 0)) show(current.current + 1);
      else paint();
    }, ROTATION_TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, count, durations, paint, show]);

  return { index, show, progressRef };
}
