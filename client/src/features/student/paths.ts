import type { TaskStatus } from "./api/selectors";

/** Student routes. Every screen has a URL, so Back/Forward and links work. */
export const studentPaths = {
  today: "/student",
  tasks: (status?: TaskStatus) => (status && status !== "Due soon" ? `/student/tasks?status=${encodeURIComponent(status)}` : "/student/tasks"),
  calendar: (thisWeek = false) => (thisWeek ? "/student/calendar?view=week" : "/student/calendar"),
  classes: "/student/classes",
  news: "/student/news",
  classPage: (id: string, tab: ClassTab = "Stream") => `/student/classes/${encodeURIComponent(id)}${tab === "Stream" ? "" : `?tab=${tab}`}`,
  assessment: (id: string) => `/student/assessments/${encodeURIComponent(id)}`,
  quiz: (id: string) => `/student/assessments/${encodeURIComponent(id)}/quiz`,
  result: (id: string) => `/student/assessments/${encodeURIComponent(id)}/result`,
  material: (id: string) => `/student/materials/${encodeURIComponent(id)}`,
  /** A class meeting's full-screen page (D-070), in the same tab: the demo identity is per tab. */
  meeting: (classId: string, id: number | string) => `/student/meet/${encodeURIComponent(classId)}/${encodeURIComponent(String(id))}`,
};

export const CLASS_TABS = ["Stream", "Classwork", "Modules", "Materials", "People", "Attendance", "Meetings"] as const;
export type ClassTab = (typeof CLASS_TABS)[number];
export const isClassTab = (value: unknown): value is ClassTab => CLASS_TABS.includes(value as ClassTab);
