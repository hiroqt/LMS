import { getJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { ClassFilters, IsmsClass, IsmsInstructor, IsmsList, IsmsStatus, IsmsStudent, IsmsSubject } from "./types";

/** Every ISMS query key starts with "isms", so one invalidation refreshes the page. */
export const ismsKeys = {
  all: ["isms"] as const,
  status: () => ["isms", "status"] as const,
  classes: (filters: ClassFilters) => ["isms", "classes", filters] as const,
  students: (classId: string) => ["isms", "classes", classId, "students"] as const,
  subjects: () => ["isms", "subjects"] as const,
  instructors: () => ["isms", "instructors"] as const,
};

/**
 * Options shared by every ISMS query. These are live server reads, so they
 * run even when the browser reports offline (the app default "offlineFirst"
 * would pause the retry and leave a skeleton up); the error state then says
 * the connection is missing.
 */
export const ismsQueryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;

/** The class filter for an instructor choice ("" means all instructors). */
export const classFilters = (instructorId: string): ClassFilters => (instructorId ? { instructorId } : {});

export const fetchIsmsStatus = (signal?: AbortSignal) => getJson<IsmsStatus>("/api/isms/status", { signal });

export const fetchClasses = (filters: ClassFilters, signal?: AbortSignal) =>
  getJson<IsmsList<IsmsClass>>("/api/classes", { signal, params: { ...filters } });

export const fetchClassStudents = (classId: string, signal?: AbortSignal) =>
  getJson<IsmsList<IsmsStudent>>(`/api/classes/${encodeURIComponent(classId)}/students`, { signal });

export const fetchSubjects = (signal?: AbortSignal) => getJson<IsmsList<IsmsSubject>>("/api/subjects", { signal });

export const fetchInstructors = (signal?: AbortSignal) => getJson<IsmsList<IsmsInstructor>>("/api/instructors", { signal });
