/**
 * Shapes of the browser-local Admin data (`tmcc-lms-roles-v1`, C-007). The data
 * modules beside this file are plain JavaScript and stay the source of truth;
 * these types describe what they store so the screens can be strict.
 */
export type RecordStatus = "active" | "inactive";
export type UserRole = "student" | "instructor" | "admin";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: RecordStatus;
  createdAt?: string;
  statusChangedAt?: string;
}

export interface Subject {
  id: string;
  code: string;
  title: string;
  description?: string;
  createdAt?: string;
}

export interface Classroom {
  id: string;
  subjectId: string;
  instructorId: string;
  section: string;
  yearLevel: number;
  term: string;
  enrollmentCode: string;
  status: RecordStatus;
  createdAt?: string;
  statusChangedAt?: string;
}

export interface Enrollment {
  id: string;
  classroomId: string;
  studentId: string;
  status: RecordStatus;
  createdAt?: string;
  statusChangedAt?: string;
}

export interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "current" | "planned" | "archived";
}

export interface AlertPreferences {
  setupIssues: boolean;
  userChanges: boolean;
  courseworkActivity: boolean;
}

export interface SystemSettings {
  institutionName: string;
  timeZone: string;
  currentTermId: string;
  notifications: AlertPreferences;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  category: string;
  action: string;
  target: string;
  targetId: string;
  summary: string;
  timestamp: string;
}

/** role → module → action → allowed. Display only; nothing enforces it. */
export type RolePermissions = Record<UserRole, Record<string, Record<string, boolean>>>;

export interface AdminData {
  users: AdminUser[];
  subjects: Subject[];
  classrooms: Classroom[];
  enrollments: Enrollment[];
  modules: { id: string; classroomId: string; title: string; order: number }[];
  systemAdministration: {
    settings: SystemSettings;
    terms: AcademicTerm[];
    rolePermissions: RolePermissions;
    auditLogs: AuditEvent[];
  };
}

/** What an audit entry needs from the screen; the data layer adds the id and time. */
export interface AuditInput {
  category: string;
  action: string;
  target: string;
  targetId?: string;
  summary: string;
}

export type UpdateAdminData = (change: (current: AdminData) => AdminData, audit?: AuditInput) => void;

export interface BackupSnapshot {
  version: number;
  createdAt: string;
  data: AdminData;
}
