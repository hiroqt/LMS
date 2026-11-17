import { VALID_ROLES, getRoleUrl, parseRoleFromLocation } from "./roleRouter.js";

export type Role = "student" | "instructor" | "admin";

export interface RoleMatch {
  role: Role | null;
  unknownPath: string | null;
}

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

/**
 * Resolves the workspace for a location. Delegates to the original
 * parseRoleFromLocation so every legacy URL form (?role=, #/role, .html,
 * /role/index.html, deployment subpaths) keeps working exactly as before.
 */
export function matchRole(location: LocationLike): RoleMatch {
  const { role, unknownPath } = parseRoleFromLocation(location) as { role: string | null; unknownPath: string | null };
  return { role: isRole(role) ? role : null, unknownPath };
}

/** Canonical URL for a role, including any deployment base path. */
export function roleUrl(role: Role): string {
  return getRoleUrl(role);
}

export function roleTitle(role: Role): string {
  return `TMCC LMS · ${role.charAt(0).toUpperCase()}${role.slice(1)} Workspace`;
}
