export const VALID_ROLES = ["student", "instructor", "admin"];

/**
 * Returns the detected base path (e.g. "" for root domain, or "/lms" for a subpath).
 */
export function getBaseUrl(pathname = typeof window !== "undefined" ? window.location.pathname : "/") {
  const envBase = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const normalizedEnvBase = envBase.replace(/\/+$/, "");

  if (normalizedEnvBase && normalizedEnvBase !== "/") {
    return normalizedEnvBase;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length > 1 &&
    VALID_ROLES.includes(segments[segments.length - 1].toLowerCase().replace(/\.html$/, ""))
  ) {
    return "/" + segments.slice(0, segments.length - 1).join("/");
  }

  return "";
}

/**
 * Parses the current role and any unknown path from the browser location.
 */
export function parseRoleFromLocation(location = typeof window !== "undefined" ? window.location : { pathname: "/", hash: "", search: "" }) {
  // 1. Check query parameter: ?role=...
  if (location.search) {
    try {
      const search = location.search.startsWith("?") ? location.search.slice(1) : location.search;
      const params = new URLSearchParams(search);
      const queryRole = params.get("role")?.toLowerCase();
      if (queryRole && VALID_ROLES.includes(queryRole)) {
        return { role: queryRole, unknownPath: null };
      }
    } catch {
      // Fall through to path parsing
    }
  }

  // 2. Check hash: #/instructor, #admin, etc.
  if (location.hash) {
    const rawHash = location.hash.replace(/^#\/?/, "").toLowerCase();
    const hashRole = rawHash.split(/[/?#]/)[0];
    if (VALID_ROLES.includes(hashRole)) {
      return { role: hashRole, unknownPath: null };
    }
  }

  // 3. Check pathname
  const rawPath = (location.pathname || "/").replace(/\/+$/, "");
  if (!rawPath) {
    return { role: "student", unknownPath: null };
  }

  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return { role: "student", unknownPath: null };
  }

  const lastSegment = segments[segments.length - 1].toLowerCase().replace(/\.html$/, "");

  // If ends in index (.html)
  if (lastSegment === "index") {
    if (segments.length > 1) {
      const prevSegment = segments[segments.length - 2].toLowerCase();
      if (VALID_ROLES.includes(prevSegment)) {
        return { role: prevSegment, unknownPath: null };
      }
    }
    return { role: "student", unknownPath: null };
  }

  if (VALID_ROLES.includes(lastSegment)) {
    return { role: lastSegment, unknownPath: null };
  }

  // If a role appears anywhere in the path segments
  const matchedRole = segments.find((seg) => VALID_ROLES.includes(seg.toLowerCase()));
  if (matchedRole) {
    return { role: matchedRole.toLowerCase(), unknownPath: null };
  }

  // Check if pathname is simply the deployment base path (e.g. /repo-name or /subpath)
  const envBase = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const cleanEnvBase = envBase.replace(/^\/+|\/+$/g, "");
  if (cleanEnvBase && segments.length === 1 && segments[0].toLowerCase() === cleanEnvBase.toLowerCase()) {
    return { role: "student", unknownPath: null };
  }

  // Path is unknown
  return { role: null, unknownPath: location.pathname };
}

/**
 * Returns the URL path for a given role.
 */
export function getRoleUrl(targetRole) {
  const base = getBaseUrl();
  const roleName = VALID_ROLES.includes(targetRole) ? targetRole : "student";
  return `${base}/${roleName}`;
}
