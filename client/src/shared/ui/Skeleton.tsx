import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Content-shaped placeholder for slow connections. Static (C-019), and it
 * fades in only after 300 ms so fast loads never flash it; browsers without
 * @starting-style show it at once. Decorative: wrap a group of skeletons in an
 * element with aria-busy and a visually hidden "Loading …" label (see
 * SkeletonGroup).
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("rounded-control bg-line transition-opacity delay-300 duration-150 starting:opacity-0", className)} {...props} />;
}

export function SkeletonGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
