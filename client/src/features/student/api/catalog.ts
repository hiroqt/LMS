import { academicEvents, courses as demoCourses, featuredAnnouncements } from "../../../data.js";
import { isGraded, meetingLabel, type Coursework, type Overview, type Submission } from "../../../shared/api/overview";
import type { ActivitySubmission, Assessment, AttemptSummary, Course, ExamGrade, StudentCatalog } from "./types";

/** Shown under the student's name; ISMS does not send a program yet. */
export const STUDENT_SUBTITLE = "Student";

type DemoCourse = (typeof demoCourses)[number];

/**
 * Room, next meeting, symbol and blurb for the fictional demo classes, which
 * ISMS does not provide. Real ISMS classes fall back to their meetings.
 */
const demoExtras = new Map<string, DemoCourse>(demoCourses.map((course) => [course.id, course]));

const handedIn = (submission: Submission) => submission.status !== "in_progress";

function readTime(text: string | null): string {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
}

/** The exam settings of D-040, when the API sends them (contract §3). */
function examSettings(work: Coursework & Partial<Pick<Assessment, "answerReview" | "spellingMode">>) {
  if (work.type !== "exam") return {};
  return { ...(work.answerReview ? { answerReview: work.answerReview } : {}), ...(work.spellingMode ? { spellingMode: work.spellingMode } : {}) };
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Builds the Student workspace from the LMS API overview (D-032). The school
 * calendar and featured news are school-wide and still come from data.js.
 */
export function toStudentCatalog(overview: Overview): StudentCatalog {
  const courses: Course[] = overview.classes.map((room) => {
    const extra = demoExtras.get(room.id);
    const meeting = room.meetings[0];
    return {
      id: room.id,
      code: room.subjectCode ?? undefined,
      name: room.subjectName,
      subject: extra?.subject ?? room.subjectName,
      section: room.sectionName ?? "",
      room: extra?.room ?? (meeting ? `Room ${meeting.roomId}` : "To be announced"),
      teacher: extra?.teacher ?? room.instructorName,
      count: room.studentCount,
      next: extra?.next ?? (meetingLabel(room.meetings) || "Schedule to be announced"),
      symbol: extra?.symbol ?? (room.subjectCode ?? room.subjectName).slice(0, 2),
      about: extra?.about ?? "",
    };
  });
  const teacherOf = (classId: string) => courses.find((course) => course.id === classId)?.teacher ?? "Instructor";

  const coursework = overview.coursework.map((item) => ({ classId: item.classId, ...item.coursework }));
  const submissionsOf = (courseworkId: number) => overview.submissions.filter((item) => item.courseworkId === courseworkId).map((item) => item.submission);

  const activitySubmissions: Record<string, ActivitySubmission> = {};
  const examGrades: Record<string, ExamGrade> = {};
  const attempts: Record<string, AttemptSummary> = {};
  const completed: string[] = [];
  for (const work of coursework) {
    const id = String(work.id);
    const mine = submissionsOf(work.id);
    const done = mine.filter(handedIn).sort((a, b) => b.attemptNumber - a.attemptNumber);
    if (done.length) completed.push(id);
    if (work.type === "assignment") {
      const latest = done[0];
      if (latest) {
        activitySubmissions[id] = {
          id: String(latest.id),
          activityId: id,
          submissionText: latest.text ?? "",
          fileAttachmentUrl: latest.fileName ?? "",
          status: latest.status,
          submittedAt: latest.submittedAt ?? "",
          grade: isGraded(latest.status) ? latest.score : null,
          feedback: latest.feedback ?? "",
          ...(latest.notHandedIn ? { notHandedIn: true } : {}),
        };
      }
    } else {
      // A "not handed in" grade has no attempt to review, so it is never the latest attempt.
      attempts[id] = { openId: mine.find((item) => !handedIn(item))?.id, latestId: done.find((item) => !item.notHandedIn)?.id, used: mine.length };
      const best = done.filter((item) => isGraded(item.status) && item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      if (best) examGrades[id] = { examId: id, totalScore: best.score ?? 0, feedback: best.feedback ?? undefined, ...(best.notHandedIn ? { notHandedIn: true } : {}) };
    }
  }

  const me = overview.me;
  return {
    courses,
    modules: overview.modules.map((item) => ({
      id: String(item.id),
      courseId: item.classId,
      ...(item.parentModuleId === null ? {} : { parentId: String(item.parentModuleId) }),
      title: item.title,
      order: item.sortOrder,
    })),
    assessments: coursework.map((work) => ({
      id: String(work.id),
      courseId: work.classId,
      moduleId: String(work.moduleId),
      title: work.title,
      type: work.category ?? (work.type === "exam" ? "Exam" : "Assignment"),
      description: work.description ?? work.instructions ?? "",
      dueAt: work.dueAt ?? "",
      questionCount: work.questionCount,
      points: work.maxPoints,
      timeLimit: work.timeLimitMinutes ? `${work.timeLimitMinutes} minutes` : "No time limit",
      instructions: work.instructions ?? "",
      kind: work.type === "assignment" ? ("activity" as const) : undefined,
      ...(work.type === "assignment" && work.turnIn ? { turnIn: work.turnIn } : {}),
      maxAttempts: work.maxAttempts ?? 1,
      closed: work.status === "closed",
      ...examSettings(work),
    })),
    materials: overview.materials.map((material) => ({
      id: String(material.id),
      courseId: material.classId,
      moduleId: String(material.moduleId),
      title: material.title,
      kind: material.kind,
      readTime: readTime(material.description),
      summary: material.description ?? "",
      added: shortDate(material.createdAt),
      goal: material.description ?? "",
      points: [],
    })),
    questions: {},
    academicEvents: academicEvents as StudentCatalog["academicEvents"],
    featured: featuredAnnouncements as StudentCatalog["featured"],
    classmates: [...new Map(overview.students.map((item) => [item.studentId, item])).values()].map((item) => ({
      id: item.studentId,
      name: `${item.firstName} ${item.lastName}`.trim(),
      email: "",
      role: item.studentId === me.id ? "You" : "Student",
    })),
    announcements: overview.announcements.map((item) => ({
      id: String(item.id),
      classroomId: item.classId,
      title: item.title,
      message: item.message,
      createdAt: item.publishedAt,
      author: item.postedByName ?? teacherOf(item.classId),
    })),
    activitySubmissions,
    examGrades,
    attempts,
    completed,
    attendance: overview.attendance.map(({ classId, month }) => ({
      courseId: classId,
      year: month.year,
      month: month.month,
      schoolDays: month.schoolDays,
      daysPresent: month.entries.find((entry) => entry.studentId === me.id)?.daysPresent ?? null,
    })),
    me: { id: me.id, firstName: me.firstName || "there", name: `${me.firstName} ${me.lastName}`.trim() || me.id },
  };
}

/** The course code shown on cards and headers, e.g. "IT101" (falls back to the class symbol). */
export function courseCode(course: { code?: string; symbol: string }): string {
  return course.code || course.symbol;
}
