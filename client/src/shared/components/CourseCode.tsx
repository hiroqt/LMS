import { cn } from "../lib/cn";

/**
 * A course code such as "IT101", set the way registrars and syllabi do: tracked
 * capitals in tabular figures. It leads course cards, class headers, sidebar
 * entries, and assessment rows, so a course is recognized the same way everywhere.
 */
export function CourseCode({ code, tone = "neutral", className }: { code: string; tone?: "neutral" | "onColor"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-chip px-1.5 py-0.5 font-sans text-body font-semibold tracking-code uppercase tabular-nums",
        tone === "onColor" ? "bg-surface/80 text-ink" : "bg-primary-100 text-primary-800",
        className,
      )}
    >
      {code}
    </span>
  );
}
