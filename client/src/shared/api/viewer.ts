/**
 * Who the client is "viewing as" (D-032). DEMO ONLY, NOT AUTHENTICATION: until
 * sign-in exists (Phase 4) the LMS API trusts these headers, and only in
 * Development and Demo mode. Real sign-in replaces this module.
 */
export type ViewerRole = "instructor" | "student";

export interface Viewer {
  id: string;
  role: ViewerRole;
}

/** Browser tests put a per-test id here so each test gets its own demo database. */
export const SANDBOX_KEY = "tmcc-demo-sandbox";

let current: Viewer | null = null;

export function setViewer(viewer: Viewer | null): void {
  current = viewer;
}

export function getViewer(): Viewer | null {
  return current;
}

function sandbox(): string | null {
  try {
    return localStorage.getItem(SANDBOX_KEY);
  } catch {
    return null;
  }
}

/** Headers for workspace calls: the viewer, plus the test sandbox when one is set. */
export function identityHeaders(viewer: Viewer | null = current): Record<string, string> {
  const headers: Record<string, string> = {};
  const box = sandbox();
  if (box) headers["X-Demo-Sandbox"] = box;
  if (viewer) {
    headers["X-Demo-User-Id"] = viewer.id;
    headers["X-Demo-Role"] = viewer.role;
  }
  return headers;
}
