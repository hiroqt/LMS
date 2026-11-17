import type { ImportResult } from "./questionSets";

/*
 * "Import questions" on the Question sets page creates an empty set and opens it with the
 * imported drafts unsaved, so the original text and warnings stay on each card. The drafts
 * are handed over in memory only: never browser storage (shared lab computers), so a reload
 * drops them, as it drops any unsaved edit.
 */
const pending = new Map<number, ImportResult>();

export function handOffImport(setId: number, result: ImportResult): void {
  pending.set(setId, result);
}

export function peekImport(setId: number): ImportResult | undefined {
  return pending.get(setId);
}

export function clearImport(setId: number): void {
  pending.delete(setId);
}
