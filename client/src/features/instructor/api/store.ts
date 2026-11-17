import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { shouldRetryApiRead } from "../../../shared/api/http";
import { fetchOverview, fetchPeople, meetingLabel, splitName, yearLevelFromSection, type Overview, type People } from "../../../shared/api/overview";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import type { RoleStore, User } from "./types";

/*
 * The Instructor screens read the LMS API (D-032): one overview call per
 * instructor, turned into the store shape the screens and selectors already
 * use, so the screens did not change. Every change is an API call that then
 * refreshes the overview (see actions.ts).
 */

export const instructorKeys = {
  people: ["instructor", "people"] as const,
  overview: (instructorId: string) => ["instructor", "overview", instructorId] as const,
};

const queryOptions = { retry: shouldRetryApiRead, networkMode: "always" } as const;

export function usePeople() {
  return useQuery({ queryKey: instructorKeys.people, queryFn: ({ signal }) => fetchPeople(signal), ...queryOptions, staleTime: 5 * 60_000 });
}

export function useOverview(instructorId: string) {
  const viewer: Viewer = { id: instructorId, role: "instructor" };
  return useQuery({
    queryKey: instructorKeys.overview(instructorId),
    queryFn: ({ signal }) => fetchOverview(viewer, signal),
    ...queryOptions,
    enabled: Boolean(instructorId),
  });
}

/** The current instructor's store. InstructorApp renders the workspace only once it has loaded. */
export function useRoleStore(): RoleStore {
  const { instructorId } = useInstructorSession();
  const people = usePeople();
  const overview = useOverview(instructorId);
  if (!overview.data || !people.data) throw new Error("useRoleStore() used before the instructor overview loaded");
  return toRoleStore(overview.data, people.data);
}

/** Refreshes the current instructor's data after a change. */
export function useRefreshOverview(): () => Promise<void> {
  const queryClient = useQueryClient();
  const { instructorId } = useInstructorSession();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: instructorKeys.overview(instructorId) }), [queryClient, instructorId]);
}

const active = (status: string) => (status === "archived" ? "inactive" : "active");
/** Closed stays "active" (it is still shown); `closed` and the graded counts are kept beside it (D-036). */
const progress = (item: { status: string; gradedCount?: number | null; rosterCount?: number | null }) => ({
  closed: item.status === "closed",
  gradedCount: item.gradedCount ?? 0,
  rosterCount: item.rosterCount ?? 0,
});

export function toRoleStore(overview: Overview, people: People): RoleStore {
  const instructors: User[] = people.instructors.map((person) => ({ id: person.id, ...splitName(person.name), role: "instructor", status: "active" }));
  const students = new Map<string, User>();
  for (const item of overview.students)
    students.set(item.studentId, { id: item.studentId, firstName: item.firstName, lastName: item.lastName, role: "student", status: "active" });
  const coursework = overview.coursework.map((item) => ({ classId: item.classId, ...item.coursework }));
  const kindOf = new Map(coursework.map((item) => [item.id, item.type]));
  const instructorOf = new Map(overview.classes.map((room) => [room.id, room.instructorId]));

  return {
    users: [...instructors, ...students.values()],
    subjects: overview.classes.map((room) => ({ id: `subject-${room.id}`, code: room.subjectCode ?? "", title: room.subjectName, source: "isms" })),
    classrooms: overview.classes.map((room) => ({
      id: room.id,
      subjectId: `subject-${room.id}`,
      ismsSubjectId: room.subjectId,
      instructorId: room.instructorId,
      section: room.sectionName ?? "",
      yearLevel: yearLevelFromSection(room.sectionName),
      term: room.termName ?? undefined,
      schedule: meetingLabel(room.meetings) || undefined,
      status: "active",
      source: "isms",
    })),
    enrollments: overview.students.map((item) => ({ id: `${item.classId}-${item.studentId}`, classroomId: item.classId, studentId: item.studentId, status: "active", source: "isms" })),
    modules: overview.modules.map((item) => ({
      id: String(item.id),
      classroomId: item.classId,
      ...(item.parentModuleId === null ? {} : { parentId: String(item.parentModuleId) }),
      title: item.title,
      order: item.sortOrder,
    })),
    materials: overview.materials.map((item) => ({
      id: String(item.id),
      moduleId: String(item.moduleId),
      classroomId: item.classId,
      title: item.title,
      kind: item.kind,
      description: item.description ?? "",
      fileName: item.fileName ?? undefined,
      fileType: item.fileType ?? undefined,
      fileSize: item.fileSize ?? undefined,
      uploadedAt: item.createdAt,
      createdAt: item.createdAt,
      status: item.status,
    })),
    activities: coursework.filter((item) => item.type === "assignment").map((item) => ({
      id: String(item.id),
      moduleId: String(item.moduleId),
      title: item.title,
      instructions: item.instructions ?? "",
      dueAt: item.dueAt ?? undefined,
      maxScore: item.maxPoints,
      allowLate: item.allowLate,
      allowResubmission: item.allowResubmission,
      status: active(item.status),
      ...progress(item),
    })),
    exams: coursework.filter((item) => item.type === "exam").map((item) => ({
      id: String(item.id),
      classroomId: item.classId,
      moduleId: String(item.moduleId),
      title: item.title,
      instructions: item.instructions ?? "",
      dueAt: item.dueAt ?? undefined,
      totalMarks: item.maxPoints,
      timeLimitMinutes: item.timeLimitMinutes ?? 0,
      attempts: item.maxAttempts ?? 1,
      status: active(item.status),
      draft: item.status === "draft",
      ...progress(item),
    })),
    activitySubmissions: overview.submissions.filter((item) => kindOf.get(item.courseworkId) === "assignment").map(({ courseworkId, classId, submission }) => ({
      id: String(submission.id),
      activityId: String(courseworkId),
      classroomId: classId,
      studentId: submission.studentId,
      submissionText: submission.text ?? "",
      fileAttachmentUrl: submission.fileName ?? "",
      status: submission.status,
      submittedAt: submission.submittedAt ?? undefined,
      grade: submission.status === "graded" ? submission.score : null,
      feedback: submission.feedback ?? "",
      notHandedIn: Boolean(submission.notHandedIn),
    })),
    examSubmissions: overview.submissions.filter((item) => kindOf.get(item.courseworkId) === "exam").map(({ courseworkId, classId, submission }) => ({
      id: String(submission.id),
      examId: String(courseworkId),
      classroomId: classId,
      studentId: submission.studentId,
      status: submission.status,
      totalScore: submission.score ?? undefined,
      feedback: submission.feedback ?? undefined,
      submittedAt: submission.submittedAt ?? undefined,
      gradedAt: submission.gradedAt ?? undefined,
      notHandedIn: Boolean(submission.notHandedIn),
    })),
    announcements: overview.announcements.map((item) => ({
      id: String(item.id),
      classroomId: item.classId,
      instructorId: item.postedBy ?? instructorOf.get(item.classId) ?? "",
      title: item.title,
      message: item.message,
      createdAt: item.publishedAt,
      status: active(item.status),
    })),
    gradebookSettings: Object.fromEntries(overview.gradebooks.map((item) => [item.classId, { activityWeight: item.activityWeight, examWeight: item.examWeight, passingScore: item.passingScore }])),
    attendance: overview.attendance.map(({ classId, month }) => ({
      classroomId: classId,
      year: month.year,
      month: month.month,
      schoolDays: month.schoolDays,
      daysPresent: Object.fromEntries(month.entries.map((entry) => [entry.studentId, entry.daysPresent])),
    })),
  };
}
