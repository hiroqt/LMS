import { LayoutGrid, Rows3 } from "lucide-react";
import type { ClassView } from "../hooks/useClassView";
import { SegmentedControl } from "../ui/SegmentedControl";

const options = [
  { value: "cards", label: "Cards", icon: <LayoutGrid aria-hidden />, iconOnlyOnPhone: true },
  { value: "table", label: "Table", icon: <Rows3 aria-hidden />, iconOnlyOnPhone: true },
] as const;

/** Switches a class list between cards and a table. */
export function ViewToggle({ view, onChange }: { view: ClassView; onChange: (view: ClassView) => void }) {
  return <SegmentedControl label="Class list view" value={view} options={options} onChange={onChange} />;
}
