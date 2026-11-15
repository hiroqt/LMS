import { cn } from "../../../shared/lib/cn";

/** All years + each year level present. Names match the classic filter ("All years", "Year 1"). */
export function YearFilter({ levels, selected, onSelect }: { levels: number[]; selected: number | "all"; onSelect: (level: number | "all") => void }) {
  const pill = (active: boolean) =>
    cn(
      "inline-flex min-h-touch shrink-0 items-center rounded-full border px-4 font-sans text-body font-medium focus-visible:outline-3 focus-visible:outline-focus",
      active ? "border-primary-600 bg-primary-600 text-white" : "border-line-strong bg-surface text-ink hover:bg-primary-50",
    );
  return (
    <div role="group" aria-label="Filter classrooms by year level" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <button type="button" aria-pressed={selected === "all"} onClick={() => onSelect("all")} className={pill(selected === "all")}>All years</button>
      {levels.map((level) => (
        <button key={level} type="button" aria-pressed={selected === level} onClick={() => onSelect(level)} className={pill(selected === level)}>Year {level}</button>
      ))}
    </div>
  );
}
