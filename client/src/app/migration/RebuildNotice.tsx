import { Hammer } from "lucide-react";
import { Button, EmptyState } from "../../shared/ui";

/**
 * Temporary placeholder (Phases 1–3) for screens not rebuilt yet in the new
 * UI. Points back to the classic view, where the screen works today.
 * Delete at cutover.
 */
export function RebuildNotice({ screen, onUseClassic }: { screen: string; onUseClassic: () => void }) {
  return (
    <EmptyState
      icon={<Hammer />}
      title={`The new ${screen} screen is on its way`}
      description="You are previewing the redesigned workspace. Everything you can do today still works in the classic view."
      action={<Button variant="secondary" onClick={onUseClassic}>Use classic view</Button>}
    />
  );
}
