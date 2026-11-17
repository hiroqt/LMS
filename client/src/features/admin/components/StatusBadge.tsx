import { Badge } from "../../../shared/ui/Badge";

const tones = { active: "success", current: "success", inactive: "neutral", archived: "neutral", planned: "info" } as const;

/** Record status as a text badge (never color alone, C-004). */
export function StatusBadge({ status }: { status: string }) {
  const tone = tones[status as keyof typeof tones] ?? "neutral";
  return <Badge tone={tone}>{status.charAt(0).toUpperCase()}{status.slice(1)}</Badge>;
}
