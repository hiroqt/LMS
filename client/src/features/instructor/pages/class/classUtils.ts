/** "Oct 24, 11:59 PM" or "No due date" (the classic Instructor format). */
export const dueLabel = (value?: string) =>
  value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "No due date";

export const RESOURCE_TYPES = ["Study guide", "Lecture Slides", "Lab Manual", "Reading", "Practice set", "Reference sheet"] as const;
