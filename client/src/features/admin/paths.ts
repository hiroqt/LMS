/**
 * Admin routes. Every page and open create form has a URL. Never use a `role`
 * query parameter here: the role router reads `?role=` as a workspace switch (D-004).
 */
export type CourseTab = "subjects" | "classrooms";

const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
  return query ? `${path}?${query}` : path;
};

export const adminPaths = {
  overview: "/admin",
  courses: (tab: CourseTab = "subjects", create = false) => withQuery("/admin/courses", { tab: tab === "subjects" ? undefined : tab, create: create ? "1" : undefined }),
  enrollments: (create = false) => withQuery("/admin/enrollments", { create: create ? "1" : undefined }),
  users: (role?: string, create = false) => withQuery("/admin/users", { type: role && role !== "all" ? role : undefined, create: create ? "1" : undefined }),
  roles: "/admin/roles",
  audit: "/admin/audit",
  reports: "/admin/reports",
  terms: "/admin/terms",
  settings: "/admin/settings",
};
