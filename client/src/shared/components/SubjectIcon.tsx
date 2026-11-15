import { BookOpen, Code2, Database, Layers, Network } from "lucide-react";

/** A recognizable icon per subject area, chosen from the course title or subject. */
export function SubjectIcon({ subject, className }: { subject: string; className?: string }) {
  const text = subject.toLowerCase();
  const Icon = /program|code|software/.test(text) ? Code2 : /data/.test(text) ? Database : /web|html|css/.test(text) ? Layers : /network|routing/.test(text) ? Network : BookOpen;
  return <Icon aria-hidden className={className} />;
}
