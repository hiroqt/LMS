import type { Coursework, Overview, Submission } from "./overview";

/** A small fictional overview for unit tests. */
export function overviewFixture(change: (overview: Overview) => void = () => {}): Overview {
  const work = (id: number, over: Partial<Coursework>): { classId: string; coursework: Coursework } => ({
    classId: "class-a",
    coursework: {
      id, moduleId: 1, type: "assignment", title: `Work ${id}`, description: null, category: null, instructions: "Do it.", maxPoints: 10,
      dueAt: "2026-10-30T15:59:00Z", availableFrom: null, allowLate: false, allowResubmission: false, maxAttempts: null,
      timeLimitMinutes: null, questionnaireId: null, questionCount: 0, status: "published", closeAt: null, gradeRelease: "immediate",
      turnIn: (over.type ?? "assignment") === "assignment" ? { state: "assigned", canTurnIn: true, reason: null, late: false } : null, ...over,
    },
  });
  const sub = (id: number, courseworkId: number, over: Partial<Submission>) => ({
    courseworkId, classId: "class-a",
    submission: {
      id, studentId: "STU-1", studentName: "Lia Abad", attemptNumber: 1, status: "submitted" as Submission["status"], startedAt: null,
      submittedAt: "2026-10-20T01:00:00Z", late: false, text: "Mine", fileName: "work.pdf", score: null, maxPoints: 10, feedback: null, gradedAt: null, ...over,
    },
  });
  const overview: Overview = {
    me: { id: "STU-1", firstName: "Lia", lastName: "Abad", role: "student" },
    classes: [{ id: "class-a", subjectId: 7, subjectCode: "IT202", subjectName: "Database Systems 1", sectionName: "BSIT 2-A", instructorId: "EMP-1", instructorName: "Ana Reyes", termName: "2026-2027 · 1st Semester", studentCount: 2, meetings: [{ day: "MW", timeFrom: "08:00", timeTo: "09:30", roomId: 203, modality: 1 }] }],
    modules: [{ id: 1, classId: "class-a", parentModuleId: null, title: "Unit 1", sortOrder: 1 }],
    materials: [{ id: 5, classId: "class-a", moduleId: 1, title: "Notes", kind: "Reading", description: "Short notes", fileName: "notes.pdf", fileType: "pdf", fileSize: null, status: "archived", createdAt: "2026-10-18T02:00:00Z" }],
    announcements: [{ id: 9, classId: "class-a", title: "Lab moved", message: "Room 204", status: "active", publishedAt: "2026-10-21T00:00:00Z", postedBy: "EMP-1", postedByName: "Ana Reyes" }],
    coursework: [
      work(1, { type: "assignment", allowResubmission: true }),
      work(2, { type: "exam", category: "Quiz", maxPoints: 20, questionCount: 5, timeLimitMinutes: 5, maxAttempts: 2 }),
      work(3, { type: "assignment", dueAt: null, status: "archived" }),
    ],
    submissions: [
      sub(11, 1, { attemptNumber: 1, status: "graded", score: 4, feedback: "First try" }),
      sub(12, 1, { attemptNumber: 2, status: "graded", score: 9, feedback: "Much better" }),
      sub(21, 2, { attemptNumber: 1, status: "graded", score: 16 }),
      sub(22, 2, { attemptNumber: 2, status: "in_progress", submittedAt: null }),
    ],
    students: [
      { classId: "class-a", studentId: "STU-1", firstName: "Lia", lastName: "Abad" },
      { classId: "class-a", studentId: "STU-2", firstName: "Max", lastName: "Bautista" },
    ],
    gradebooks: [{ classId: "class-a", activityWeight: 30, examWeight: 70, passingScore: 75 }],
    attendance: [
      { classId: "class-a", month: { year: 2026, month: 10, schoolDays: 20, entries: [{ studentId: "STU-1", daysPresent: 18 }, { studentId: "STU-2", daysPresent: 15 }] } },
      { classId: "class-a", month: { year: 2026, month: 9, schoolDays: 22, entries: [{ studentId: "STU-2", daysPresent: 22 }] } },
    ],
  };
  change(overview);
  return overview;
}
