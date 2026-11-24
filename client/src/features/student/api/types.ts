import type { TurnIn } from "../../../shared/api/overview";
import type { HandInSettings } from "../../../shared/lib/assignmentRules";
import type { AnswerReview, SpellingMode } from "../../../shared/components/quiz/types";

/** Shapes of the Student workspace data, built from the LMS API overview (D-032). */

export interface Course {
  id: string;
  code?: string;
  name: string;
  subject: string;
  section: string;
  room: string;
  teacher: string;
  count: number;
  next: string;
  symbol: string;
  about: string;
}

/** A module of a class, or a submodule when `parentId` is set (one level, D-033). */
export interface CourseModule {
  id: string;
  courseId: string;
  parentId?: string;
  title: string;
  order: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  /** The module or submodule it is placed in. */
  moduleId?: string;
  title: string;
  /** "Quiz" | "Long Quiz" | "Exam" | "Assignment" */
  type: string;
  description: string;
  /** The student's own due date when they have one (contract §11), otherwise the assignment's; "" for none. */
  dueAt: string;
  /** The class's due date, present only when the student has a later one of their own. */
  classDueAt?: string;
  /** Assignments: the instructor excused this student; nothing to hand in, and it does not count (D-062). */
  excused?: boolean;
  /** Assignments: the rubric it is graded with (contract §12). */
  rubricId?: number;
  questionCount?: number;
  points: number;
  timeLimit: string;
  instructions: string;
  /** Instructor-created assignments are "activity"; quizzes and exams have no kind. */
  kind?: "activity";
  /** Assignments: the server's turn-in verdict (D-054). */
  turnIn?: TurnIn;
  /** Assignments: how work is handed in (contract §1, §5), for the brief and the work card, with the student's own dates. */
  handIn?: HandInSettings;
  /** Exams: how many attempts are allowed (1 when not set). */
  maxAttempts?: number;
  /** The instructor closed it: no more hand-ins or attempts (D-036). */
  closed?: boolean;
  /** Exams: what the student sees after submitting, and the spelling rule for typed answers (D-040). */
  answerReview?: AnswerReview;
  spellingMode?: SpellingMode;
}

export interface Material {
  id: string;
  courseId: string;
  /** The module or submodule it is placed in. */
  moduleId?: string;
  title: string;
  kind: string;
  readTime: string;
  summary: string;
  added: string;
  goal: string;
  points: string[];
}

export interface Question {
  id: string;
  prompt: string;
  context?: string;
  options: string[];
  correct: number;
  points: number;
}

export interface AcademicEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  category: string;
}

export interface FeaturedAnnouncement {
  eventId: string;
  summary: string;
  image: string;
}

export interface ClassAnnouncement {
  id: string;
  classroomId: string;
  title: string;
  message: string;
  createdAt: string;
  author: string;
}

export interface Classmate {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ActivitySubmission {
  id: string;
  activityId: string;
  submissionText: string;
  fileAttachmentUrl: string;
  status: string;
  submittedAt: string;
  grade: number | null;
  feedback: string;
  /** The instructor graded it without anything handed in (D-036). */
  notHandedIn?: boolean;
}

export interface ExamGrade {
  examId: string;
  totalScore: number;
  feedback?: string;
  /** See ActivitySubmission.notHandedIn. */
  notHandedIn?: boolean;
}

/** One month of the student's own attendance (D-035). */
export interface AttendanceMonth {
  courseId: string;
  year: number;
  month: number;
  schoolDays: number;
  /** null when the instructor recorded the month but not this student's days. */
  daysPresent: number | null;
}

export interface StudentCatalog {
  courses: Course[];
  /** Every class's modules and submodules, unsorted (see shared/lib/moduleTree). */
  modules: CourseModule[];
  assessments: Assessment[];
  materials: Material[];
  questions: Record<string, Question[]>;
  academicEvents: AcademicEvent[];
  featured: FeaturedAnnouncement[];
  classmates: Classmate[];
  announcements: ClassAnnouncement[];
  /** The demo student's (s0) assignment submissions, by activity id. */
  activitySubmissions: Record<string, ActivitySubmission>;
  /** The student's graded exam result (highest graded attempt), by exam id. */
  examGrades: Record<string, ExamGrade>;
  /** Exams: the student's attempts, by exam id. */
  attempts: Record<string, AttemptSummary>;
  /** Assessments the student has handed in. */
  completed: string[];
  /** The student's own attendance, newest month first. */
  attendance: AttendanceMonth[];
  /** The student being viewed. */
  me: { id: string; firstName: string; name: string };
}

export interface AttemptSummary {
  /** An attempt started but not handed in. */
  openId?: number;
  /** The most recent handed-in attempt. */
  latestId?: number;
  used: number;
}

/** Saved in gclass-student-workspace-v1; same shape as the classic UI (C-007). */
export interface StudentProgress {
  /** assessmentId → questionIndex → chosen option index */
  answers: Record<string, Record<number, number>>;
  completed: string[];
}
