/** Instructor routes. Every screen, tab, open form, and selected submission has a URL. */
export const CLASS_TABS = ["Stream", "Classwork", "Modules", "Announcements", "Materials", "People", "Attendance", "Submissions", "Create content"] as const;
export type ClassTab = (typeof CLASS_TABS)[number];
export const isClassTab = (value: unknown): value is ClassTab => CLASS_TABS.includes(value as ClassTab);

export type ContentType = "material" | "activity" | "exam";
export const isContentType = (value: unknown): value is ContentType => value === "material" || value === "activity" || value === "exam";

/** The views of an exam's grading page; each has its own URL (`?view=`). */
export const GRADING_VIEWS = ["submissions", "spelling-review", "item-analysis"] as const;
export type GradingView = (typeof GRADING_VIEWS)[number];
export const isGradingView = (value: unknown): value is GradingView => GRADING_VIEWS.includes(value as GradingView);

/** The parts of the assessment builder, one tab each (D-056); each has its own URL (`?tab=`). */
export const BUILDER_TABS = ["details", "questions", "settings"] as const;
export type BuilderTab = (typeof BUILDER_TABS)[number];
export const isBuilderTab = (value: unknown): value is BuilderTab => BUILDER_TABS.includes(value as BuilderTab);
const builderQuery = (tab?: BuilderTab) => (tab ? `?tab=${tab}` : "");

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
  /** One exam's grading: its attempts, the spelling review list, and item analysis. */
  examGrading: (classId: string, examId: string, view: GradingView = "submissions", extra: { review?: string } = {}) => {
    const params = new URLSearchParams();
    if (view !== "submissions") params.set("view", view);
    if (extra.review) params.set("review", extra.review);
    const query = params.toString();
    return `/instructor/classes/${encodeURIComponent(classId)}/assessments/${encodeURIComponent(examId)}/grading${query ? `?${query}` : ""}`;
  },
  /** The assessment builder (D-040). */
  assessmentNew: (classId: string, tab?: BuilderTab) => `/instructor/classes/${encodeURIComponent(classId)}/assessments/new${builderQuery(tab)}`,
  assessmentEdit: (classId: string, id: number | string, tab?: BuilderTab) => `/instructor/classes/${encodeURIComponent(classId)}/assessments/${id}/edit${builderQuery(tab)}`,
  /** "Preview as student" (built by the preview page's own stream). */
  assessmentPreview: (classId: string, id: number | string) => `/instructor/classes/${encodeURIComponent(classId)}/assessments/${id}/preview`,
  questionSets: "/instructor/question-sets",
  questionSet: (id: number) => `/instructor/question-sets/${id}`,
  /**
   * The shell's page key. The builder's first save moves it from …/assessments/new to
   * …/assessments/{id}/edit; that is the same page, so focus must stay where it is.
   */
  pageKey: (pathname: string) => pathname.replace(/\/assessments\/\d+\/edit$/, "/assessments/new"),
  gradebook: (classId?: string) => (classId ? `/instructor/gradebook?class=${encodeURIComponent(classId)}` : "/instructor/gradebook"),
};
