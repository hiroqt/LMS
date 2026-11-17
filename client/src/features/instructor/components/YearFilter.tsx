import { FilterChip, FilterChipGroup } from "../../../shared/ui/FilterChip";

/** All years + each year level present. Names match the classic filter ("All years", "Year 1"). */
export function YearFilter({ levels, selected, onSelect }: { levels: number[]; selected: number | "all"; onSelect: (level: number | "all") => void }) {
  return (
    <FilterChipGroup label="Filter classrooms by year level">
      <FilterChip selected={selected === "all"} onClick={() => onSelect("all")}>All years</FilterChip>
      {levels.map((level) => (
        <FilterChip key={level} selected={selected === level} onClick={() => onSelect(level)}>Year {level}</FilterChip>
      ))}
    </FilterChipGroup>
  );
}
