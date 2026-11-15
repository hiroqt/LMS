/**
 * Which UI a person sees during the migration: the legacy ("classic") UI or
 * the rebuilt one ("new"), chosen per role (D-014) because Student and
 * Instructor are rebuilt in different phases. Admin always stays classic.
 *
 * `?ui=new` or `?ui=classic` in the URL wins and is remembered for that role;
 * otherwise the role's remembered choice applies; otherwise "classic".
 * Stored under its own keys, never inside the LMS data keys (C-007).
 */
export type UiVersion = "classic" | "new";
export type UiRole = "student" | "instructor";

/** Phase 1 stored one choice for both roles; still honored as a fallback. */
export const LEGACY_UI_VERSION_KEY = "tmcc-ui-version";
export const uiVersionKey = (role: UiRole) => `tmcc-ui-version:${role}`;
export const UI_VERSION_EVENT = "tmcc-ui-version-change";

const isVersion = (value: unknown): value is UiVersion => value === "classic" || value === "new";

export function resolveUiVersion(search: string, stored: string | null): { version: UiVersion; fromUrl: boolean } {
  const fromUrl = new URLSearchParams(search).get("ui")?.toLowerCase();
  if (isVersion(fromUrl)) return { version: fromUrl, fromUrl: true };
  return { version: isVersion(stored) ? stored : "classic", fromUrl: false };
}

export function readStoredUiVersion(role: UiRole): string | null {
  try {
    return localStorage.getItem(uiVersionKey(role)) ?? localStorage.getItem(LEGACY_UI_VERSION_KEY);
  } catch {
    return null; // Private mode or blocked storage: fall back to the default.
  }
}

export function storeUiVersion(role: UiRole, version: UiVersion): void {
  try {
    localStorage.setItem(uiVersionKey(role), version);
  } catch {
    // The choice still applies for this page; it just is not remembered.
  }
  window.dispatchEvent(new Event(UI_VERSION_EVENT));
}
