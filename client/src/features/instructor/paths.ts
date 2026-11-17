/** Instructor routes. Every screen, tab, open form, and selected submission has a URL. */
export const CLASS_TABS = ["Stream", "Classwork", "Modules", "Announcements", "Materials", "People", "Attendance", "Submissions", "Create content"] as const;
export type ClassTab = (typeof CLASS_TABS)[number];
export const isClassTab = (value: unknown): value is ClassTab => CLASS_TABS.includes(value as ClassTab);

export type ContentType = "material" | "activity" | "exam";
export const isContentType = (value: unknown): value is ContentType => value === "material" || value === "activity" || value === "exam";

export const instructorPaths = {
  overview: "/instructor",
  classes: (year?: number | "all") => (year && year !== "all" ? `/instructor/classes?year=${year}` : "/instructor/classes"),
  classPage: (id: string, tab: ClassTab = "Stream", extra: { review?: string; create?: ContentType } = {}) => {
    const params = new URLSearchParams();
    if (tab !== "Stream") params.set("tab", tab);
    if (extra.review) params.set("review", extra.review);
    if (extra.create) params.set("create", extra.create);
    const query = params.toString();
    return `/instructor/classes/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
  },
  questionSets: "/instructor/question-sets",
  questionSet: (id: number) => `/instructor/question-sets/${id}`,
  gradebook: (classId?: string) => (classId ? `/instructor/gradebook?class=${encodeURIComponent(classId)}` : "/instructor/gradebook"),
};
