/** The shared role store (tmcc-lms-roles-v1) as the Instructor UI uses it. */

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
  status: string;
  /** "isms" when the record is copied from ISMS (D-031); absent for demo and local records. */
  source?: string;
}

export interface Subject {
  id: string;
  code: string;
  title: string;
  description?: string;
  source?: string;
}

export interface Classroom {
  id: string;
  subjectId: string;
  /** The ISMS subject id, which question sets are filed under (D-034). */
  ismsSubjectId?: number;
  instructorId: string;
  section: string;
  yearLevel?: number;
  term?: string;
  enrollmentCode?: string;
  status: string;
  createdAt?: string;
  source?: string;
  /** Meeting days and times from ISMS, e.g. "MW 08:00–09:30". */
  schedule?: string;
}

export interface Enrollment {
  id?: string;
  classroomId: string;
  studentId: string;
  status: string;
  source?: string;
}

export interface Module {
  id: string;
  classroomId: string;
  /** Set on a submodule: the module it belongs to (one level, D-033). */
  parentId?: string;
  title: string;
  order?: number;
}

export interface Material {
  id: string;
  moduleId: string;
  classroomId?: string;
  title: string;
  kind?: string;
  description?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  downloads?: number;
  status?: string;
  createdAt?: string;
}

export interface Activity {
  id: string;
  moduleId: string;
  title: string;
  instructions?: string;
  dueAt?: string;
  maxScore: number;
  allowLate?: boolean;
  allowResubmission?: boolean;
  status?: string;
  /** Closed with the close action once every student was graded (D-036). */
  closed?: boolean;
  /** Students on the class list with a grade, and how many are on it (from the server). */
  gradedCount?: number;
  rosterCount?: number;
  createdAt?: string;
}

export interface ExamQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  points?: number;
}

export interface Exam {
  id: string;
  classroomId: string;
  moduleId?: string;
  title: string;
  instructions?: string;
  dueAt?: string;
  totalMarks: number;
  timeLimitMinutes?: number;
  attempts?: number;
  status?: string;
  /** See Activity.closed (D-036). */
  closed?: boolean;
  gradedCount?: number;
  rosterCount?: number;
  createdAt?: string;
  questions?: ExamQuestion[];
}

export interface ActivitySubmission {
  id: string;
  activityId: string;
  classroomId: string;
  studentId: string;
  submissionText?: string;
  fileAttachmentUrl?: string;
  status: string;
  submittedAt?: string;
  grade: number | null;
  feedback?: string;
  /** A grade given to a student who handed in nothing (D-036). */
  notHandedIn?: boolean;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  classroomId: string;
  studentId: string;
  status: string;
  totalScore?: number;
  feedback?: string;
  answers?: Record<number, number>;
  submittedAt?: string;
  gradedAt?: string;
  gradedBy?: string;
  notHandedIn?: boolean;
}

export interface Announcement {
  id: string;
  classroomId: string;
  instructorId: string;
  title: string;
  message: string;
  createdAt: string;
  status?: string;
}

export interface GradebookSetting {
  activityWeight: number;
  examWeight: number;
  passingScore: number;
}

export interface AttendanceRecord {
  classroomId: string;
  year: number;
  month: number;
  schoolDays: number;
  /** Days present by student id. */
  daysPresent: Record<string, number>;
}

export interface RoleStore {
  users: User[];
  subjects: Subject[];
  classrooms: Classroom[];
  enrollments: Enrollment[];
  modules: Module[];
  materials: Material[];
  activities: Activity[];
  exams: Exam[];
  activitySubmissions: ActivitySubmission[];
  examSubmissions: ExamSubmission[];
  announcements?: Announcement[];
  gradebookSettings: Record<string, GradebookSetting>;
  attendance: AttendanceRecord[];
  systemAdministration?: { settings: { currentTermId: string }; terms: Array<{ id: string; name: string }> };
}

export interface AuditEvent {
  actorId: string;
  actorName: string;
  actorRole: "instructor";
  category: string;
  action: string;
  target: string;
  targetId: string;
  summary: string;
}
