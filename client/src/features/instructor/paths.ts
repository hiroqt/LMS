/** Instructor routes. Every screen, tab, open form, and selected submission has a URL. */
export const CLASS_TABS = ["Stream", "Classwork", "Modules", "Announcements", "Materials", "People", "Attendance", "Meetings", "Submissions", "Create content"] as const;
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
const builderQuery = (tab?: BuilderTab | AssignmentTab) => (tab ? `?tab=${tab}` : "");

/** The parts of the assignment builder, one tab each (D-058); each has its own URL (`?tab=`). */
export const ASSIGNMENT_TABS = ["details", "hand-in", "dates"] as const;
export type AssignmentTab = (typeof ASSIGNMENT_TABS)[number];
export const isAssignmentTab = (value: unknown): value is AssignmentTab => ASSIGNMENT_TABS.includes(value as AssignmentTab);

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
  /** The assignment builder (D-058): new, or editing a draft or a published assignment. */
  assignmentNew: (classId: string, tab?: AssignmentTab) => `/instructor/classes/${encodeURIComponent(classId)}/assignments/new${builderQuery(tab)}`,
  assignmentEdit: (classId: string, id: number | string, tab?: AssignmentTab) => `/instructor/classes/${encodeURIComponent(classId)}/assignments/${id}/edit${builderQuery(tab)}`,
  /** "Preview as student" for an assignment. */
  assignmentPreview: (classId: string, id: number | string) => `/instructor/classes/${encodeURIComponent(classId)}/assignments/${id}/preview`,
  /** One assignment's grading: its students, their files, points and feedback, and Return (D-058). */
  assignmentGrading: (classId: string, id: number | string, extra: { student?: string; filter?: string } = {}) => {
    const params = new URLSearchParams();
    if (extra.filter) params.set("filter", extra.filter);
    if (extra.student) params.set("student", extra.student);
    const query = params.toString();
    return `/instructor/classes/${encodeURIComponent(classId)}/assignments/${id}/grading${query ? `?${query}` : ""}`;
  },
  /** One class material: its preview, file, and the instructor's changes to it (D-067). */
  material: (classId: string, id: number | string) => `/instructor/classes/${encodeURIComponent(classId)}/materials/${encodeURIComponent(String(id))}`,
  /** A class's grading rubrics (D-062): the list, and one rubric to write or change. */
  rubrics: (classId: string) => `/instructor/classes/${encodeURIComponent(classId)}/rubrics`,
  rubricNew: (classId: string) => `/instructor/classes/${encodeURIComponent(classId)}/rubrics/new`,
  rubric: (classId: string, id: number | string) => `/instructor/classes/${encodeURIComponent(classId)}/rubrics/${id}`,
  /** A class meeting's full-screen page (D-072), in the same tab: the demo identity is per tab. */
  meeting: (classId: string, id: number | string) => `/instructor/meet/${encodeURIComponent(classId)}/${encodeURIComponent(String(id))}`,
  /** A meeting's own page in the class: attendance and the saved chat (D-072, Phase 3). */
  meetingDetails: (classId: string, id: number | string) => `/instructor/classes/${encodeURIComponent(classId)}/meetings/${encodeURIComponent(String(id))}`,
  questionSets: "/instructor/question-sets",
  questionSet: (id: number) => `/instructor/question-sets/${id}`,
  /**
   * The shell's page key. A builder's first save moves it from …/assessments/new to
   * …/assessments/{id}/edit (and the same for …/assignments/); that is the same page, so
   * focus must stay where it is.
   */
  pageKey: (pathname: string) => pathname.replace(/\/(assessments|assignments)\/\d+\/edit$/, "/$1/new"),
  gradebook: (classId?: string) => (classId ? `/instructor/gradebook?class=${encodeURIComponent(classId)}` : "/instructor/gradebook"),
};
