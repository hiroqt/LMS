import { CircleHelp, ClipboardList, GraduationCap, ListChecks } from "lucide-react";

export function AssessmentTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type === "Exam" ? GraduationCap : type === "Long Quiz" ? ListChecks : type === "Assignment" ? ClipboardList : CircleHelp;
  return <Icon aria-hidden className={className} />;
}
