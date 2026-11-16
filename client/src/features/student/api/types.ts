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

export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  /** "Quiz" | "Long Quiz" | "Exam" | "Assignment" */
  type: string;
  description: string;
  dueAt: string;
  questionCount?: number;
  points: number;
  timeLimit: string;
  instructions: string;
  /** Instructor-created assignments are "activity"; quizzes and exams have no kind. */
  kind?: "activity";
  allowLate?: boolean;
  allowResubmission?: boolean;
  /** Exams: how many attempts are allowed (1 when not set). */
  maxAttempts?: number;
}

export interface Material {
  id: string;
  courseId: string;
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
}

export interface ExamGrade {
  examId: string;
  totalScore: number;
  feedback?: string;
}

export interface StudentCatalog {
  courses: Course[];
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
