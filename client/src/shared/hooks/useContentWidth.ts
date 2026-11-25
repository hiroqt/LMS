import { useEffect, useState, type RefObject } from "react";

/** The inner width of an element (less its padding and border), kept up to date as it resizes. */
export function useContentWidth(frame: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      // Whole pixels, so a scrollbar appearing doesn't redraw every page by a fraction.
      setWidth(Math.floor(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame]);
  return width;
}
