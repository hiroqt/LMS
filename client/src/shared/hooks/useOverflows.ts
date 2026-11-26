import { useEffect, useRef, useState } from "react";

/**
 * Whether an element's content is taller than the element, kept current as either resizes.
 * A list that scrolls inside a fixed-height tile uses it to become a keyboard stop only while
 * it actually scrolls (axe: scrollable-region-focusable), and not on phones where it never does.
 */
export function useOverflows<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  });
  return [ref, overflows] as const;
}
