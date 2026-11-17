/*
 * Modules and their submodules (one level, as the LMS API allows). Both the
 * Instructor and the Student class pages show the same tree, so the ordering
 * and labeling rules live here once.
 */

export interface TreeModule {
  id: string;
  /** Set on a submodule: the module it belongs to. */
  parentId?: string;
  title: string;
  order?: number;
}

export interface ModuleBranch<T extends TreeModule> {
  module: T;
  submodules: T[];
}

/** By sort order, then by id (the server's order), so ties never shuffle. */
export function compareModules(a: TreeModule, b: TreeModule): number {
  return (a.order ?? 0) - (b.order ?? 0) || Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);
}

/**
 * Top-level modules with their submodules, both in order. A submodule whose
 * module is missing is shown as a module, so its content never disappears.
 */
export function moduleTree<T extends TreeModule>(modules: readonly T[]): ModuleBranch<T>[] {
  const ids = new Set(modules.map((item) => item.id));
  const isTop = (item: T) => !item.parentId || !ids.has(item.parentId);
  const sorted = [...modules].sort(compareModules);
  return sorted.filter(isTop).map((module) => ({ module, submodules: sorted.filter((item) => !isTop(item) && item.parentId === module.id) }));
}

/** Choices for a module picker, in tree order: "Unit 1", then "Unit 1 › 1.1 Joins". */
export function moduleChoices<T extends TreeModule>(modules: readonly T[]): Array<{ id: string; label: string }> {
  return moduleTree(modules).flatMap(({ module, submodules }) => [
    { id: module.id, label: module.title },
    ...submodules.map((item) => ({ id: item.id, label: `${module.title} › ${item.title}` })),
  ]);
}

/** "Unit 1 › 1.1 Joins" for a submodule, the title for a module. */
export function modulePath<T extends TreeModule>(modules: readonly T[], id: string): string | undefined {
  return moduleChoices(modules).find((item) => item.id === id)?.label;
}

/**
 * The sort orders that change when `id` moves one place up (-1) or down (+1)
 * among its siblings. The siblings are renumbered 1, 2, 3… so equal or
 * missing orders still move. Empty when it is already first or last.
 */
export function reorderSiblings<T extends TreeModule>(siblings: readonly T[], id: string, direction: -1 | 1): Array<{ id: string; order: number }> {
  const sorted = [...siblings].sort(compareModules);
  const from = sorted.findIndex((item) => item.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= sorted.length) return [];
  const [moved] = sorted.splice(from, 1);
  if (moved) sorted.splice(to, 0, moved);
  return sorted.map((item, index) => ({ id: item.id, order: index + 1, before: item.order })).filter((item) => item.before !== item.order).map(({ id: changed, order }) => ({ id: changed, order }));
}
