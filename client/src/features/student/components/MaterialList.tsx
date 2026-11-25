import { CalendarArrowDown, FolderTree } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { fileKindLabel, formatBytes } from "../../../shared/api/assignments";
import { reading } from "../../../shared/assets/illustrations";
import { FileTypeIcon } from "../../../shared/components/files/FileTypeIcon";
import { IconTile, ListRow, RowList } from "../../../shared/components/ListRow";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { usePersistentState } from "../../../shared/hooks/usePersistentState";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { FilterChip, FilterChipGroup } from "../../../shared/ui/FilterChip";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import { materialsByModule, newestFirst } from "../api/selectors";
import type { Course, Material, StudentCatalog } from "../api/types";
import { studentPaths } from "../paths";
import { ListSearch } from "./ListSearch";

/** "Study guide · PDF · 1.2 MB · Nov 12", or "… · No file · …" */
function materialFacts(item: Material): string {
  const file = item.file ? `${fileKindLabel(item.file)} · ${formatBytes(item.file.size)}` : "No file";
  return [item.kind, file, item.added].join(" · ");
}

/** Materials as rows: the whole row opens the material (C-015). */
export function MaterialRows({ materials, label }: { materials: readonly Material[]; label: string }) {
  const navigate = useNavigate();
  return (
    <RowList label={label}>
      {materials.map((item) => (
        <ListRow
          key={item.id}
          lead={<IconTile tone="bg-info-soft text-info"><FileTypeIcon type={item.file?.type ?? "text"} /></IconTile>}
          title={item.title}
          meta={materialFacts(item)}
          onOpen={() => navigate(studentPaths.material(item.id))}
        />
      ))}
    </RowList>
  );
}

type Order = "module" | "newest";
const ORDERS = [
  { value: "module", label: "By module", icon: <FolderTree aria-hidden />, iconOnlyOnPhone: false },
  { value: "newest", label: "Newest first", icon: <CalendarArrowDown aria-hidden />, iconOnlyOnPhone: false },
] as const;

/**
 * A class's materials (D-067): grouped by module, then submodule, in the instructor's order, or
 * newest first; narrowed by resource type and by a search of titles, descriptions, and file names.
 */
export function ClassMaterials({ course, catalog }: { course: Course; catalog: StudentCatalog }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [order, setOrder] = usePersistentState<Order>("tmcc-student-materials-order", "module");
  const all = catalog.materials.filter((item) => item.courseId === course.id);
  const kinds = [...new Set(all.map((item) => item.kind))];
  const q = query.trim().toLowerCase();
  const matches = (item: Material) =>
    (kind === "all" || item.kind === kind) && (!q || `${item.title} ${item.kind} ${item.summary} ${item.file?.name ?? ""}`.toLowerCase().includes(q));
  const shown = all.filter(matches);
  const groups = materialsByModule({ modules: catalog.modules, materials: shown }, course.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="Class materials" count={all.length} />
        <ListSearch label="Search materials" placeholder="Search materials" value={query} onChange={setQuery} />
      </div>
      {all.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {kinds.length > 1 ? (
            <FilterChipGroup label="Filter by resource type">
              <FilterChip selected={kind === "all"} onClick={() => setKind("all")}>All types</FilterChip>
              {kinds.map((item) => (
                <FilterChip key={item} selected={kind === item} count={all.filter((material) => material.kind === item).length} onClick={() => setKind(item)}>
                  {item}
                </FilterChip>
              ))}
            </FilterChipGroup>
          ) : (
            <span />
          )}
          <SegmentedControl label="Order of materials" value={order} options={ORDERS} onChange={setOrder} />
        </div>
      )}

      {/* The class has none yet (D-057); a search or filter that finds nothing keeps the plain line. */}
      {all.length === 0 ? (
        <EmptyState illustration={reading} title="No materials found." />
      ) : shown.length === 0 ? (
        <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No materials found.</p>
      ) : order === "newest" ? (
        <div className="rounded-card border border-line bg-surface px-3">
          <MaterialRows materials={newestFirst(shown)} label="Materials, newest first" />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`materials-${group.id}`} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
            <h3 id={`materials-${group.id}`} className="m-0 flex flex-wrap items-baseline gap-x-2 font-sans text-card-title font-semibold">
              {group.title}
              <span className="text-body font-normal text-muted">{count(group.materials.length + group.submodules.reduce((sum, sub) => sum + sub.materials.length, 0))}</span>
            </h3>
            {group.materials.length > 0 && <MaterialRows materials={group.materials} label={`Materials in ${group.title}`} />}
            {group.submodules.map((sub) => (
              <section key={sub.id} aria-labelledby={`materials-${sub.id}`} className="flex flex-col gap-1 border-t border-line pt-3 sm:pl-4">
                <h4 id={`materials-${sub.id}`} className="m-0 font-sans text-body-lg font-semibold">{sub.title}</h4>
                <MaterialRows materials={sub.materials} label={`Materials in ${sub.title}`} />
              </section>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

const count = (n: number) => (n === 1 ? "1 material" : `${n} materials`);
