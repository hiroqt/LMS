import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";

/** A panel's one "View all" link (C-015, D-066): the same green text and arrow on every dashboard. */
export function PanelLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost" className="-mx-2 max-w-full shrink px-2 whitespace-normal text-primary-700" onClick={onClick}>
      {children}
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </Button>
  );
}
