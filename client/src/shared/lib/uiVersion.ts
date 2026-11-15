/**
 * Which UI a person sees during the migration: the legacy ("classic") UI or
 * the rebuilt one ("new"). Admin always stays classic (D-001).
 *
 * `?ui=new` or `?ui=classic` in the URL wins and is remembered; otherwise the
 * remembered choice applies; otherwise "classic" (until cutover).
 * Stored under its own key, never inside the LMS data keys (C-007).
 */
export type UiVersion = "classic" | "new";

export const UI_VERSION_STORAGE_KEY = "tmcc-ui-version";
export const UI_VERSION_EVENT = "tmcc-ui-version-change";

const isVersion = (value: unknown): value is UiVersion => value === "classic" || value === "new";

export function resolveUiVersion(search: string, stored: string | null): { version: UiVersion; fromUrl: boolean } {
  const fromUrl = new URLSearchParams(search).get("ui")?.toLowerCase();
  if (isVersion(fromUrl)) return { version: fromUrl, fromUrl: true };
  return { version: isVersion(stored) ? stored : "classic", fromUrl: false };
}

export function readStoredUiVersion(): string | null {
  try {
    return localStorage.getItem(UI_VERSION_STORAGE_KEY);
  } catch {
    return null; // Private mode or blocked storage: fall back to the default.
  }
}

export function storeUiVersion(version: UiVersion): void {
  try {
    localStorage.setItem(UI_VERSION_STORAGE_KEY, version);
  } catch {
    // The choice still applies for this page; it just is not remembered.
  }
  window.dispatchEvent(new Event(UI_VERSION_EVENT));
}
